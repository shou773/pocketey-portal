#!/usr/bin/env python3
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "editorial_engine" / "config.json"
PROMPT_PATH = ROOT / "editorial_engine" / "prompt.md"
OUTPUT_DIR = ROOT / "data" / "editorial"


def load_text(path):
    return path.read_text(encoding="utf-8")


def load_json(path):
    return json.loads(load_text(path))


def fetch_url(url, timeout=30):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "PocketeyJapanEditorialBot/1.2 (+https://www.pocketey.com)",
            "Accept-Language": "en-US,en;q=0.8,ja;q=0.7",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean_text(value):
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def collect_feed(source):
    try:
        raw = fetch_url(source["url"])
        root = ET.fromstring(raw)
    except Exception as exc:
        print(f"Source warning: {source['name']}: {exc}", file=sys.stderr)
        return []

    items = []
    for node in root.findall(".//item"):
        title = clean_text(node.findtext("title"))
        link = clean_text(node.findtext("link"))
        desc = clean_text(node.findtext("description"))
        date = clean_text(node.findtext("pubDate"))
        if title and link:
            items.append({
                "source": source["name"],
                "source_type": "official_feed",
                "title": title,
                "url": link,
                "published": date,
                "summary": desc[:1200],
            })

    ns = {"a": "http://www.w3.org/2005/Atom"}
    for node in root.findall(".//a:entry", ns):
        title = clean_text(node.findtext("a:title", default="", namespaces=ns))
        link_node = node.find("a:link", ns)
        link = link_node.attrib.get("href", "") if link_node is not None else ""
        summary = clean_text(
            node.findtext("a:summary", default="", namespaces=ns)
            or node.findtext("a:content", default="", namespaces=ns)
        )
        date = clean_text(
            node.findtext("a:updated", default="", namespaces=ns)
            or node.findtext("a:published", default="", namespaces=ns)
        )
        if title and link:
            items.append({
                "source": source["name"],
                "source_type": "official_feed",
                "title": title,
                "url": link,
                "published": date,
                "summary": summary[:1200],
            })
    return items[: int(source.get("max_items", 20))]


def relevant_link(title, context, source):
    text = f"{title} {context}".lower()
    exclude = [x.lower() for x in source.get("exclude_keywords", [])]
    if exclude and any(x in text for x in exclude):
        return False
    include = [x.lower() for x in source.get("include_keywords", [])]
    if include and not any(x in text for x in include):
        return False
    return True


