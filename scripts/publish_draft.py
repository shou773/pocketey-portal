#!/usr/bin/env python3
import datetime as dt
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
NEWS_DIR = (ROOT / "src" / "content" / "news").resolve()


def japan_today():
    jst = dt.timezone(dt.timedelta(hours=9))
    return dt.datetime.now(dt.timezone.utc).astimezone(jst).date().isoformat()


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/publish_draft.py src/content/news/<draft>.md", file=sys.stderr)
        return 2

    requested = pathlib.Path(sys.argv[1])
    path = (ROOT / requested).resolve() if not requested.is_absolute() else requested.resolve()
    try:
        path.relative_to(NEWS_DIR)
    except ValueError:
        print("Refusing to publish a file outside src/content/news.", file=sys.stderr)
        return 3

    if not path.exists() or path.suffix not in (".md", ".mdx"):
        print(f"Draft not found: {path}", file=sys.stderr)
        return 4

    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        print("Draft has no YAML frontmatter.", file=sys.stderr)
        return 5

    end = text.find("\n---\n", 4)
    if end < 0:
        print("Draft frontmatter is malformed.", file=sys.stderr)
        return 6

    frontmatter = text[4:end]
    body = text[end + 5:]

    if not re.search(r"(?m)^draft:\s*true\s*$", frontmatter):
        print("This file is not an unpublished draft (draft: true).", file=sys.stderr)
        return 7

    source_match = re.search(r'(?m)^sourceUrl:\s*["\']?(https://[^"\'\s]+)', frontmatter)
    if not source_match:
        print("A verified HTTPS sourceUrl is required before publication.", file=sys.stderr)
        return 8

    frontmatter = re.sub(r"(?m)^draft:\s*true\s*$", "draft: false", frontmatter, count=1)
    if re.search(r"(?m)^reviewStatus:\s*", frontmatter):
        frontmatter = re.sub(
            r'(?m)^reviewStatus:\s*.*$',
            'reviewStatus: "approved"',
            frontmatter,
            count=1,
        )
    else:
        frontmatter = frontmatter.replace("draft: false", 'draft: false\nreviewStatus: "approved"', 1)

    today = japan_today()
    if re.search(r"(?m)^updated:\s*", frontmatter):
        frontmatter = re.sub(r"(?m)^updated:\s*.*$", f"updated: {today}", frontmatter, count=1)
    else:
        frontmatter += f"\nupdated: {today}"

    path.write_text("---\n" + frontmatter + "\n---\n" + body, encoding="utf-8")
    print(f"Approved for publication: {path.relative_to(ROOT)}")
    print(f"Source: {source_match.group(1)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
