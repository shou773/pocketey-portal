#!/usr/bin/env python3
import hashlib
import html
import json
import os
import pathlib
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUEUE_DIR = ROOT / "data" / "editorial"
NEWS_DIR = ROOT / "src" / "content" / "news"
CONFIG_PATH = ROOT / "editorial_engine" / "config.json"
PROMPT_PATH = ROOT / "editorial_engine" / "draft_prompt.md"

ALLOWED_CATEGORIES = {
    "Travel Updates",
    "Transportation",
    "Events",
    "Weather & Disruptions",
    "Travel Guides",
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def clean_source_text(raw):
    raw = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<style\b[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()


def fetch_source(url, timeout=35):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "PocketeyJapanDraftBot/1.2 (+https://www.pocketey.com)",
            "Accept-Language": "en-US,en;q=0.8,ja;q=0.7",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        content_type = str(resp.headers.get("Content-Type") or "").lower()

    # JMA and some other official sources publish structured XML. Keeping the
    # hierarchy intact reduces the risk of attaching a value to the wrong time
    # window or area.
    if url.lower().endswith(".xml") or "xml" in content_type or raw.lstrip().startswith("<?xml"):
        return raw[:40000]

    return clean_source_text(raw)[:25000]


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(text[start:end + 1])


def call_model(prompt, model, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.15,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    candidates = payload.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {payload}")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
    return extract_json(text)


def gemini_generate(prompt, primary_model, api_key):
    models = []
    for model in [primary_model, "gemini-3.5-flash-lite"]:
        if model and model not in models:
            models.append(model)

    last_error = None
    for model in models:
        for attempt in range(1, 4):
            try:
                return call_model(prompt, model, api_key), model
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                last_error = RuntimeError(f"Gemini API HTTP {exc.code}: {detail}")
                if exc.code in (429, 500, 502, 503, 504) and attempt < 3:
                    wait = 5 * attempt
                    print(
                        f"Gemini temporary error {exc.code} on {model}; retrying in {wait}s "
                        f"(attempt {attempt}/3).",
                        file=sys.stderr,
                    )
                    time.sleep(wait)
                    continue
                break
            except Exception as exc:
                last_error = exc
                break
        if model != models[-1]:
            print(f"Draft generator falling back from {model} to {models[-1]}.", file=sys.stderr)
    raise RuntimeError(f"Draft generation failed after retries/fallback: {last_error}")


def slugify(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:70] or "travel-update"


def sanitize_event_key(value):
    return slugify(value)[:110]


def derive_event_key(candidate, run_date):
    text = " ".join(
        str(candidate.get(key) or "")
        for key in ("title", "what_changed", "location", "effective_date")
    )
    location = slugify(candidate.get("location") or "japan")[:42]
    year = str(run_date)[:4]

    # Canonicalize high-frequency safety events even if the model phrases the
    # key differently from one run to another.
    typhoon = re.search(r"\btyphoon\s*(?:no\.?\s*)?#?\s*(\d+)\b", text, flags=re.I)
    if typhoon:
        return sanitize_event_key(f"typhoon-{typhoon.group(1)}-{location}-{year}")

    if re.search(r"\b(volcanic|volcano|ashfall|volcanic ash)\b", text, flags=re.I):
        if location and not location.startswith("various"):
            return sanitize_event_key(f"{location}-volcanic-activity-{str(run_date)[:7]}")

    supplied = sanitize_event_key(candidate.get("event_key") or "")
    if supplied:
        return supplied

    title = re.sub(r"\b20\d{2}[-/ ]\d{1,2}[-/ ]\d{1,2}\b", " ", str(candidate.get("title") or ""))
    title = re.sub(r"\b(severe|latest|new|update|updated|announcement)\b", " ", title, flags=re.I)
    return sanitize_event_key(f"{slugify(title)[:55]}-{location}-{year}")


def parse_frontmatter(path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}, ""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}, text
    block = text[4:end]
    data = {}
    for line in block.splitlines():
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        key, raw = key.strip(), raw.strip()
        if not key:
            continue
        if raw in ("true", "false"):
            data[key] = raw == "true"
            continue
        if raw.startswith('"'):
            try:
                data[key] = json.loads(raw)
                continue
            except json.JSONDecodeError:
                pass
        data[key] = raw
    return data, text[end + 5:]


def find_existing_event(event_key, source_url):
    if not NEWS_DIR.exists():
        return None, None
    for path in sorted(NEWS_DIR.glob("*.md*")):
        meta, _ = parse_frontmatter(path)
        if event_key and str(meta.get("eventKey") or "") == event_key:
            return path, meta
        if source_url and str(meta.get("sourceUrl") or "") == source_url:
            return path, meta
    return None, None


def yaml_string(value):
    return json.dumps(str(value or ""), ensure_ascii=False)


def write_draft(candidate, draft, run_date, event_key, existing_path=None, existing_meta=None):
    source_url = str(candidate.get("primary_source_url") or "")
    title = str(draft.get("title") or candidate.get("title") or "Japan travel update")
    description = str(draft.get("description") or candidate.get("why_it_matters") or "Japan travel update")
    category = str(draft.get("category") or candidate.get("category") or "Travel Updates")
    if category not in ALLOWED_CATEGORIES:
        category = str(candidate.get("category") or "Travel Updates")
    if category not in ALLOWED_CATEGORIES:
        category = "Travel Updates"
    location = str(draft.get("location") or candidate.get("location") or "Japan")
    source_label = str(candidate.get("primary_source_name") or "Official source")
    body = str(draft.get("body_markdown") or "").strip()
    if not body:
        raise ValueError("Draft body is empty")

    existing_meta = existing_meta or {}
    original_date = str(existing_meta.get("date") or run_date)
    if existing_path is not None:
        path = existing_path
    else:
        slug = slugify(title)
        digest = hashlib.sha1(event_key.encode("utf-8")).hexdigest()[:6]
        path = NEWS_DIR / f"{run_date}-{slug}-{digest}.md"

    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    content = "\n".join(
        [
            "---",
            f"title: {yaml_string(title)}",
            f"description: {yaml_string(description[:220])}",
            f"date: {original_date}",
            f"category: {yaml_string(category)}",
            f"location: {yaml_string(location)}",
            "featured: false",
            "draft: true",
            f"eventKey: {yaml_string(event_key)}",
            f"reviewStatus: {yaml_string('needs-review')}",
            f"sourceLabel: {yaml_string(source_label)}",
            f"sourceUrl: {yaml_string(source_url)}",
            f"updated: {run_date}",
            "---",
            "",
            "<!-- AI-generated Pocketey draft. Human verification and approval are required before publication. -->",
            "",
            body,
            "",
        ]
    )
    path.write_text(content, encoding="utf-8")
    return path


def main():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("GEMINI_API_KEY is not set.", file=sys.stderr)
        return 2
    model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
    draft_limit = max(1, int(os.getenv("DRAFT_LIMIT", "2")))
    config = load_json(CONFIG_PATH)
    threshold = int(config.get("minimum_publish_recommendation_score", 70))

    queues = sorted(QUEUE_DIR.glob("*.json"))
    if not queues:
        print("No editorial queue JSON found; skipping draft generation.")
        return 0
    queue_path = queues[-1]
    queue = load_json(queue_path)
    run_date = str(queue.get("run_date") or queue_path.stem)

    selected = []
    for candidate in queue.get("candidates", []):
        total = int((candidate.get("scores") or {}).get("total", 0))
        if str(candidate.get("recommendation", "")).lower() != "publish":
            continue
        if total < threshold:
            continue
        source_url = str(candidate.get("primary_source_url") or "")
        if not source_url.startswith("https://"):
            continue

        event_key = derive_event_key(candidate, run_date)
        existing_path, existing_meta = find_existing_event(event_key, source_url)
        if existing_path is not None:
            if existing_meta.get("draft") is False:
                print(
                    f"Published article already exists for event {event_key}; "
                    f"leaving it unchanged for human review: {existing_path.relative_to(ROOT)}"
                )
                continue
            if str(existing_meta.get("sourceUrl") or "") == source_url:
                print(
                    f"No new official source for existing draft event {event_key}; skipping regeneration: "
                    f"{existing_path.relative_to(ROOT)}"
                )
                continue
            print(
                f"New official update matched existing event {event_key}; refreshing draft: "
                f"{existing_path.relative_to(ROOT)}"
            )

        selected.append((candidate, event_key, existing_path, existing_meta))
        if len(selected) >= draft_limit:
            break

    if not selected:
        print("No new or updated publish candidates need draft generation.")
        return 0

    base_prompt = PROMPT_PATH.read_text(encoding="utf-8")
    created, refreshed = [], []
    for candidate, event_key, existing_path, existing_meta in selected:
        source_url = candidate["primary_source_url"]
        try:
            source_text = fetch_source(source_url)
        except Exception as exc:
            print(f"Draft source warning: {source_url}: {exc}", file=sys.stderr)
            continue
        runtime = {
            "run_date": run_date,
            "event_key": event_key,
            "candidate": candidate,
            "primary_official_source_text": source_text,
        }
        prompt = base_prompt + "\n\n## Runtime data\n" + json.dumps(runtime, ensure_ascii=False, indent=2)
        try:
            draft, used_model = gemini_generate(prompt, model, api_key)
            path = write_draft(
                candidate,
                draft,
                run_date,
                event_key,
                existing_path=existing_path,
                existing_meta=existing_meta,
            )
            if existing_path is not None:
                refreshed.append(path)
                print(f"Refreshed unpublished draft with {used_model}: {path.relative_to(ROOT)}")
            else:
                created.append(path)
                print(f"Created unpublished draft with {used_model}: {path.relative_to(ROOT)}")
        except Exception as exc:
            print(f"Draft generation warning: {candidate.get('title')}: {exc}", file=sys.stderr)

    print(f"Unpublished drafts created: {len(created)}")
    print(f"Unpublished drafts refreshed: {len(refreshed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
