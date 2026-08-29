#!/usr/bin/env python3
"""Remove all non-primary registered worktrees after archival."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path.cwd().resolve()
    requested = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 and sys.argv[1] == "--path" else None
    if len(sys.argv) not in (1, 3) or (len(sys.argv) == 3 and sys.argv[1] != "--path"):
        print("usage: remove_extra_worktrees.py [--path WORKTREE]", file=sys.stderr)
        return 2
    listing = subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=root, text=True, capture_output=True, check=True).stdout
    paths = [Path(line[9:]).resolve() for line in listing.splitlines() if line.startswith("worktree ")]
    if requested is not None:
        if requested == root or requested not in paths:
            print(json.dumps({"attempted": 0, "removed": 0, "failed": [{"path": str(requested), "exit_code": 2, "stderr": "not a removable registered worktree"}]}))
            return 1
        paths = [requested]
    results = []
    for path in paths:
        if path == root:
            continue
        try:
            result = subprocess.run(["git", "worktree", "remove", "--force", "--", str(path)], cwd=root, text=True, capture_output=True, timeout=30)
            results.append({"path": str(path), "exit_code": result.returncode, "stderr": result.stderr.strip()})
        except (OSError, subprocess.TimeoutExpired) as exc:
            results.append({"path": str(path), "exit_code": 125, "stderr": str(exc)})
    failed = [item for item in results if item["exit_code"] != 0]
    print(json.dumps({"attempted": len(results), "removed": len(results) - len(failed), "failed": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
