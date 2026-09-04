#!/usr/bin/env python3
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "editorial_engine" / "config.json"
PROMPT_PATH = ROOT / "editorial_engine" / "prompt.md"
OUTPUT_DIR = ROOT / "data" / "editorial"


def load_text(path):
    return path.read_text(encoding="utf-8")


def load_json(path):
    return json.loads(load_text(path))


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(text[start:end + 1])


def gemini_research(prompt, model, api_key):
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
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
    if not text:
        raise RuntimeError("Gemini response contained no text")
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
        scores = item.get("scores") or {}
        total = 0
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
        "> AI research queue only. Nothing here is approved for publication.",
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
        print("GEMINI_API_KEY is not set. Add it as a GitHub Actions repository secret.", file=sys.stderr)
        return 2

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    config = load_json(CONFIG_PATH)
    base_prompt = load_text(PROMPT_PATH)
    principles = load_text(ROOT / "EDITORIAL_PRINCIPLES.md")
    today = dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=9))).date().isoformat()

    runtime = {
        "today_in_japan": today,
        "lookback_days": config.get("lookback_days", 3),
        "candidate_limit": config.get("candidate_limit", 8),
        "priority_topics": config.get("priority_topics", []),
        "preferred_domains": config.get("preferred_domains", []),
    }
    prompt = (
        base_prompt
        + "\n\n## Runtime configuration\n"
        + json.dumps(runtime, ensure_ascii=False, indent=2)
        + "\n\n## Pocketey principles\n"
        + principles
    )

    result = gemini_research(prompt, model, api_key)
    queue = normalize(result, config, today)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / f"{today}.json"
    md_path = OUTPUT_DIR / f"{today}.md"
    json_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(queue, md_path)

    print(f"Wrote {json_path.relative_to(ROOT)}")
    print(f"Wrote {md_path.relative_to(ROOT)}")
    print(f"Candidates: {len(queue['candidates'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
