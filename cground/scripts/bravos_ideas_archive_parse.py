"""bravos_ideas_archive_parse — parse atom 11 (/ideas/) from a Playwright extract.

Input:  a JSON file written by `mcp__playwright__browser_evaluate(filename=…)`
        containing at minimum:
          - full_text  : str (document.body.innerText of bravosresearch.com/ideas/)
          - auth_state : object with logged_in:bool

Output (stdout JSON, matches the v1.6 truth-set shape used by
pm-bravos-sync's existing Claude_in_Chrome flow):
  {
    "snapshot_date_et":  "YYYY-MM-DD",
    "active_count":      int,
    "active": [
      {"name": "...", "symbol": "...", "direction": "Long|Short", "picked": "YYYY-MM-DD"},
      ...
    ],
    "closed_by_year": {"2026": int, "2025": int, ...}   # COUNT per year, NOT lists
  }

Schema note: the routine doc § "Ideas archive (Atom 11)" says
closed_by_year should be lists, but the actual truth-set today carries
counts (lossy compression to save space — 173 closed entries × N daily
atoms = bloat). Parser matches truth-set shape; routine doc drift to
fix separately. If full lists are wanted, set --closed-as-lists.

Correctness note: PBPM-M2 fire 1/3 (2026-05-24) surfaced that the
existing truth-set closed_by_year counts UNDER-COUNT the page reality
significantly (truth 2026=19 / 2025=79 / 2024=72 / 2023=3 vs page
61 / 157 / 100 / 4). Cause: the prior routine output was a routine-
side view ("closures the routine observed via news-feed crawl") not
a page-side count ("all closures Bravos lists"). The parser SUPERSEDES
the previous truth-set on closed_by_year — the page is the more
authoritative source. Historical pre-migration entries for
closed_by_year should be treated as under-counts of unknown
completeness.

Companion to `bravos_research_parse.py` (atoms 1+2+3) and
`bravos_enrich_ati_picked.py` (joins parsed-ATI on this parser's
output by symbol). Together they cover the page-level snapshot atoms
of pm-bravos-sync. PBPM-M2 fire 1/3 — 2026-05-24.

Usage:
  python bravos_ideas_archive_parse.py \
    --extract-path .playwright-mcp/bravos-ideas-extract.json \
    --snapshot-date-et 2026-05-24
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Entry line shapes seen on /ideas/ (from 2026-05-24 capture):
#   Long on Aluminum ($ALUM) [12/19/2025]
#   Long on DB Agriculture Fund ($DBA) - [03/31/2026]
#   Long on Chubb (CB) [12/09/2025]                 # NO $-prefix on symbol
#   Long Natera Inc. ($NTRA) - [09/05/2024]         # NO "on" connector
#   Long Natural Gas - [11/29/2024]                 # NO symbol (futures)
#   Long Solana (SOLUSD) - [11/21/2024]             # NO $-prefix
#   Short Copper Futures - [11/08/2023]             # Short + NO symbol
#   Long -1x Short VIX Futures ($SVIX)              # tricky name
#
# The regex must tolerate all of these. Symbol is optional;
# "on " connector is optional; " - " separator before date is optional.
ENTRY_RE = re.compile(
    r"^(?P<direction>Long|Short)"
    r"(?:\s+on)?\s+"
    r"(?P<name>.+?)"
    r"(?:\s+\(\$?(?P<symbol>[A-Z0-9.\-]+)\))?"
    r"(?:\s*-)?\s*"
    r"\[(?P<date>\d{2}/\d{2}/\d{4})\]\s*$",
    re.MULTILINE,
)

SECTION_HEADER_RE = re.compile(
    r"^(Active Trade Ideas|Closed Trades (\d{4}))\s*$",
    re.MULTILINE,
)


def parse_us_date(s: str) -> str:
    return datetime.strptime(s.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")


def split_sections(text: str) -> dict[str, str]:
    """Return {section_name: section_body} dict.

    Sections are bounded by SECTION_HEADER_RE matches. The text after the
    last header runs to end-of-input or until a known terminator
    ("Home\\nMemberships" footer block).
    """
    matches = list(SECTION_HEADER_RE.finditer(text))
    sections: dict[str, str] = {}
    for i, m in enumerate(matches):
        header = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[header] = text[start:end]
    # Trim the trailing footer block from the last section if present
    last_key = list(sections)[-1] if sections else None
    if last_key:
        footer_idx = sections[last_key].find("\nHome\nMemberships")
        if footer_idx != -1:
            sections[last_key] = sections[last_key][:footer_idx]
    return sections


def parse_entries(section_body: str) -> list[dict[str, Any]]:
    """Parse all entry lines in a section, in source order."""
    out = []
    for m in ENTRY_RE.finditer(section_body):
        out.append(
            {
                "direction": m.group("direction"),
                "name": m.group("name").strip(),
                "symbol": m.group("symbol"),  # may be None
                "picked": parse_us_date(m.group("date")),
            }
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--extract-path", required=True)
    ap.add_argument("--snapshot-date-et", required=True)
    ap.add_argument(
        "--closed-as-lists",
        action="store_true",
        help="Emit closed_by_year as lists-of-entries instead of counts "
        "(matches the routine-doc schema; default emits counts matching "
        "the current truth-set shape).",
    )
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

    full_text = extract["full_text"]
    sections = split_sections(full_text)

    if "Active Trade Ideas" not in sections:
        print(
            "ERROR: 'Active Trade Ideas' section header not found in extract.",
            file=sys.stderr,
        )
        return 3

    active_raw = parse_entries(sections["Active Trade Ideas"])
    # Active entries must all have symbols (truth-set invariant)
    active = [
        {
            "name": e["name"],
            "symbol": e["symbol"],
            "direction": e["direction"],
            "picked": e["picked"],
        }
        for e in active_raw
        if e["symbol"] is not None
    ]
    active_without_symbol = [e for e in active_raw if e["symbol"] is None]
    if active_without_symbol:
        print(
            f"WARN: {len(active_without_symbol)} active entries had no symbol "
            f"and were dropped: {[e['name'] for e in active_without_symbol]}",
            file=sys.stderr,
        )

    closed_by_year: dict[str, Any] = {}
    for section_name, body in sections.items():
        m = re.match(r"Closed Trades (\d{4})", section_name)
        if not m:
            continue
        year = m.group(1)
        entries = parse_entries(body)
        if args.closed_as_lists:
            closed_by_year[year] = [
                {
                    "name": e["name"],
                    "symbol": e["symbol"],
                    "direction": e["direction"],
                    "closed": e["picked"],  # "picked" is the parsed date — closed-date in this section
                }
                for e in entries
            ]
        else:
            closed_by_year[year] = len(entries)

    out = {
        "snapshot_date_et": args.snapshot_date_et,
        "active_count": len(active),
        "active": active,
        "closed_by_year": closed_by_year,
    }
    json.dump(out, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
