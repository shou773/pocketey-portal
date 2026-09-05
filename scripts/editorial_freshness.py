#!/usr/bin/env python3
import datetime as dt
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
NEWS_DIR = ROOT / "src" / "content" / "news"


def parse_frontmatter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text, None
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text, None
    block = text[4:end]
    data = {}
    for line in block.splitlines():
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
    return data, text, end


def yaml_string(value):
    return json.dumps(str(value), ensure_ascii=False)


def patch_frontmatter(path, time_sensitive, expires_at):
    _, text, end = parse_frontmatter(path)
    if end is None:
        return False

    block = text[4:end]
    lines = []
    for line in block.splitlines():
        key = line.split(":", 1)[0].strip() if ":" in line else ""
        if key in {"timeSensitive", "expiresAt"}:
            continue
        lines.append(line)

    lines.append(f"timeSensitive: {'true' if time_sensitive else 'false'}")
    if expires_at:
        lines.append(f"expiresAt: {yaml_string(expires_at)}")

    new_text = "---\n" + "\n".join(lines) + text[end:]
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def expiry_for(meta):
    basis = str(meta.get("updated") or meta.get("date") or "")[:10]
    try:
        day = dt.date.fromisoformat(basis)
    except ValueError:
        return None
    # Weather/disruption stories remain current through the following day,
    # then leave "Latest" surfaces while the article URL remains available.
    expires_day = day + dt.timedelta(days=2)
    return f"{expires_day.isoformat()}T00:00:00+09:00"


def main():
    if not NEWS_DIR.exists():
        return 0

    changed = 0
    for path in sorted(NEWS_DIR.glob("*.md*")):
        meta, _, _ = parse_frontmatter(path)
        if str(meta.get("category") or "") != "Weather & Disruptions":
            continue

        expires_at = expiry_for(meta)
        if not expires_at:
            print(f"Freshness warning: could not determine date for {path.relative_to(ROOT)}")
            continue

        # Unpublished drafts may be refreshed with newer official information;
        # recompute their expiry. Published articles keep their existing expiry
        # unless it is missing, so routine monitoring does not silently revive them.
        existing_expiry = str(meta.get("expiresAt") or "")
        is_draft = meta.get("draft") is True
        target_expiry = expires_at if is_draft or not existing_expiry else existing_expiry

        if meta.get("timeSensitive") is True and existing_expiry == target_expiry:
            continue

        if patch_frontmatter(path, True, target_expiry):
            changed += 1
            print(f"Applied time-sensitive expiry: {path.relative_to(ROOT)} -> {target_expiry}")

    print(f"Weather/disruption freshness metadata updated: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
