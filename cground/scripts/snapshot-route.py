#!/usr/bin/env python3
"""
Recommend a Playwright MCP browser_snapshot target/selector for a given URL.

Reads cground/snapshot-routing.yml (sibling-of-sibling), matches the URL
against fnmatch patterns top-to-bottom, prints the recommended target.

Usage:
    python cground/scripts/snapshot-route.py <url>

Output (stdout, single line):
    The recommended `target` value to pass to browser_snapshot, e.g.:
        article
        main
        [role=main]
        e62

Exit codes:
    0 = matched (the default "*" route guarantees a match)
    1 = config file missing / malformed / no route matched (shouldn't happen)
    2 = bad CLI usage

Typical agent workflow:
    target=$(python cground/playwright-connector/cground/scripts/snapshot-route.py "$URL")
    # then call: browser_snapshot(target="$target", filename=".playwright-mcp/scoped.yml")

See sibling `../snapshot-routing.yml` for the routing rules and how to
extend them.
"""

from __future__ import annotations

import fnmatch
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("error: PyYAML required (pip install pyyaml)", file=sys.stderr)
    sys.exit(1)


def resolve_config_path() -> Path:
    return Path(__file__).resolve().parent.parent / "snapshot-routing.yml"


def recommend_target(url: str, config_path: Path) -> str | None:
    if not config_path.exists():
        return None
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    for route in config.get("routes", []):
        if fnmatch.fnmatch(url, route["match"]):
            return route["target"]
    return None


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: snapshot-route.py <url>", file=sys.stderr)
        return 2
    url = argv[1]
    config_path = resolve_config_path()
    target = recommend_target(url, config_path)
    if target is None:
        if not config_path.exists():
            print(f"error: routing config not found at {config_path}", file=sys.stderr)
        else:
            print(f"error: no route matched url '{url}' (the default '*' should always catch — check config)", file=sys.stderr)
        return 1
    print(target)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
