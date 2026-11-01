#!/usr/bin/env python3
"""Measure app-process recovery in local Docker Compose (not AWS). Run with sudo."""

from datetime import datetime, timezone
from pathlib import Path
import json
import statistics
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
HEALTH_URL = "http://127.0.0.1:3000/api/health"
TRIALS = int(__import__("os").environ.get("RECOVERY_TRIALS", "3"))
TIMEOUT_SECONDS = 60.0


def compose(*args):
    return subprocess.run(
        ["docker", "compose", *args], cwd=ROOT, check=True,
        capture_output=True, text=True,
    ).stdout.strip()


def is_healthy():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=1.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status == 200 and payload.get("ok") is True
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return False


def restart_count(container_id):
    value = subprocess.run(
        ["docker", "inspect", container_id, "--format", "{{.RestartCount}}"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout.strip()
    return int(value)


def app_node_pid(container_id):
    output = subprocess.run(
        ["docker", "exec", container_id, "ps", "-o", "pid,args"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    ).stdout
    for line in output.splitlines():
        parts = line.strip().split(maxsplit=1)
        if len(parts) == 2 and parts[1].strip() == "node src/server.js":
            return int(parts[0])
    raise RuntimeError("Could not identify the app Node process inside the container.")


container_id = compose("ps", "-q", "app")
if not container_id:
    raise SystemExit("App container not found. Start it with: sudo docker compose up -d --build")
if not is_healthy():
    raise SystemExit("App health check is not passing before the test.")

measurements = []
restart_counts = []
for trial in range(1, TRIALS + 1):
    if not is_healthy():
        raise SystemExit(f"App was not healthy before trial {trial}.")
    before = restart_count(container_id)
    pid = app_node_pid(container_id)
    started = time.perf_counter()
    subprocess.run(
        ["docker", "exec", "--user", "0", container_id, "kill", "-KILL", str(pid)],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    deadline = started + TIMEOUT_SECONDS
    while time.perf_counter() < deadline:
        after = restart_count(container_id)
        if after > before and is_healthy():
            elapsed = time.perf_counter() - started
            measurements.append(round(elapsed, 3))
            restart_counts.append(after)
            print(f"Trial {trial}: container restart {before}->{after}; TTR={elapsed:.3f} s (local Docker Compose)")
            break
        time.sleep(0.1)
    else:
        raise SystemExit(f"Trial {trial}: Docker restart count did not increase and health did not recover within {TIMEOUT_SECONDS:.0f} s; no valid TTR recorded.")
    time.sleep(2.0)

summary = {
    "environment": "local Docker Compose; not an AWS deployment",
    "measured_at_utc": datetime.now(timezone.utc).isoformat(),
    "failure_injection": "SIGKILL to the Node server process inside the app container",
    "recovery_signal": "Docker RestartCount increased, then /api/health returned HTTP 200 with {ok:true}",
    "trials": measurements,
    "restart_counts_after_trials": restart_counts,
    "median_ttr_seconds": round(statistics.median(measurements), 3),
    "max_ttr_seconds": max(measurements),
    "valid_local_ttr_measured": True,
    "aws_ttr_measured": False,
}

out_dir = ROOT / "test-results"
out_dir.mkdir(exist_ok=True)
out_file = out_dir / "local-docker-recovery.json"
out_file.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(f"Median local TTR: {summary['median_ttr_seconds']:.3f} s")
print(f"Max local TTR: {summary['max_ttr_seconds']:.3f} s")
print(f"Saved: {out_file}")
