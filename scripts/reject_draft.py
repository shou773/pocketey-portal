#!/usr/bin/env python3
import datetime as dt
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
NEWS_DIR = (ROOT / "src" / "content" / "news").resolve()
IMAGE_DIR = (ROOT / "public" / "images" / "news").resolve()
REJECTIONS_PATH = ROOT / "data" / "editorial" / "rejections.json"


def parse_frontmatter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("Draft does not contain frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("Draft frontmatter is malformed")
    data = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        key, raw = key.strip(), raw.strip()
        if raw in ("true", "false"):
            data[key] = raw == "true"
        elif raw.startswith('"'):
            try:
                data[key] = json.loads(raw)
            except json.JSONDecodeError:
                data[key] = raw.strip('"')
        else:
            data[key] = raw
    return data


def suppression_until(choice, now):
    if choice == "permanent":
        return None, True
    days = {"30_days": 30, "90_days": 90}.get(choice)
    if days is None:
        raise ValueError("suppression must be one of: 30_days, 90_days, permanent")
    return (now + dt.timedelta(days=days)).isoformat(), False


def load_registry():
    if not REJECTIONS_PATH.exists():
        return {"rejections": []}
    try:
        payload = json.loads(REJECTIONS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        payload = {"rejections": []}
    if not isinstance(payload.get("rejections"), list):
        payload["rejections"] = []
    return payload


def main():
    if len(sys.argv) < 4:
        print("Usage: reject_draft.py <draft_path> <reason> <suppression>", file=sys.stderr)
        return 2

    supplied_path = pathlib.Path(sys.argv[1])
    reason = str(sys.argv[2] or "").strip() or "Rejected during human review"
    suppression = str(sys.argv[3] or "90_days").strip()

    draft_path = (ROOT / supplied_path).resolve() if not supplied_path.is_absolute() else supplied_path.resolve()
    try:
        draft_path.relative_to(NEWS_DIR)
    except ValueError:
        print("Refusing to reject a file outside src/content/news.", file=sys.stderr)
        return 2
    if not draft_path.exists() or draft_path.suffix not in {".md", ".mdx"}:
        print("Draft file does not exist or is not Markdown.", file=sys.stderr)
        return 2

    meta = parse_frontmatter(draft_path)
    if meta.get("draft") is not True:
        print("Refusing to reject an article that is not an unpublished draft.", file=sys.stderr)
        return 2

    event_key = str(meta.get("eventKey") or "").strip()
    if not event_key:
        print("Draft has no eventKey; rejection suppression cannot be recorded safely.", file=sys.stderr)
        return 2

    now = dt.datetime.now(dt.timezone.utc)
    until, permanent = suppression_until(suppression, now)

    registry = load_registry()
    registry["rejections"] = [
        item for item in registry["rejections"]
        if str(item.get("event_key") or "") != event_key
    ]
    registry["rejections"].append({
        "event_key": event_key,
        "title": str(meta.get("title") or draft_path.stem),
        "source_url": str(meta.get("sourceUrl") or ""),
        "reason": reason,
        "rejected_at": now.isoformat(),
        "suppression": suppression,
        "suppress_until": until,
        "permanent": permanent,
    })
    registry["rejections"].sort(key=lambda item: str(item.get("rejected_at") or ""), reverse=True)
    REJECTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REJECTIONS_PATH.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    image = str(meta.get("image") or "").strip()
    if image.startswith("/images/news/"):
        image_path = (ROOT / "public" / image.lstrip("/")).resolve()
        try:
            image_path.relative_to(IMAGE_DIR)
            if image_path.exists():
                image_path.unlink()
                print(f"Removed draft image: {image_path.relative_to(ROOT)}")
        except ValueError:
            pass

    relative = draft_path.relative_to(ROOT)
    draft_path.unlink()
    print(f"Rejected and removed draft: {relative}")
    print(f"Suppressed event key: {event_key} ({suppression})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
