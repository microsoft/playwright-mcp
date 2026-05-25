"""bravos_signal_journal_parse — parse atom 10 (signal-journal) from a Playwright extract.

Input:  a JSON file written by `mcp__playwright__browser_evaluate(filename=…)`
        for a `bravosresearch.com/model-signal/{slug}/` page.

Output (stdout JSON):
  {
    "frontmatter": {
      "type":            "signal-journal",
      "date":            "YYYY-MM-DD",          # Bravos pub date (MM/DD/YYYY in body)
      "slug":            "model-signal-aggressive-2",
      "signal":          "AGGRESSIVE",          # from H1 "(Aggressive)"
      "previous_signal": "MODERATE" or null,    # from body "from X to Y"
      "title":           "Model Signal (Aggressive)",
      "source_url":      "https://bravosresearch.com/model-signal/.../"
    },
    "raw_body_text": "..."   # full_text minus header + comment-thread footer
  }

Signal-journal page shape (validated 2026-05-25 on `model-signal-aggressive-2`):
  - Page title: H1 + " - Bravos Research"
  - H1: "Model Signal (Aggressive|Moderate|Cash)" — signal value in parens
  - "Model Signal" post-type label
  - Pub date in MM/DD/YYYY format
  - Body: signal-change announcement ("The Tactical Signal Model is
    updating today from X to Y.") + boilerplate model-vs-discretionary
    explanation
  - Comment thread at bottom

Sibling parser to `bravos_news_feed_post_parse.py` + `bravos_macro_report_parse.py`.
URL pattern `/model-signal/{slug}/` is distinct from `/news-feed/`; cleaner
to ship a sibling than to branch the news-feed parser.

Slug typo note: Bravos's archive contains `model-signal-agressive` (single
'g') alongside `model-signal-aggressive` (correct). Parser handles both —
slug is read from URL as-is; signal value comes from H1 parens which uses
correct spelling.

PBPM-M3.7 — 2026-05-25.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Footer markers — same as news-feed post comments
COMMENT_FOOTER_MARKERS = [
    "What didn't you like?",
    "CANCEL REPLY",
    "Leave a Reply",
    "Comment *",
]

# Map H1-parens signal value → canonical UPPERCASE
SIGNAL_NORMALIZE = {
    "aggressive": "AGGRESSIVE",
    "moderate": "MODERATE",
    "cash": "CASH",
    # Defensive: agressive typo (Bravos's slug typo) — but H1 likely renders correctly anyway
    "agressive": "AGGRESSIVE",
}


def parse_us_date(s: str) -> str | None:
    """Convert 'MM/DD/YYYY' to 'YYYY-MM-DD'."""
    try:
        return datetime.strptime(s.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def slug_from_url(url: str) -> str | None:
    m = re.search(r"/model-signal/([^/?#]+)", url)
    return m.group(1) if m else None


def extract_signal_from_h1(h1: str) -> str | None:
    """H1 looks like 'Model Signal (Aggressive)' — pull value from parens."""
    m = re.search(r"\(([A-Za-z]+)\)", h1)
    if not m:
        return None
    return SIGNAL_NORMALIZE.get(m.group(1).lower(), m.group(1).upper())


def extract_previous_signal(full_text: str) -> str | None:
    """Body usually has 'updating today from MODERATE to AGGRESSIVE' or similar."""
    m = re.search(
        r"(?:updating|update|change|shift|move).*?from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)",
        full_text,
        re.IGNORECASE,
    )
    if m:
        return SIGNAL_NORMALIZE.get(m.group(1).lower(), m.group(1).upper())
    return None


def extract_date(full_text: str) -> str | None:
    """Find the first MM/DD/YYYY line near the top of the body."""
    for line in full_text.splitlines()[:10]:
        line = line.strip()
        m = re.fullmatch(r"(\d{2}/\d{2}/\d{4})", line)
        if m:
            return parse_us_date(m.group(1))
    return None


def strip_footer(full_text: str) -> str:
    earliest = len(full_text)
    for marker in COMMENT_FOOTER_MARKERS:
        idx = full_text.find(marker)
        if idx != -1 and idx < earliest:
            earliest = idx
    return full_text[:earliest].rstrip()


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
    h1 = extract.get("h1") or extract.get("title", "").rsplit(
        " - Bravos Research", 1
    )[0]
    title_clean = (h1 or "").replace(" ", " ").strip() or None

    slug = slug_from_url(url)
    date_iso = extract_date(full_text)
    signal = extract_signal_from_h1(h1) if h1 else None
    previous_signal = extract_previous_signal(full_text)

    frontmatter: dict[str, Any] = {
        "type": "signal-journal",
        "date": date_iso,
        "slug": slug,
        "signal": signal,
        "previous_signal": previous_signal,
        "title": title_clean,
        "source_url": url,
    }

    raw_body = strip_footer(full_text)

    out = {"frontmatter": frontmatter, "raw_body_text": raw_body}
    # ensure_ascii=True for Windows cp1252 stdout portability
    json.dump(out, sys.stdout, indent=2, ensure_ascii=True)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
