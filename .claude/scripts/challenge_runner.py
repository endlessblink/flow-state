#!/usr/bin/env python3
"""Validate a snapshot-bound FlowState challenge-review result."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SHA256 = re.compile(r"^[0-9a-f]{64}$")


def fail(reason: str, snapshot_hash: str | None = None) -> int:
    result = {
        "verdict": "BLOCKED",
        "snapshot": snapshot_hash or "unavailable",
        "findings": [{
            "id": "challenge-runner",
            "severity": "Critical",
            "evidence": reason,
            "scope": "challenge protocol",
            "remediation": "Supply valid snapshot-bound reviewer JSON and complete every acceptance gate.",
        }],
        "review_count": 0,
    }
    print(json.dumps(result, sort_keys=True))
    return 2


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read valid JSON from {path}: {exc}") from exc


def acceptance_items(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    raw = snapshot.get("acceptance")
    if not isinstance(raw, list) or not raw:
        raise ValueError("snapshot acceptance must be a non-empty list")
    items = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError("every acceptance item needs a string id")
        if item["id"] in {entry["id"] for entry in items}:
            raise ValueError(f"duplicate acceptance id: {item['id']}")
        items.append(item)
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--review", required=True, type=Path)
    args = parser.parse_args()

    try:
        snapshot_bytes = args.snapshot.read_bytes()
        snapshot_hash = hashlib.sha256(snapshot_bytes).hexdigest()
        snapshot = json.loads(snapshot_bytes)
        if not isinstance(snapshot, dict):
            return fail("snapshot root must be a JSON object", snapshot_hash)
        if snapshot.get("schema") != "flowstate-stability-challenge-snapshot-v1":
            return fail("unsupported snapshot schema", snapshot_hash)
        items = acceptance_items(snapshot)
        review = load_json(args.review)
        if not isinstance(review, dict):
            return fail("review root must be a JSON object", snapshot_hash)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return fail(str(exc))

    if review.get("snapshot") != snapshot_hash:
        return fail("review is not bound to the supplied snapshot SHA-256", snapshot_hash)
    if review.get("review_count") != 1:
        return fail("review_count must be exactly 1", snapshot_hash)
    reviewer = review.get("reviewer")
    if not isinstance(reviewer, dict):
        return fail("reviewer metadata is missing", snapshot_hash)
    if reviewer.get("authority") != "read-only":
        return fail("reviewer authority is not read-only", snapshot_hash)
    if not isinstance(reviewer.get("context_id"), str) or not reviewer["context_id"].strip():
        return fail("reviewer context_id is missing", snapshot_hash)
    if not isinstance(reviewer.get("isolation_evidence"), str) or not reviewer["isolation_evidence"].strip():
        return fail("reviewer isolation_evidence is missing", snapshot_hash)
    if not isinstance(review.get("remaining_risks"), (str, list)):
        return fail("remaining_risks is missing", snapshot_hash)
    verdict = review.get("verdict")
    if verdict not in {"PASS", "REVISE", "BLOCKED"}:
        return fail("review verdict is malformed", snapshot_hash)
    if verdict != "PASS":
        print(json.dumps(review, sort_keys=True))
        return 2
    if review.get("findings"):
        return fail("PASS review contains findings", snapshot_hash)

    evidence = review.get("evidence")
    if not isinstance(evidence, list):
        return fail("PASS review has no evidence list", snapshot_hash)
    by_id = {entry.get("item_id"): entry for entry in evidence if isinstance(entry, dict)}
    expected_ids = {item["id"] for item in items}
    if set(by_id) != expected_ids:
        return fail("evidence does not cover exactly every acceptance item", snapshot_hash)
    root = Path.cwd()
    for item in items:
        if item.get("status") != "PASS":
            return fail(f"acceptance item is not PASS: {item['id']}", snapshot_hash)
        proof = by_id.get(item["id"])
        if not proof or proof.get("status") != "PASS":
            return fail(f"missing PASS evidence: {item['id']}", snapshot_hash)
        if proof.get("bound_snapshot_sha256") != snapshot_hash:
            return fail(f"evidence hash binding mismatch: {item['id']}", snapshot_hash)
        for field in ("producer_id", "authority", "captured_at", "result"):
            if not isinstance(proof.get(field), str) or not proof[field].strip():
                return fail(f"evidence metadata missing {field}: {item['id']}", snapshot_hash)
        artifact = proof.get("artifact_path_or_id")
        artifact_hash = proof.get("artifact_sha256")
        if not isinstance(artifact, str) or not isinstance(artifact_hash, str) or not SHA256.fullmatch(artifact_hash):
            return fail(f"evidence artifact hash missing: {item['id']}", snapshot_hash)
        artifact_path = root / artifact
        if not artifact_path.is_file():
            return fail(f"evidence artifact unavailable: {item['id']}", snapshot_hash)
        if hashlib.sha256(artifact_path.read_bytes()).hexdigest() != artifact_hash:
            return fail(f"evidence artifact hash mismatch: {item['id']}", snapshot_hash)

    print(json.dumps({"verdict": "PASS", "snapshot": snapshot_hash, "acceptance_count": len(items)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
