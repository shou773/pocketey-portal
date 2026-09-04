#!/usr/bin/env python3
import html
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
NEWS_DIR = ROOT / "src" / "content" / "news"
IMAGE_DIR = ROOT / "public" / "images" / "news"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

IMAGE_KEYS = {
    "image",
    "imageAlt",
    "imageCredit",
    "imageSourceUrl",
    "imageLicense",
    "imageLicenseUrl",
    "imageProvider",
    "imageContext",
    "imageStatus",
    "imageGenerated",
}


def clean_text(value):
    value = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


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
    return json.dumps(str(value or ""), ensure_ascii=False)


def patch_frontmatter(path, updates):
    meta, text, end = parse_frontmatter(path)
    if end is None:
        return False
    block = text[4:end]
    lines = []
    for line in block.splitlines():
        key = line.split(":", 1)[0].strip() if ":" in line else ""
        if key in IMAGE_KEYS:
            continue
        lines.append(line)

    for key, value in updates.items():
        if isinstance(value, bool):
            lines.append(f"{key}: {'true' if value else 'false'}")
        else:
            lines.append(f"{key}: {yaml_string(value)}")

    new_text = "---\n" + "\n".join(lines) + text[end:]
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def meta_value(extmetadata, key):
    node = extmetadata.get(key) or {}
    return clean_text(node.get("value", "")) if isinstance(node, dict) else ""


def license_allowed(extmetadata):
    short = meta_value(extmetadata, "LicenseShortName")
    lower = short.lower()
    if any(marker in lower for marker in ("-nc", " nc", "-nd", " nd", "noncommercial", "no derivatives")):
        return False
    allowed = (
        lower.startswith("cc by ")
        or lower.startswith("cc by-sa ")
        or lower == "cc0"
        or lower.startswith("cc0 ")
        or "public domain" in lower
    )
    if not allowed:
        return False

    restrictions = " ".join(
        meta_value(extmetadata, key)
        for key in ("Restrictions", "PersonalityRights", "Trademarked")
    ).lower()
    if any(word in restrictions for word in ("personality", "trademark", "non-free", "copyright restriction")):
        return False
    return True


def build_query(meta):
    location = clean_text(meta.get("location") or "Japan")
    category = clean_text(meta.get("category") or "")
    title = clean_text(meta.get("title") or "")

    # For safety/disruption stories, use a neutral place image rather than an
    # unrelated disaster photo that could imply it depicts the current event.
    if category == "Weather & Disruptions":
        return f'"{location}" Japan'

    operator = ""
    for name in ("JR Central", "JR East", "JR West", "Tokyo Metro", "Haneda", "Narita", "Kansai Airport"):
        if name.lower() in title.lower():
            operator = name
            break
    if category == "Transportation" and operator:
        return f'"{operator}" {location} Japan'

    useful = [w for w in re.findall(r"[A-Za-z0-9'-]+", title) if len(w) > 3]
    useful = [w for w in useful if w.lower() not in {"japan", "travel", "update", "latest", "what", "should", "know", "warning", "alert", "advisory"}]
    suffix = " ".join(useful[:3])
    return f'"{location}" Japan {suffix}'.strip()


