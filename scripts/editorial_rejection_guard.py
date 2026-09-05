#!/usr/bin/env python3
import datetime as dt
import json
import pathlib

from editorial_draft import derive_event_key
from editorial_engine import write_markdown

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUEUE_DIR = ROOT / "data" / "editorial"
REJECTIONS_PATH = QUEUE_DIR / "rejections.json"


def load_rejections(now):
    if not REJECTIONS_PATH.exists():
        return []
    try:
        payload = json.loads(REJECTIONS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

    active = []
    for item in payload.get("rejections", []):
        if item.get("permanent") is True:
            active.append(item)
            continue
        until = str(item.get("suppress_until") or "").strip()
        if not until:
            continue
        try:
            expiry = dt.datetime.fromisoformat(until.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=dt.timezone.utc)
            if expiry > now:
                active.append(item)
        except ValueError:
            continue
    return active


def matches(candidate, run_date, rejection):
    derived = derive_event_key(candidate, run_date)
    supplied = str(candidate.get("event_key") or "").strip()
    source = str(candidate.get("primary_source_url") or "").strip()
    rejected_key = str(rejection.get("event_key") or "").strip()
    rejected_source = str(rejection.get("source_url") or "").strip()

    if rejected_key and rejected_key in {derived, supplied}:
        return True
    if rejected_source and source and rejected_source == source:
        return True
    return False


def main():
    queues = [path for path in sorted(QUEUE_DIR.glob("*.json")) if path.name != "rejections.json"]
    if not queues:
        print("No editorial queue found; rejection guard skipped.")
        return 0

    now = dt.datetime.now(dt.timezone.utc)
    rejections = load_rejections(now)
    if not rejections:
        print("No active rejection suppressions.")
        return 0

    queue_path = queues[-1]
    queue = json.loads(queue_path.read_text(encoding="utf-8"))
    run_date = str(queue.get("run_date") or queue_path.stem)
    suppressed = 0

    for candidate in queue.get("candidates", []):
        for rejection in rejections:
            if not matches(candidate, run_date, rejection):
                continue
            candidate["recommendation"] = "skip"
            candidate["suppressed_by_human_rejection"] = True
            candidate["rejection_reason"] = str(rejection.get("reason") or "Rejected during human review")
            candidate["rejection_suppression"] = str(rejection.get("suppression") or "")
            reason = str(candidate.get("reason") or "").strip()
            note = "Human rejection guard: this event is currently suppressed from redrafting."
            if note not in reason:
                candidate["reason"] = f"{reason} {note}".strip()
            suppressed += 1
            break

    queue["rejection_guard"] = {
        "enabled": True,
        "active_rejections": len(rejections),
        "suppressed_candidates": suppressed,
    }
    queue_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(queue, queue_path.with_suffix(".md"))
    print(f"Human rejection guard suppressed {suppressed} candidate(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
