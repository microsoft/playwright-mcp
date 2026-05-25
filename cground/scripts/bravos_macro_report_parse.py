"""bravos_macro_report_parse — parse atom 9 (macro-report) from a Playwright extract.

Input:  a JSON file written by `mcp__playwright__browser_evaluate(filename=…)`
        for a `bravosresearch.com/the-macro-report/{slug}/` page.

Output (stdout JSON):
  {
    "frontmatter": {
      "type":          "macro-report",
      "date":          "YYYY-MM-DD",      # Bravos pub date, parsed from page top
      "slug":          "...",
      "title":         "...",             # H1 minus " - Bravos Research" suffix
      "source_url":    "https://bravosresearch.com/the-macro-report/.../",
    },
    "raw_body_text": "..."   # full_text minus the title/date header + footer
  }

Macro-report page shape (validated 2026-05-25 on `commodities-have-come-
roaring-back-and-it-may-be-just-the-beginning`):
  - Page title: H1 + " - Bravos Research"
  - First text line: pub date in "Mon DD, YYYY" format ("Mar 13, 2026")
  - Second text line: H1 / report title
  - "Share:" link
  - Body prose (no further structured metadata)
  - No PDF links (Special Reports DO have them; macro-reports don't)

Sibling parser to `bravos_news_feed_post_parse.py` — the page shape is
distinct enough (no Trade Alert / Premium Video type label, no
ticker/action/weight, different date format) that a separate parser is
cleaner than branching the news-feed parser by URL pattern.

PBPM-M3.6 — 2026-05-25.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Body footer markers — strip everything from these onward.
# Macro-reports tack a subscription pitch + "Popular Posts" sidebar onto
# the bottom of the article. The cleanest cut is at the earliest of:
#   - "Subscribing gives you ACCESS to:"  (subscription pitch)
#   - "Newsletter Sign Up"
#   - "Popular Posts"  (sidebar related-articles)
#   - The standard comment-thread markers (same as news-feed posts)
COMMENT_FOOTER_MARKERS = [
    "Subscribing gives you ACCESS to:",
    "Newsletter Sign Up",
    "Popular Posts",
    "What didn't you like?",
    "CANCEL REPLY",
    "Leave a Reply",
    "Comment *",
]

# Pub-date pattern at top of body: "Mar 13, 2026" or "March 13, 2026"
DATE_LINE_RE = re.compile(
    r"^([A-Z][a-z]{2,8})\s+(\d{1,2}),\s+(\d{4})\s*$",
    re.MULTILINE,
)


def parse_pub_date(date_str: str) -> str | None:
    """Convert 'Mar 13, 2026' or 'March 13, 2026' to '2026-03-13'."""
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def slug_from_url(url: str) -> str | None:
    m = re.search(r"/the-macro-report/([^/?#]+)", url)
    if m:
        return m.group(1)
    return None


def extract_pub_date(full_text: str) -> str | None:
    """Find the first 'Mon DD, YYYY' line at top of body."""
    # Look in first ~10 non-empty lines
    lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()][:10]
    for line in lines:
        m = re.fullmatch(r"([A-Z][a-z]{2,8})\s+(\d{1,2}),\s+(\d{4})", line)
        if m:
            return parse_pub_date(line)
    return None


def strip_footer(full_text: str) -> str:
    """Trim everything from the first comment-footer marker onward."""
    earliest = len(full_text)
    for marker in COMMENT_FOOTER_MARKERS:
        idx = full_text.find(marker)
        if idx != -1 and idx < earliest:
            earliest = idx
    return full_text[:earliest].rstrip()


def strip_header(full_text: str, title: str | None) -> str:
    """Drop the date + title + "Share:" lines from the top of the body so
    raw_body_text starts with the actual report prose."""
    lines = full_text.splitlines()
    # Skip leading blanks
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    # Skip date line if it's a pub-date
    if i < len(lines) and re.fullmatch(r"\s*[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s*", lines[i]):
        i += 1
    # Skip title line if present
    if i < len(lines) and title and lines[i].strip() == title.strip():
        i += 1
    # Skip "Share:" line
    while i < len(lines) and (not lines[i].strip() or re.match(r"\s*Share\s*:?\s*$", lines[i])):
        i += 1
    return "\n".join(lines[i:])


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
    date_iso = extract_pub_date(full_text)

    frontmatter: dict[str, Any] = {
        "type": "macro-report",
        "date": date_iso,
        "slug": slug,
        "title": title_clean,
        "source_url": url,
    }

    raw_body = strip_footer(full_text)
    raw_body = strip_header(raw_body, title_clean)

    out = {"frontmatter": frontmatter, "raw_body_text": raw_body}
    # ensure_ascii=True for portability (Windows cp1252 stdout chokes on
    # smart quotes etc. that Bravos page text contains)
    json.dump(out, sys.stdout, indent=2, ensure_ascii=True)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
