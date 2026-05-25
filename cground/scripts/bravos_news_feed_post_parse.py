"""bravos_news_feed_post_parse — parse atoms 4/5/6 from a Playwright extract.

Input:  a JSON file written by `mcp__playwright__browser_evaluate(filename=…)`
        containing at minimum:
          - url        : str (bravosresearch.com/news-feed/{slug}/)
          - title      : str (the document.title)
          - h1         : str (the post H1, usually same as title minus the
                              " - Bravos Research" suffix)
          - full_text  : str (document.body.innerText, ideally scoped to
                              the <article> element)
          - auth_state : object with logged_in:bool

Output (stdout JSON):
  {
    "frontmatter": {
      "type":          "trade-alert" | "premium-video" | "special-report" | ...,
      "date":          "YYYY-MM-DD",
      "slug":          "...",
      "ticker":        "XLF" | null,
      "action":        "LONG" | "SHORT" | "closing" | "profit-booking" |
                       "exposure-increase" | "exposure-reduce" | null,
      "company":       "Financial Select Sector SPDR Fund" | null,
      "title":         "Initiating Long on ...",
      "source_url":    "...",

      # Initiate-type fields (null when not applicable):
      "entry_price":   float | null,
      "take_profit":   [float, ...] | null,
      "stop_loss":     float | null,
      "weight":        int | null,

      # Close-type / lifecycle-event fields (null when not applicable):
      "close_price":   float | null,
      "entry_date":    "YYYY-MM-DD" | null,
    },
    "raw_body_text": "...",   # full_text minus the comment thread + footer
  }

Slug-agnostic — same /news-feed/{slug}/ shape covers trade-alerts (atom 4),
premium-videos (atom 5), and special-reports (atom 6). The post-type
detection drives the frontmatter `type` field. Macro-reports (atom 9) live
at a different URL pattern (/the-macro-report/{slug}/) but share enough
of the body shape that this parser can be extended later.

Body-shape note: the existing pm-bravos-sync routine (Claude_in_Chrome
era) emits an AGENT-DISTILLED markdown body — Sonnet reads the page
prose and rewrites a polished thesis section. THIS parser intentionally
stays a pure extractor — it surfaces the raw page text + structured
frontmatter only. The routine flow integration (M3-integrate, post
fires 3/3) decides whether to keep agent-distillation or accept raw
text as the body. Parity comparison should focus on FRONTMATTER fields,
not body prose.

Action coverage (PBPM-M3 fire 1/3):
  - **Initiating Long / Short** — entry_price, take_profit, stop_loss,
    weight populated. Validated against XLF (truth 10/10 parity).
  - **Closing** — close_price, entry_price, entry_date populated.
    Validated against DE (truth 8/8 parity).
  - **Booking Partial Profits / Increasing Exposure / Reducing
    Exposure** — action detected, but event-specific fields
    (exit_price, add_price, weight_before/after, add_date) NOT yet
    extracted. M3.5 queued. The existing routine's truth-set for
    these uses richer-but-inconsistent field names (e.g. profit-
    booking posts carry `exit_price` / `add_price` / `weight_before` /
    `weight_after` / `subtype: Profit Booking` per CPER 2026-05-14;
    field names + casing drift across truth atoms). M3.5 settles
    the canonical schema before extending the extractor.

Convention normalization vs existing truth-set:
  - `type` always emitted as kebab-case ("trade-alert"); truth mixes
    kebab-case (XLF) and Title Case ("Trade Alert" for CPER).
  - `company` always emitted from H1 parse; truth omits or uses `name`
    inconsistently.
  - `title` always emitted; truth omits.
  - `source_url` always emitted; truth sometimes omits (e.g. DE).
  Migration surfaces convention improvements alongside the substrate
  swap.

PBPM-M3 fire 1/3 — 2026-05-25.

Usage:
  python bravos_news_feed_post_parse.py \
    --extract-path .playwright-mcp/news-feed-extract.json
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Map H1 prefix to (action, type) tuple
ACTION_PATTERNS = [
    (re.compile(r"^Initiating Long\b", re.I), ("LONG", "trade-alert")),
    (re.compile(r"^Initiating Short\b", re.I), ("SHORT", "trade-alert")),
    (re.compile(r"^Closing\b", re.I), ("closing", "trade-alert")),
    (re.compile(r"^Booking Partial Profits\b", re.I), ("profit-booking", "trade-alert")),
    (re.compile(r"^Increasing Exposure\b", re.I), ("exposure-increase", "trade-alert")),
    (re.compile(r"^Reducing Exposure\b", re.I), ("exposure-reduce", "trade-alert")),
]

# Footer/comment markers — anything from these onward is stripped from raw_body
COMMENT_FOOTER_MARKERS = [
    "What didn't you like?",
    "CANCEL REPLY",
    "Leave a Reply",
]

POST_TYPE_BY_DETECTED = {
    "Trade Alert": "trade-alert",
    "Premium Video": "premium-video",
    "Special Report": "special-report",
    "Model Signal": "model-signal",
    "Past Newsletter": "past-newsletter",
}


def parse_us_date(s: str) -> str | None:
    """Convert 'MM/DD/YYYY' or 'Month DD, YYYY' to 'YYYY-MM-DD'."""
    s = s.strip().replace(" ", " ")  # nbsp from page
    for fmt in ("%m/%d/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def extract_h1_meta(h1: str) -> dict[str, Any]:
    """Pull (action, ticker, company) from the H1 string.

    Examples:
      'Initiating Long on Financial Select Sector SPDR Fund ($XLF) | Breakout'
        → action=LONG, ticker=XLF, company='Financial Select Sector SPDR Fund'
      'Closing Deere & Company ($DE) | Breakdown'
        → action=closing, ticker=DE, company='Deere & Company'
      'Booking Partial Profits on United States Copper Index Fund ($CPER) | Profit Booking'
        → action=profit-booking, ticker=CPER, company='United States Copper Index Fund'
    """
    out = {"action": None, "ticker": None, "company": None}

    # Action
    for pat, (action, _) in ACTION_PATTERNS:
        if pat.search(h1):
            out["action"] = action
            break

    # Ticker — pattern `(...$TICKER)` near the end
    tick_m = re.search(r"\(\$?([A-Z0-9.\-]+)\)", h1)
    if tick_m:
        out["ticker"] = tick_m.group(1)

    # Company — text between action and ticker, dropping the " on " connector if present
    # Strip the "| ..." trailing tag and the "($TICKER)" segment
    cleaned = re.sub(r"\s*\(\$?[A-Z0-9.\-]+\).*$", "", h1).strip()
    for pat, _ in ACTION_PATTERNS:
        cleaned = pat.sub("", cleaned).strip()
    # Drop leading "on " (e.g., "on Financial Select Sector ...")
    cleaned = re.sub(r"^on\s+", "", cleaned, flags=re.I).strip()
    if cleaned:
        out["company"] = cleaned

    return out


def extract_date(full_text: str) -> str | None:
    """First MM/DD/YYYY line near top of body — usually right after post-type label."""
    # Lines near top: ['<title>', '<type>', '<MM/DD/YYYY>', ...]
    for line in full_text.splitlines()[:8]:
        line = line.strip()
        m = re.fullmatch(r"(\d{2}/\d{2}/\d{4})", line)
        if m:
            return parse_us_date(m.group(1))
    return None


def extract_initiate_fields(full_text: str) -> dict[str, Any]:
    """Pull entry_price / take_profit / stop_loss / weight from the post body."""
    out: dict[str, Any] = {
        "entry_price": None,
        "take_profit": None,
        "stop_loss": None,
        "weight": None,
    }

    # Entry: prefer the structured "Entry: $X" line at the bottom; fallback to
    # "initiating a trade in ... at X.XX"
    m = re.search(r"^Entry:\s*\$?([\d,]+\.?\d*)\s*$", full_text, re.MULTILINE)
    if m:
        out["entry_price"] = float(m.group(1).replace(",", ""))
    else:
        m = re.search(r"initiating a trade in[^\n]+?\sat\s\$?([\d,]+\.?\d*)", full_text, re.I)
        if m:
            out["entry_price"] = float(m.group(1).replace(",", ""))

    # Take Profit — prefer the structured bottom-of-post line ("Take Profit
    # (TP): $59, $62, and $67.50") which is line-bounded and unambiguous.
    # Fall back to the prose form ("Our N take profit levels are ...") but
    # sentence-bound it so the trailing "we'll re-evaluate around $X" stop
    # loss doesn't leak in as a 4th take_profit value.
    m = re.search(
        r"^Take\s*Profit(?:\s*\(TP\))?\s*:?\s*([^\n]+)$",
        full_text,
        re.MULTILINE | re.IGNORECASE,
    )
    if not m:
        m = re.search(
            r"Our\s+\d+\s+take\s+profit\s+levels?\s+are\s*:?\s*([^.\n]+)",
            full_text,
            re.IGNORECASE,
        )
    if m:
        tps_raw = re.findall(r"\$?([\d,]+\.?\d*)", m.group(1))
        tps = []
        for x in tps_raw:
            f = float(x.replace(",", ""))
            tps.append(int(f) if f == int(f) else f)
        out["take_profit"] = tps or None

    # Stop Loss — Suggested Stop Loss / Stop Loss / re-evaluate around
    m = re.search(
        r"(?:Suggested\s+Stop\s+Loss(?:\s*\(SL\))?|Stop\s+Loss|re-?evaluate\s+the\s+position\s+around)\s*:?\s*\$?([\d,]+\.?\d*)",
        full_text,
        re.I,
    )
    if m:
        out["stop_loss"] = float(m.group(1).replace(",", ""))

    # Weight — explicit "Weight Allocation: N" line, fallback to "weight allocation of N"
    m = re.search(r"Weight\s+Allocation\s*:?\s*(\d+)", full_text, re.I)
    if not m:
        m = re.search(r"weight\s+allocation\s+of\s+(\d+)", full_text, re.I)
    if m:
        out["weight"] = int(m.group(1))

    return out


def extract_close_fields(full_text: str) -> dict[str, Any]:
    """Pull close_price / entry_price / entry_date from a closing post body."""
    out: dict[str, Any] = {
        "close_price": None,
        "entry_price": None,
        "entry_date": None,
    }

    # Close price: "closing our position in ... at $530.63"
    m = re.search(
        r"closing\s+(?:our\s+)?position\s+in[^\n]+?\sat\s\$?([\d,]+\.?\d*)",
        full_text,
        re.I,
    )
    if m:
        out["close_price"] = float(m.group(1).replace(",", ""))

    # Entry: "This trade was entered on March 24, 2026 at $579.51"
    m = re.search(
        r"(?:This\s+trade\s+was\s+entered|trade\s+was\s+initially\s+entered|entered)\s+on\s+"
        r"([A-Z][a-z]+\s+\d{1,2},\s+\d{4})"
        r"\s+at\s+\$?([\d,]+\.?\d*)",
        full_text,
        re.I,
    )
    if m:
        out["entry_date"] = parse_us_date(m.group(1))
        out["entry_price"] = float(m.group(2).replace(",", ""))

    return out


def strip_footer(full_text: str) -> str:
    """Trim everything from the first comment-footer marker onward."""
    earliest = len(full_text)
    for marker in COMMENT_FOOTER_MARKERS:
        idx = full_text.find(marker)
        if idx != -1 and idx < earliest:
            earliest = idx
    return full_text[:earliest].rstrip()


def slug_from_url(url: str) -> str | None:
    m = re.search(r"/news-feed/([^/?#]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"/(?:the-macro-report|premium-video)/([^/?#]+)", url)
    if m:
        return m.group(1)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--extract-path", required=True)
    args = ap.parse_args()

    extract = json.loads(Path(args.extract_path).read_text(encoding="utf-8"))

    auth = extract.get("auth_state", {})
    if not auth.get("logged_in", False):
        print(
            "ERROR: extract reports logged_in=False — Bravos session expired "
            "or marketing page captured. Re-login required.",
            file=sys.stderr,
        )
        print(json.dumps({"auth_state": auth}, indent=2), file=sys.stderr)
        return 2

    url = extract.get("url", "")
    full_text = extract.get("full_text", "")
    h1 = extract.get("h1") or extract.get("title", "").rsplit(" - Bravos Research", 1)[0]
    post_type_detected = extract.get("post_type_detected")

    h1_meta = extract_h1_meta(h1)
    date_iso = extract_date(full_text)
    slug = slug_from_url(url)
    post_type = POST_TYPE_BY_DETECTED.get(post_type_detected, "unknown")

    # Title cleanup: drop nbsp etc.
    title_clean = h1.replace(" ", " ").strip() if h1 else None

    frontmatter: dict[str, Any] = {
        "type": post_type,
        "date": date_iso,
        "slug": slug,
        "ticker": h1_meta["ticker"],
        "action": h1_meta["action"],
        "company": h1_meta["company"],
        "title": title_clean,
        "source_url": url,
        # Initiate-type:
        "entry_price": None,
        "take_profit": None,
        "stop_loss": None,
        "weight": None,
        # Close-type:
        "close_price": None,
        "entry_date": None,
    }

    # Branch on action: initiate vs close
    if h1_meta["action"] in ("LONG", "SHORT"):
        frontmatter.update(extract_initiate_fields(full_text))
    elif h1_meta["action"] == "closing":
        frontmatter.update(extract_close_fields(full_text))
    # exposure-increase / profit-booking / exposure-reduce: per-event fields
    # could be added later if the routine cares — they're a mix of close-like
    # (mention an entry-date for history) and initiate-like (new price level
    # for the action).

    raw_body = strip_footer(full_text)

    out = {"frontmatter": frontmatter, "raw_body_text": raw_body}
    json.dump(out, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