def collect_html_page(source):
    try:
        raw = fetch_url(source["url"])
    except Exception as exc:
        print(f"Source warning: {source['name']}: {exc}", file=sys.stderr)
        return []

    items = []
    anchor_re = re.compile(
        r"<a\b[^>]*?href\s*=\s*[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
        flags=re.I | re.S,
    )
    for match in anchor_re.finditer(raw):
        href = html.unescape(match.group(1)).strip()
        title = clean_text(match.group(2))
        if not title or len(title) < int(source.get("min_title_length", 12)):
            continue
        if href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        url = urllib.parse.urljoin(source["url"], href)
        if not url.startswith("https://"):
            continue
        context_raw = raw[max(0, match.start() - 320): min(len(raw), match.end() + 320)]
        context = clean_text(context_raw)
        if not relevant_link(title, context, source):
            continue
        items.append({
            "source": source["name"],
            "source_type": "official_web_page",
            "title": title[:300],
            "url": url,
            "published": "",
            "summary": context[:1400],
        })

    seen, unique = set(), []
    for item in items:
        key = (item["url"], item["title"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[: int(source.get("max_items", 20))]


def collect_sources(config):
    collected = []
    stats = []
    for source in config.get("official_sources", []):
        source_type = source.get("type")
        if source_type in ("rss", "atom"):
            items = collect_feed(source)
        elif source_type == "html":
            items = collect_html_page(source)
        else:
            print(f"Source warning: unsupported source type {source_type}: {source.get('name')}", file=sys.stderr)
            items = []
        collected.extend(items)
        stats.append({"source": source.get("name", ""), "items": len(items)})

    seen, unique = set(), []
    for item in collected:
        key = item.get("url") or item.get("title")
        if key and key not in seen:
            seen.add(key)
            unique.append(item)
    return unique, stats


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(text[start:end + 1])


def gemini_analyze(prompt, model, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.15, "responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API HTTP {e.code}: {detail}") from e
    candidates = payload.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {payload}")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
    return extract_json(text)


def normalize(result, config, run_date):
    items = result.get("candidates") if isinstance(result, dict) else None
    if not isinstance(items, list):
        raise ValueError("Response JSON must contain a candidates array")
    max_scores = config["score_weights"]
    normalized = []
    for item in items[: int(config.get("candidate_limit", 8))]:
        if not isinstance(item, dict):
            continue
        scores, total = item.get("scores") or {}, 0
        clean_scores = {}
        for key, maximum in max_scores.items():
            try:
                value = int(scores.get(key, 0))
            except (TypeError, ValueError):
                value = 0
            value = max(0, min(int(maximum), value))
            clean_scores[key] = value
            total += value
        clean_scores["total"] = total
        item["scores"] = clean_scores
        primary = str(item.get("primary_source_url") or "")
        if not primary.startswith("https://"):
            item["recommendation"] = "watch"
            item["reason"] = (
                str(item.get("reason") or "")
                + " Primary HTTPS source is missing; verify manually."
            ).strip()
        threshold = int(config.get("minimum_publish_recommendation_score", 70))
        if total < threshold and item.get("recommendation") == "publish":
            item["recommendation"] = "watch"
            item["reason"] = (
                str(item.get("reason") or "")
                + f" Score is below Pocketey's {threshold}-point publish threshold."
            ).strip()
        normalized.append(item)
    normalized.sort(key=lambda x: x.get("scores", {}).get("total", 0), reverse=True)
    return {
        "run_date": run_date,
        "status": "candidate_queue_only",
        "human_review_required": True,
        "run_summary": result.get("run_summary", ""),
        "candidates": normalized,
    }


def write_markdown(queue, output_path):
    lines = [
        f"# Pocketey Editorial Queue — {queue['run_date']}",
        "",
        "> AI analysis of official-source items only. Nothing here is approved for publication.",
        "",
    ]
    if queue.get("run_summary"):
        lines += [queue["run_summary"], ""]
    for i, item in enumerate(queue.get("candidates", []), 1):
        s = item.get("scores", {})
        lines += [
            f"## {i}. {item.get('title', 'Untitled')}",
            "",
            f"**Recommendation:** {str(item.get('recommendation', 'watch')).upper()}  ",
            f"**Score:** {s.get('total', 0)}/100  ",
            f"**Category:** {item.get('category', '')}  ",
            f"**Location:** {item.get('location', '')}  ",
            f"**Relevant date:** {item.get('effective_date', '')}",
            "",
            f"**What changed:** {item.get('what_changed', '')}",
            "",
            f"**Why travelers care:** {item.get('why_it_matters', '')}",
            "",
            f"**Traveler action:** {item.get('traveler_action', '')}",
            "",
            f"**Primary source:** [{item.get('primary_source_name', 'Official source')}]({item.get('primary_source_url', '')})",
            "",
            f"**Related guide opportunity:** {item.get('related_guide_opportunity', 'none')}",
            "",
            f"**Monetization:** {item.get('monetization_relevance', 'none')} — {item.get('monetization_note', '')}",
            "",
            "**Score detail:** " + ", ".join(
                f"{k.replace('_', ' ')} {v}" for k, v in s.items() if k != "total"
            ),
            "",
            f"**Reason:** {item.get('reason', '')}",
            "",
            "---",
            "",
        ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("GEMINI_API_KEY is not set.", file=sys.stderr)
        return 2
    model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
    config = load_json(CONFIG_PATH)
    today = dt.datetime.now(dt.timezone.utc).astimezone(
        dt.timezone(dt.timedelta(hours=9))
    ).date().isoformat()
    source_items, source_stats = collect_sources(config)
    if not source_items:
        print("No official-source items were collected. Check editorial_engine/config.json.", file=sys.stderr)
        return 3

    runtime = {
        "today_in_japan": today,
        "lookback_days": config.get("lookback_days", 7),
        "candidate_limit": config.get("candidate_limit", 8),
        "priority_topics": config.get("priority_topics", []),
        "source_stats": source_stats,
        "source_items": source_items[: int(config.get("max_source_items_for_ai", 120))],
    }
    prompt = (
        load_text(PROMPT_PATH)
        + "\n\n## Runtime data\n"
        + json.dumps(runtime, ensure_ascii=False, indent=2)
        + "\n\n## Pocketey principles\n"
        + load_text(ROOT / "EDITORIAL_PRINCIPLES.md")
    )
    result = gemini_analyze(prompt, model, api_key)
    queue = normalize(result, config, today)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / f"{today}.json"
    md_path = OUTPUT_DIR / f"{today}.md"
    json_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(queue, md_path)
    print(f"Collected official-source items: {len(source_items)}")
    for stat in source_stats:
        print(f"  - {stat['source']}: {stat['items']}")
    print(f"Wrote {json_path.relative_to(ROOT)} and {md_path.relative_to(ROOT)}")
    print(f"Candidates: {len(queue['candidates'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
