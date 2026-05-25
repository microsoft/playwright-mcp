"""bravos_research_parse — parse atoms 1+2+3 from a Playwright MCP extract.

Input:  a JSON file written by `mcp__playwright__browser_evaluate(filename=…)`
        containing at minimum:
          - full_text  : str (document.body.innerText of bravosresearch.com/research/)
          - post_links : list of {href, text}  (a[href*="/news-feed/"] survivors)
          - auth_state : object with logged_in:bool

Output (stdout JSON):
  {
    "tactical_signal":      <atom 1: same shape pm-bravos-sync writes to
                              tactical-signal/YYYY-MM-DD.json>,
    "active_trade_ideas":   <atom 2: same shape pm-bravos-sync writes to
                              active-trade-ideas/YYYY-MM-DD.json — the
                              v1.6 canonical ati-snapshot body>,
    "latest_posts":         <atom 3: deduped post URL list, slug-extracted>
  }

This script is part of the PBPM (pm-bravos-sync → Playwright MCP) migration
substrate. M1 pilot validation reuses it across the 3-fire parallel-run gate;
M2/M3 lift it into pm-bravos-sync's daily flow as the replacement for the
existing Claude_in_Chrome `get_page_text` Step 2.

Usage:
  python bravos_research_parse.py \
    --extract-path .playwright-mcp/bravos-research-m1-extract.json \
    --snapshot-date-et 2026-05-24
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Canonical asset-class enum — must match the v1.6 ati-snapshot schema lock
# (see portfolio-mgmt/routines/pm-bravos-sync.md § "Canonical asset_class enum").
ASSET_CLASS_HEADER_TO_ENUM = {
    "EQUITIES": "equities",
    "INDIVIDUAL STOCKS": "individual_stocks",
    "COMMODITIES": "commodities",
    "BONDS": "bonds",
    "DIGITAL ASSETS": "digital_assets",
}

# A row in the Active Trade Ideas table renders as 3 consecutive innerText
# lines: COMPANY ($SYMBOL) / LONG / WEIGHT. Match the company-with-ticker.
ATI_ROW_HEADER_RE = re.compile(r"^(.+?)\s*\((\$[A-Z0-9.\-]+)\)\s*$")


def parse_us_date(s: str) -> str:
    """Convert 'MM/DD/YYYY' to 'YYYY-MM-DD' (canonical schema format)."""
    return datetime.strptime(s.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")


def parse_tactical_signal(text: str) -> dict[str, Any]:
    """Atom 1 — tactical-signal-snapshot."""
    # Locate the Tactical Signal Model block bounded by the next major header.
    block_re = re.compile(
        r"Tactical Signal Model\s*(.*?)\s*(?:Active Trade Ideas|Latest Posts|$)",
        re.DOTALL,
    )
    m = block_re.search(text)
    if not m:
        raise ValueError("Tactical Signal Model block not found")
    block = m.group(1)

    # last_changed_date — "Last updated: MM/DD/YYYY"
    m = re.search(r"Last updated:\s*(\d{2}/\d{2}/\d{4})", block)
    if not m:
        raise ValueError("'Last updated' field not found in tactical signal block")
    last_changed_date = parse_us_date(m.group(1))

    # current signal — line immediately after "CURRENT SIGNAL"
    m = re.search(r"CURRENT SIGNAL\s*\n\s*(\w+)", block)
    if not m:
        raise ValueError("CURRENT SIGNAL value not found")
    signal = m.group(1).upper()

    # previous signal — "Previous signal: VALUE"
    m = re.search(r"Previous signal:\s*(\w+)", block)
    previous_signal = m.group(1).upper() if m else None

    # signal history — repeating (MM/DD/YYYY, value) lines
    history_re = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s*\n\s*(Aggressive|Moderate|Cash)", re.IGNORECASE
    )
    history = [
        {"date": parse_us_date(d), "signal": s.upper()}
        for d, s in history_re.findall(block)
    ]

    # INSTRUMENTS block — comma-of-newlines list ending at "leverage" line
    instr_match = re.search(
        r"INSTRUMENTS\s*\n((?:[A-Z0-9]+\s*\n)+)([A-Za-z].*?leverage)",
        block,
    )
    instruments: list[str] = []
    leverage_note: str | None = None
    if instr_match:
        instruments = [
            x.strip() for x in instr_match.group(1).strip().splitlines() if x.strip()
        ]
        # leverage_note in truth-set drops trailing " leverage" word
        leverage_note = (
            instr_match.group(2).strip().removesuffix(" leverage").strip() or None
        )

    return {
        # snapshot_date_et is injected by caller
        "signal": signal,
        "last_changed_date": last_changed_date,
        "previous_signal": previous_signal,
        "instruments": instruments,
        "leverage_note": leverage_note,
        "signal_history_visible": history,
    }


def parse_active_trade_ideas(text: str, snapshot_date_et: str) -> dict[str, Any]:
    """Atom 2 — v1.6 canonical ati-snapshot body."""
    block_re = re.compile(
        r"Active Trade Ideas\s*\n+Last updated on:\s*(\d{2}/\d{2}/\d{4})\s*"
        r"(.*?)(?:Maximum Sum of Weights|Trade Journal|Latest Posts|$)",
        re.DOTALL,
    )
    m = block_re.search(text)
    if not m:
        raise ValueError("Active Trade Ideas block not found")
    source_last_updated_at_bravos = parse_us_date(m.group(1))
    body = m.group(2)

    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    # Drop the leading "ASSET ACTION WEIGHT" header trio
    header_idx = None
    for i, ln in enumerate(lines):
        if ln == "ASSET" and lines[i + 1 : i + 3] == ["ACTION", "WEIGHT"]:
            header_idx = i
            break
    if header_idx is not None:
        lines = lines[header_idx + 3 :]

    positions: list[dict[str, Any]] = []
    current_class: str | None = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln in ASSET_CLASS_HEADER_TO_ENUM:
            current_class = ASSET_CLASS_HEADER_TO_ENUM[ln]
            i += 1
            continue
        # Position row: COMPANY ($SYM) / LONG / WEIGHT
        row_match = ATI_ROW_HEADER_RE.match(ln)
        if row_match and i + 2 < len(lines):
            action_line = lines[i + 1].upper()
            weight_line = lines[i + 2]
            if action_line in ("LONG", "SHORT") and re.fullmatch(r"\d+", weight_line):
                company_raw = row_match.group(1).strip()
                symbol = row_match.group(2).lstrip("$").upper()
                # Title-case company while preserving common all-caps acronyms
                company = _company_titlecase(company_raw)
                positions.append(
                    {
                        "symbol": symbol,
                        "company": company,
                        "action": action_line,
                        "weight": int(weight_line),
                        "asset_class": current_class or "individual_stocks",
                        "picked": None,
                        "note": None,
                    }
                )
                i += 3
                continue
        i += 1

    actual_weight_sum = sum(p["weight"] for p in positions)
    asset_count = len(positions)

    by_class: dict[str, int] = {v: 0 for v in ASSET_CLASS_HEADER_TO_ENUM.values()}
    for p in positions:
        by_class[p["asset_class"]] = by_class.get(p["asset_class"], 0) + 1

    return {
        "snapshot_date_et": snapshot_date_et,
        "source_last_updated_at_bravos": source_last_updated_at_bravos,
        "max_weight_sum": 100,
        "actual_weight_sum": actual_weight_sum,
        "implied_cash_position": 100 - actual_weight_sum,
        "asset_count": asset_count,
        "asset_count_by_class": by_class,
        "positions": positions,
    }


def _company_titlecase(company: str) -> str:
    """Best-effort title-case for ATI company names.

    Bravos renders names UPPERCASE; truth-set stores them with brand acronyms
    preserved and common suffixes title-cased. Approach: explicit
    KEEP_UPPER whitelist of known acronyms (extend as new ones surface);
    BRAND_CASE_MAP for case-irregular brands (iShares, ProShares); anything
    else title-cases via .capitalize().
    """
    KEEP_UPPER = {
        # Fund/issuer abbreviations
        "ETF", "ETN", "PLC", "SPDR", "MSCI", "ADR", "SA",
        # Asset-class shorthand sometimes embedded in company name
        "USD", "EUR", "GBP",
        # Brand acronyms / single-word tickers that are also the company name
        "ASML", "AMD", "IBM", "GE", "GM", "DB", "JP", "JPM", "BNY", "AT", "AB",
        "CVS", "YPF", "BNP", "UBS",
        # Direction/structure
        "S&P", "SP", "20+", "30+", "10+",
    }
    # Bravos renders these brand names ALL-CAPS but truth-set carries
    # source-correct mixed case (issuer brand convention).
    BRAND_CASE_MAP = {
        "ISHARES": "iShares",
        "PROSHARES": "ProShares",
        "POWERSHARES": "PowerShares",
        "ULTRASHORT": "UltraShort",
        "VANGUARD": "Vanguard",
        "VANECK": "VanEck",
        "EBAY": "eBay",
        "PAYPAL": "PayPal",
        "MACKINTOSH": "Mackintosh",
    }

    out = []
    for word in company.split():
        bare = word.strip(",.;:!?'\"()")
        suffix = word[len(bare) :] if word.endswith(word[len(bare) :]) else ""
        # rebuild suffix safely
        suffix = ""
        for ch in reversed(word):
            if ch in ",.;:!?'\"()":
                suffix = ch + suffix
            else:
                break

        if bare.upper() in BRAND_CASE_MAP:
            out.append(BRAND_CASE_MAP[bare.upper()] + suffix)
        elif bare.upper() in KEEP_UPPER:
            out.append(bare.upper() + suffix)
        else:
            # Title-case for everything else; .capitalize() lowercases the
            # tail, which is what we want for FUND -> Fund, INC -> Inc.
            out.append(bare.capitalize() + suffix)
    return " ".join(out)


def parse_latest_posts(post_links: list[dict[str, str]]) -> list[dict[str, str]]:
    """Atom 3 — dedupe + slug-extract the news-feed URL list.

    The truth-set canonical for atom 3 is the `seen_post_slugs` list in
    sync-state.json. We emit the slug list rendered identically.
    """
    out = []
    for link in post_links:
        href = link.get("href", "")
        m = re.match(
            r"https://bravosresearch\.com/news-feed/([^/?#]+)/?",
            href,
        )
        if not m:
            continue
        out.append({"slug": m.group(1), "href": href, "card_text": link.get("text", "")})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--extract-path",
        required=True,
        help="Path to the JSON file written by browser_evaluate(filename=...)",
    )
    ap.add_argument(
        "--snapshot-date-et",
        required=True,
        help="YYYY-MM-DD ET date of THIS extraction fire (matches truth-set filename)",
    )
    args = ap.parse_args()

    extract = json.loads(Path(args.extract_path).read_text(encoding="utf-8"))

    auth = extract.get("auth_state", {})
    if not auth.get("logged_in", False):
        print(
            "ERROR: extract reports logged_in=False — Bravos session expired or "
            "marketing page was captured. Surface to Cannon for re-login.",
            file=sys.stderr,
        )
        print(json.dumps({"auth_state": auth}, indent=2), file=sys.stderr)
        return 2

    full_text = extract["full_text"]
    post_links = extract.get("post_links", [])

    tactical_signal = parse_tactical_signal(full_text)
    tactical_signal["snapshot_date_et"] = args.snapshot_date_et

    ati = parse_active_trade_ideas(full_text, args.snapshot_date_et)

    # tactical_signal_at_capture cross-reference (optional v1.6 field)
    ati["tactical_signal_at_capture"] = tactical_signal["signal"]

    latest_posts = parse_latest_posts(post_links)

    print(
        json.dumps(
            {
                "tactical_signal": tactical_signal,
                "active_trade_ideas": ati,
                "latest_posts": latest_posts,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
