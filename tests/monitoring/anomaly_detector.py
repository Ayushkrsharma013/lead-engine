"""
Log Anomaly Detector — Vercel Log Analysis

Fetches Vercel deployment logs, buckets errors by 5-minute intervals,
and alerts when the error rate spikes above the rolling average.

Usage:
    python tests/monitoring/anomaly_detector.py

Environment variables:
    VERCEL_TOKEN — Vercel API token (required)
    VERCEL_TEAM_ID — Vercel team ID (optional)
    VERCEL_PROJECT_ID — Vercel project ID (optional, auto-detected)
    TELEGRAM_BOT_TOKEN — Telegram bot token for alerts (optional)
    TELEGRAM_CHAT_ID — Telegram chat ID for alerts (optional)
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import Optional

import requests

# ─── Configuration ────────────────────────────────────────────────────────────

VERCEL_TOKEN = os.getenv("VERCEL_TOKEN", "")
VERCEL_TEAM_ID = os.getenv("VERCEL_TEAM_ID", "")
VERCEL_PROJECT_ID = os.getenv("VERCEL_PROJECT_ID", "")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Vercel API base
VERCEL_API = "https://api.vercel.com"

# How far back to fetch logs (minutes)
LOOKBACK_MINUTES = 60

# Spike detection: multiplier above rolling average
SPIKE_THRESHOLD = 3.0

# Minimum errors to trigger alert (avoid noise)
MIN_ERRORS_FOR_ALERT = 5


# ─── Helpers ──────────────────────────────────────────────────────────────────

def vercel_headers() -> dict:
    """Build Vercel API headers."""
    headers = {"Authorization": f"Bearer {VERCEL_TOKEN}"}
    if VERCEL_TEAM_ID:
        headers["x-vercel-team-id"] = VERCEL_TEAM_ID
    return headers


def send_telegram_alert(message: str) -> bool:
    """Send alert message via Telegram bot. Returns True if sent."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
        }
        resp = requests.post(url, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print(f"[telegram] Failed to send: {e}")
        return False


def fetch_deployments() -> list:
    """Fetch recent deployments from Vercel."""
    params = {"limit": 5}
    if VERCEL_PROJECT_ID:
        url = f"{VERCEL_API}/v9/projects/{VERCEL_PROJECT_ID}/deployments"
    else:
        url = f"{VERCEL_API}/v6/deployments"
        params["teamId"] = VERCEL_TEAM_ID if VERCEL_TEAM_ID else None

    try:
        resp = requests.get(url, headers=vercel_headers(), params=params, timeout=15)
        if resp.status_code != 200:
            print(f"[vercel] Failed to fetch deployments: {resp.status_code} {resp.text[:200]}")
            return []

        data = resp.json()
        return data.get("deployments", [])
    except Exception as e:
        print(f"[vercel] Deployment fetch error: {e}")
        return []


def fetch_deployment_events(deployment_id: str, since: int) -> list:
    """Fetch deployment events/logs from Vercel."""
    url = f"{VERCEL_API}/v2/deployments/{deployment_id}/events"
    params = {
        "since": since,
        "until": int(time.time() * 1000),
        "limit": 500,
        "direction": "forward",
    }

    try:
        resp = requests.get(url, headers=vercel_headers(), params=params, timeout=15)
        if resp.status_code != 200:
            print(f"[vercel] Events fetch failed: {resp.status_code}")
            return []

        events = resp.json()
        return events if isinstance(events, list) else events.get("events", [])
    except Exception as e:
        print(f"[vercel] Events fetch error: {e}")
        return []


def fetch_runtime_logs(deployment_id: str, since: int) -> list:
    """Fetch runtime logs for a deployment."""
    url = f"{VERCEL_API}/v1/deployments/{deployment_id}/logs"
    params = {
        "from": since,
        "to": int(time.time() * 1000),
        "limit": 500,
    }

    try:
        resp = requests.get(url, headers=vercel_headers(), params=params, timeout=15)
        if resp.status_code != 200:
            print(f"[vercel] Runtime logs fetch failed: {resp.status_code}")
            return []

        data = resp.json()
        return data.get("logs", []) if isinstance(data, dict) else []
    except Exception as e:
        print(f"[vercel] Runtime logs fetch error: {e}")
        return []


# ─── Analysis ─────────────────────────────────────────────────────────────────

def bucket_logs(logs: list) -> dict:
    """
    Bucket log entries into 5-minute intervals.
    Returns: { bucket_timestamp: { "total": int, "errors": int, "statuses": dict } }
    """
    buckets: dict = defaultdict(lambda: {"total": 0, "errors": 0, "statuses": defaultdict(int)})

    for log in logs:
        ts = log.get("timestamp") or log.get("date") or log.get("created")
        if not ts:
            continue

        try:
            # Handle both millisecond and second timestamps
            if ts > 1_000_000_000_000:
                dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
            else:
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)

            # Round to 5-minute bucket
            minute = (dt.minute // 5) * 5
            bucket_key = dt.replace(minute=minute, second=0, microsecond=0).isoformat()
        except (ValueError, OSError):
            continue

        buckets[bucket_key]["total"] += 1

        # Check for errors
        status_code = log.get("statusCode") or log.get("status_code") or log.get("status") or log.get("proxy", {}).get("statusCode") or 0
        is_error = log.get("type") == "error" or log.get("level") == "error" or log.get("level") == "50"

        if isinstance(status_code, int):
            buckets[bucket_key]["statuses"][status_code] += 1
            if status_code >= 500:
                buckets[bucket_key]["errors"] += 1
                is_error = True

        if is_error:
            buckets[bucket_key]["errors"] += 1

    return dict(buckets)


def detect_spikes(buckets: dict) -> list:
    """
    Compare each bucket's error rate against the rolling average.
    Returns list of spike alerts as (bucket, error_count, avg_errors, threshold) tuples.
    """
    if len(buckets) < 3:
        return []  # Need at least 3 buckets for a meaningful average

    sorted_buckets = sorted(buckets.items())
    alerts = []

    # Compute rolling average of non-zero error counts
    error_counts = [b[1]["errors"] for b in sorted_buckets if b[1]["errors"] > 0]
    if not error_counts:
        return []

    avg_errors = sum(error_counts) / len(error_counts)
    threshold = max(avg_errors * SPIKE_THRESHOLD, MIN_ERRORS_FOR_ALERT)

    for bucket_key, data in sorted_buckets:
        errors = data["errors"]
        if errors >= threshold and errors >= MIN_ERRORS_FOR_ALERT:
            alerts.append((bucket_key, errors, round(avg_errors, 1), round(threshold, 1)))

    return alerts


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("═══════════════════════════════════════════════════════════")
    print(f"  LOG ANOMALY DETECTOR — {datetime.now(timezone.utc).isoformat()}")
    print("═══════════════════════════════════════════════════════════\n")

    if not VERCEL_TOKEN:
        print("❌ VERCEL_TOKEN environment variable is required")
        sys.exit(2)

    # Calculate time range
    since = int((datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MINUTES)).timestamp() * 1000)
    print(f"[config] Fetching logs from last {LOOKBACK_MINUTES} minutes")

    # Fetch deployments
    deployments = fetch_deployments()
    if not deployments:
        print("[vercel] No deployments found — cannot analyze logs")
        sys.exit(0)

    print(f"[vercel] Found {len(deployments)} recent deployment(s)")

    prod_deployments = [
        d for d in deployments
        if d.get("target") == "production" or d.get("state") == "READY"
    ]

    if not prod_deployments:
        prod_deployments = deployments

    # Collect all logs across deployments
    all_logs = []
    for dep in prod_deployments[:3]:  # Analyze top 3 most recent
        dep_id = dep.get("uid") or dep.get("id")
        dep_name = dep.get("name") or dep.get("url", "unknown")
        if not dep_id:
            continue

        print(f"[vercel] Fetching logs for: {dep_name} ({dep_id[:12]}...)")

        events = fetch_deployment_events(dep_id, since)
        runtime = fetch_runtime_logs(dep_id, since)

        all_logs.extend(events)
        all_logs.extend(runtime)

    print(f"[vercel] Total log entries collected: {len(all_logs)}")

    if not all_logs:
        print("✅ No logs in the lookback window — all quiet.")
        sys.exit(0)

    # Bucket and analyze
    buckets = bucket_logs(all_logs)
    print(f"[analysis] {len(buckets)} time buckets created")

    for bucket_key in sorted(buckets.keys()):
        data = buckets[bucket_key]
        status_str = ", ".join(
            f"{code}: {count}" for code, count in sorted(data["statuses"].items())
        )
        print(f"  {bucket_key}: {data['total']} requests, {data['errors']} errors [{status_str}]")

    # Detect spikes
    spikes = detect_spikes(buckets)

    print(f"\n─── Spike Detection ───")
    if spikes:
        for bucket_key, errors, avg, threshold in spikes:
            alert_msg = (
                f"🚨 <b>Error Spike Detected!</b>\n"
                f"Bucket: {bucket_key}\n"
                f"Errors: {errors} (avg: {avg}, threshold: {threshold})\n"
                f"Project: Prospecting OS (lead-engine)"
            )
            print(f"  ⚠️  SPIKE at {bucket_key}: {errors} errors (avg {avg}, threshold {threshold})")
            send_telegram_alert(alert_msg)
        print(f"\n  {len(spikes)} spike(s) detected")
        sys.exit(1)
    else:
        print("  ✅ No error spikes detected")
        sys.exit(0)


if __name__ == "__main__":
    main()
