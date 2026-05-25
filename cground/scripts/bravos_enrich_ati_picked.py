"""bravos_enrich_ati_picked — fill positions[].picked from the same-day ideas-archive.

The Bravos `/research/` page renders Active Trade Ideas without per-position
pick dates; those dates live on the separate `/ideas/` page (atom 11), which
the routine captures as a sibling artifact. This helper joins the two on
ticker symbol so the parser's pure-extractor output can be promoted to the
truth-set shape that downstream consumers (CannonAI Bravos overlay etc.) read.

PBPM-M2 design ratification (2026-05-24): option (d) — cross-ref from
same-day ideas-archive atom — wins over (a) tooltip-hover (18 extra
browser_hover calls), (b) trade-alerts archive cross-ref (coverage gap for
pre-2026-04-29 positions like ALUM 2025-12-19, LIN 2026-03-12), (c) accept
null + drop from schema (loses data). Empirical: 18/18 picked dates match
between same-day truth-set ATI + truth-set ideas-archive on 2026-05-24.

Inputs:
  --ati-path           parser-emitted ATI JSON (v1.6 ati-snapshot body);
                       positions[].picked is expected to be null going in
  --ideas-archive-path canonical /ideas/ JSON; must have
                       active: [{symbol, picked, ...}]

Output (stdout): the enriched ATI body, ready to feed
  `bravos_write_artifact.py type=ati-snapshot --body-path -` for canonical
  archival.

Behavior:
  - For each position in --ati-path, look up symbol in
    ideas-archive.active[] by exact symbol match (case-sensitive); set
    picked to the matched date.
  - Positions with no match in ideas-archive keep picked=null. Surface a
    WARN on stderr listing un-matched symbols (suggests either a stale
    ideas-archive or a new ATI add Bravos hasn't propagated to /ideas/
    yet — normal during the brief CMS-lag window).
  - Refuses if --ati-path and --ideas-archive-path have different
    snapshot_date_et (would be cross-day enrichment, defeats the purpose).
    Override with --allow-cross-day if you really want that.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ati-path", required=True)
    ap.add_argument("--ideas-archive-path", required=True)
    ap.add_argument(
        "--allow-cross-day",
        action="store_true",
        help="Skip the snapshot_date_et match check (default refuses).",
    )
    args = ap.parse_args()

    ati: dict[str, Any] = json.loads(Path(args.ati_path).read_text(encoding="utf-8"))
    ia: dict[str, Any] = json.loads(
        Path(args.ideas_archive_path).read_text(encoding="utf-8")
    )

    ati_date = ati.get("snapshot_date_et")
    ia_date = ia.get("snapshot_date_et")
    if ati_date != ia_date and not args.allow_cross_day:
        print(
            f"ERROR: snapshot_date_et mismatch — ati={ati_date!r} "
            f"ideas-archive={ia_date!r}. Cross-day enrichment defeats the "
            f"point. Pass --allow-cross-day to override.",
            file=sys.stderr,
        )
        return 2

    by_sym = {p["symbol"]: p for p in ia.get("active", []) if "symbol" in p}

    enriched_count = 0
    unmatched: list[str] = []
    for pos in ati.get("positions", []):
        sym = pos.get("symbol")
        if sym in by_sym:
            picked = by_sym[sym].get("picked")
            if picked:
                pos["picked"] = picked
                enriched_count += 1
            # else: ideas-archive has the symbol but no picked date — leave null
        else:
            unmatched.append(sym)

    if unmatched:
        print(
            f"WARN: {len(unmatched)} ATI position(s) absent from ideas-archive "
            f"(picked stays null): {unmatched}. Usual cause: brief CMS-lag "
            f"between Bravos publishing a new ATI add and /ideas/ "
            f"propagating it. Re-fire next routine cycle.",
            file=sys.stderr,
        )

    total = len(ati.get("positions", []))
    print(
        f"OK: enriched {enriched_count}/{total} positions with picked dates "
        f"from {args.ideas_archive_path}",
        file=sys.stderr,
    )

    json.dump(ati, sys.stdout, indent=2)
    print()  # trailing newline
    return 0


if __name__ == "__main__":
    sys.exit(main())
