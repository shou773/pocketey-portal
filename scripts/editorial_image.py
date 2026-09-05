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
    _, text, end = parse_frontmatter(path)
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
        # Optional URL/string metadata must be omitted when missing. Writing an
        # empty quoted string can fail Astro's z.string().url() validation.
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
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


def valid_http_url(value):
    try:
        parsed = urllib.parse.urlparse(str(value or "").strip())
    except Exception:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


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


def location_variants(meta):
    location = clean_text(meta.get("location") or "Japan")
    variants = [location]

    if "," in location:
        variants.append(location.split(",", 1)[0].strip())

    no_prefecture = re.sub(r"\s+Prefecture\b", "", location, flags=re.I).strip()
    if no_prefecture:
        variants.append(no_prefecture)
        if "," in no_prefecture:
            variants.append(no_prefecture.split(",", 1)[0].strip())

    aliases = {
        "Hamana Lake": "Lake Hamana",
    }
    for source, target in aliases.items():
        for value in list(variants):
            if source.lower() in value.lower():
                variants.append(re.sub(re.escape(source), target, value, flags=re.I))

    seen, unique = set(), []
    for value in variants:
        value = clean_text(value)
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            unique.append(value)
    return unique


def build_queries(meta):
    category = clean_text(meta.get("category") or "")
    title = clean_text(meta.get("title") or "")
    lower = title.lower()
    locations = location_variants(meta)
    queries = []

    if category == "Transportation":
        if "nozomi" in lower or "shinkansen" in lower:
            queries.extend(["N700S Shinkansen Japan", "N700 Shinkansen Japan"])
        elif "japan rail pass" in lower or "rail pass" in lower:
            queries.extend(["Japan Rail Pass Shinkansen Japan", "Shinkansen station Japan"])
        else:
            operator = ""
            for name in ("JR Central", "JR East", "JR West", "Tokyo Metro", "Haneda", "Narita", "Kansai Airport"):
                if name.lower() in lower:
                    operator = name
                    break
            if operator:
                for location in locations[:2]:
                    queries.append(f'"{operator}" {location} Japan')

    useful = [w for w in re.findall(r"[A-Za-z0-9'-]+", title) if len(w) > 3]
    useful = [w for w in useful if w.lower() not in {"japan", "travel", "update", "latest", "what", "should", "know", "warning", "alert", "advisory", "program", "launches"}]
    suffix = " ".join(useful[:4])

    if category == "Weather & Disruptions":
        # Neutral place imagery only: never search for disaster terms that could
        # imply an older photo depicts the current weather event.
        for location in locations[:4]:
            queries.append(f'"{location}" Japan landscape')
            queries.append(f'"{location}" Japan coastline')
            queries.append(f'"{location}" Japan scenery')
    else:
        for location in locations[:4]:
            if suffix:
                queries.append(f'"{location}" Japan {suffix}')
            queries.append(f'"{location}" Japan')
            queries.append(f'{location} Japan')

    seen, unique = set(), []
    for query in queries:
        query = re.sub(r"\s+", " ", query).strip()
        if query and query.lower() not in seen:
            seen.add(query.lower())
            unique.append(query)
    return unique[:10]


def commons_search(query):
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": query,
        "gsrlimit": "30",
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": "1600",
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PocketeyJapanEditorialBot/1.2 (+https://www.pocketey.com)"},
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

    page_title = clean_text(page.get("title") or "")
    desc = meta_value(ext, "ImageDescription")
    haystack = f" {page_title} {desc} ".lower()

    blocked = (
        " map ", "diagram", "logo", "coat of arms", "flag of", "poster",
        "screenshot", "scan of", "route map", ".djvu", "book", "manuscript",
        "illustration", "painting", "drawing", "engraving", "child stories",
    )
    if any(term in haystack for term in blocked):
        return None

    title = clean_text(meta.get("title") or "")
    title_lower = title.lower()
    category = clean_text(meta.get("category") or "")
    locations = [value.lower() for value in location_variants(meta)]
    non_japan_locations = [value for value in locations if value != "japan"]
    location_match = any(value in haystack for value in non_japan_locations)

    # For location-specific non-transport stories, insist that the image metadata
    # actually names the place (including known aliases such as Lake Hamana).
    if non_japan_locations and category != "Transportation" and not location_match:
        return None

    if category == "Weather & Disruptions":
        # A place name alone is not enough. Reject military, conference and other
        # people/event-centric images that happen to mention the destination.
        weather_blocked = (
            "army", "military", "soldier", "commanding general", "press conference",
            "u.s. army", "camp amami", "exercise", "interoperability", "ceremony",
            "meeting", "delegation", "official visit",
        )
        if any(term in haystack for term in weather_blocked):
            return None

    score = 0

    if category == "Transportation":
        transport_terms = ("train", "railway", "railroad", "station", "shinkansen", "airport", "metro", "subway", "bus")
        if not any(term in haystack for term in transport_terms):
            return None

        if "nozomi" in title_lower or "shinkansen" in title_lower:
            if any(term in haystack for term in ("300 series", "series 300", "500 series", "series 500", "100 series", "series 100", "0 series", "series 0")):
                return None
            if not any(term in haystack for term in ("n700s", "n700a", " n700 ", "nozomi")):
                return None
            score += 10

        elif "japan rail pass" in title_lower or "rail pass" in title_lower:
            if not any(term in haystack for term in ("japan rail pass", "rail pass", "shinkansen", "train", "railway", "station")):
                return None
            score += 6

        else:
            score += 4

    elif category == "Events":
        if any(term in haystack for term in ("festival", "event", "shrine", "temple", "matsuri")):
            score += 3

    if location_match:
        score += 6
    if "japan" in haystack:
        score += 2

    ratio = width / max(height, 1)
    if 1.15 <= ratio <= 2.1:
        score += 4
    elif 0.9 <= ratio <= 2.5:
        score += 2

    if width >= 1600:
        score += 2

    return score if score >= 8 else None


def pick_image(meta):
    pages_by_key = {}
    attempted = []
    for query in build_queries(meta):
        attempted.append(query)
        try:
            pages = commons_search(query)
        except Exception as exc:
            print(f"Commons search warning for {query}: {exc}", file=sys.stderr)
            continue
        for page in pages:
            key = str(page.get("pageid") or page.get("title") or "")
            if key:
                pages_by_key[key] = page

    ranked = []
    for page in pages_by_key.values():
        score = candidate_score(page, meta)
        if score is not None:
            ranked.append((score, page))
    if not ranked:
        if attempted:
            print(f"No safe image candidate after {len(attempted)} Commons queries: {attempted}")
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
        headers={"User-Agent": "PocketeyJapanEditorialBot/1.2 (+https://www.pocketey.com)"},
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
    metadata = {
        "image": public_path,
        "imageAlt": alt or "Illustrative image for this Japan travel update",
        "imageCredit": artist[:240],
        "imageSourceUrl": source_url,
        "imageLicense": license_name[:120],
        "imageProvider": "Wikimedia Commons",
        "imageContext": "illustrative",
        "imageStatus": "open-license-needs-review",
        "imageGenerated": False,
    }
    # Public-domain Commons files sometimes have no LicenseUrl. The field is
    # optional in Astro, so omit it instead of writing an invalid empty URL.
    if valid_http_url(license_url):
        metadata["imageLicenseUrl"] = license_url
    return metadata


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
                print(f"No sufficiently relevant open-license image found; AI fallback flagged: {path.relative_to(ROOT)}")
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
