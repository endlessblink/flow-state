#!/usr/bin/env python3
"""Delete non-main local branches only after recovery-bundle verification."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=Path.cwd(), text=True, capture_output=True, timeout=60)


def main() -> int:
    args = sys.argv[1:]
    archive = False
    if len(args) == 2 and args[0] in {"--branch", "--archive-branch"}:
        branch = args[1]
        archive = args[0] == "--archive-branch"
    else:
        print("usage: cleanup_local_branches.py --branch <exact-branch>", file=sys.stderr)
        return 2
        return 2
    bundle = Path("/media/endlessblink/data/.dev-tmp/endlessblink/git-cleaning-crew-20260829-001/all-local-branches.bundle")
    supplementals = sorted(bundle.parent.glob("supplemental-*.bundle"))
    current = run(["git", "branch", "--show-current"]).stdout.strip()
    if current != "main":
        print(json.dumps({"error": "primary checkout is not main", "current": current}))
        return 1
    verified = run(["git", "bundle", "verify", str(bundle)])
    if verified.returncode:
        print(json.dumps({"error": "recovery bundle verification failed", "stderr": verified.stderr}))
        return 1
    if branch == "main":
        print(json.dumps({"error": "refusing to remove main"}))
        return 1
    tip = run(["git", "rev-parse", "--verify", f"refs/heads/{branch}"])
    if tip.returncode:
        print(json.dumps({"error": "branch not found", "branch": branch}))
        return 1
    bundle_heads = run(["git", "bundle", "list-heads", str(bundle)])
    supplemental_heads = "\n".join(run(["git", "bundle", "list-heads", str(path)]).stdout for path in supplementals)
    if tip.stdout.strip() not in bundle_heads.stdout and tip.stdout.strip() not in supplemental_heads:
        print(json.dumps({"error": "branch tip is not present in recovery bundle", "branch": branch, "tip": tip.stdout.strip()}))
        return 1
    merged = run(["git", "merge-base", "--is-ancestor", f"refs/heads/{branch}", "main"]).returncode == 0
    if archive:
        archive_ref = f"refs/archive/local-branches/{branch}"
        saved = run(["git", "update-ref", archive_ref, tip.stdout.strip()])
        if saved.returncode:
            print(json.dumps({"error": "failed to create archive ref", "branch": branch, "stderr": saved.stderr.strip()}))
            return 1
        saved_tip = run(["git", "rev-parse", "--verify", archive_ref])
        if saved_tip.returncode or saved_tip.stdout.strip() != tip.stdout.strip():
            print(json.dumps({"error": "archive ref verification failed", "branch": branch, "archive_ref": archive_ref}))
            return 1
        result = run(["git", "branch", "-D", "--", branch])
        print(json.dumps({"bundle_verified": True, "branch": branch, "tip": tip.stdout.strip(), "archived_ref": archive_ref, "deleted": result.returncode == 0, "stderr": result.stderr.strip()}, indent=2))
        return result.returncode
    mode = "-d" if merged else "-D"
    result = run(["git", "branch", mode, "--", branch])
    print(json.dumps({"bundle_verified": True, "branch": branch, "tip": tip.stdout.strip(), "merged_into_main": merged, "deleted": result.returncode == 0, "stderr": result.stderr.strip()}, indent=2))
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