def commons_search(query):
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": query,
        "gsrlimit": "14",
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": "1600",
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PocketeyJapanEditorialBot/1.0 (+https://www.pocketey.com)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return (payload.get("query") or {}).get("pages") or []


def candidate_score(page, meta):
    info = ((page.get("imageinfo") or [{}])[0])
    ext = info.get("extmetadata") or {}
    if not license_allowed(ext):
        return None

    mime = str(info.get("mime") or "").lower()
    if not mime.startswith("image/"):
        return None

    width = int(info.get("width") or 0)
    height = int(info.get("height") or 0)
    if width < 900 or height < 500:
        return None

    title = clean_text(page.get("title") or "")
    desc = meta_value(ext, "ImageDescription")
    haystack = f"{title} {desc}".lower()
    if any(x in haystack for x in (" map ", "diagram", "logo", "coat of arms", "flag of", "poster", "screenshot", "scan of", "route map")):
        return None

    location = clean_text(meta.get("location") or "Japan").lower()
    score = 0
    if location and location != "japan" and location in haystack:
        score += 8
    if "japan" in haystack:
        score += 2

    category = clean_text(meta.get("category") or "")
    if category == "Transportation" and any(x in haystack for x in ("train", "station", "rail", "shinkansen", "airport", "metro")):
        score += 4
    if category == "Events" and any(x in haystack for x in ("festival", "event", "shrine", "temple")):
        score += 2

    ratio = width / max(height, 1)
    if 1.15 <= ratio <= 2.1:
        score += 4
    elif 0.9 <= ratio <= 2.5:
        score += 2

    if width >= 1600:
        score += 2

    return score


def pick_image(meta):
    query = build_query(meta)
    try:
        pages = commons_search(query)
    except Exception as exc:
        print(f"Commons search warning for {query}: {exc}", file=sys.stderr)
        return None

    ranked = []
    for page in pages:
        score = candidate_score(page, meta)
        if score is not None:
            ranked.append((score, page))
    if not ranked:
        return None
    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked[0][1]


def download_image(page, draft_path):
    info = ((page.get("imageinfo") or [{}])[0])
    url = info.get("thumburl") or info.get("url")
    if not url:
        return None, None
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PocketeyJapanEditorialBot/1.0 (+https://www.pocketey.com)"},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
        ctype = str(resp.headers.get("Content-Type") or "").lower()

    ext = ".jpg"
    if "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"
    elif "jpeg" not in ctype and "jpg" not in ctype:
        return None, None

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{draft_path.stem}-commons{ext}"
    target = IMAGE_DIR / filename
    target.write_bytes(data)
    return target, f"/images/news/{filename}"


def image_metadata(page, public_path):
    info = ((page.get("imageinfo") or [{}])[0])
    ext = info.get("extmetadata") or {}
    title = clean_text(page.get("title") or "").removeprefix("File:")
    description = meta_value(ext, "ImageDescription")
    artist = meta_value(ext, "Artist") or meta_value(ext, "Credit") or "Wikimedia Commons contributor"
    license_name = meta_value(ext, "LicenseShortName") or "Open license"
    license_url = meta_value(ext, "LicenseUrl")
    source_url = info.get("descriptionurl") or "https://commons.wikimedia.org/"

    alt = description[:180].strip() if description else title[:180]
    return {
        "image": public_path,
        "imageAlt": alt or "Illustrative image for this Japan travel update",
        "imageCredit": artist[:240],
        "imageSourceUrl": source_url,
        "imageLicense": license_name[:120],
        "imageLicenseUrl": license_url,
        "imageProvider": "Wikimedia Commons",
        "imageContext": "illustrative",
        "imageStatus": "open-license-needs-review",
        "imageGenerated": False,
    }


def main():
    if not NEWS_DIR.exists():
        return 0

    attached = 0
    fallback = 0
    for path in sorted(NEWS_DIR.glob("*.md*")):
        meta, _, _ = parse_frontmatter(path)
        if meta.get("draft") is not True:
            continue
        if meta.get("image"):
            continue

        page = pick_image(meta)
        if not page:
            changed = patch_frontmatter(
                path,
                {
                    "imageStatus": "needs-ai-fallback",
                    "imageGenerated": False,
                },
            )
            if changed:
                fallback += 1
                print(f"No verified open-license image found; AI fallback flagged: {path.relative_to(ROOT)}")
            continue

        try:
            target, public_path = download_image(page, path)
        except Exception as exc:
            print(f"Image download warning for {path.name}: {exc}", file=sys.stderr)
            continue
        if not target or not public_path:
            continue

        updates = image_metadata(page, public_path)
        if patch_frontmatter(path, updates):
            attached += 1
            print(f"Attached open-license image: {path.relative_to(ROOT)} -> {target.relative_to(ROOT)}")

    print(f"Open-license images attached: {attached}")
    print(f"Drafts flagged for AI fallback: {fallback}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
