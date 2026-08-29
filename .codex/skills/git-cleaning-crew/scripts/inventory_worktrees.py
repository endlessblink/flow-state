#!/usr/bin/env python3
"""Bounded, read-only worktree inventory for git-cleaning-crew."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def run(*args: str, cwd: Path | None = None, timeout: float = 8.0) -> tuple[int, str, str]:
    try:
        p = subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as exc:
        return 124, (exc.stdout or ""), "timeout"
    except OSError as exc:
        return 125, "", str(exc)


def main() -> int:
    root = Path.cwd()
    summary_only = "--summary" in sys.argv[1:]
    code, stdout, stderr = run("git", "worktree", "list", "--porcelain", cwd=root)
    if code:
        print(json.dumps({"error": stderr or stdout, "exit_code": code}))
        return code

    paths = [Path(line[9:]) for line in stdout.splitlines() if line.startswith("worktree ")]
    items = []
    for path in paths:
        code, status, error = run("git", "status", "--porcelain=v1", cwd=path)
        head_code, head, head_error = run("git", "rev-parse", "HEAD", cwd=path)
        items.append(
            {
                "path": str(path),
                "status_count": len(status.splitlines()) if code == 0 else None,
                "status": status.splitlines() if code == 0 else [],
                "head": head.strip() if head_code == 0 else None,
                "error": error or head_error or None,
                "ok": code == 0 and head_code == 0,
            }
        )

    if summary_only:
        print(json.dumps({
            "worktree_count": len(items),
            "dirty_count": sum((x.get("status_count") or 0) > 0 for x in items),
            "failed_count": sum(not x["ok"] for x in items),
            "dirty_paths": [x["path"] for x in items if (x.get("status_count") or 0) > 0],
            "failed_paths": [x["path"] for x in items if not x["ok"]],
        }, indent=2))
    else:
        print(json.dumps({"worktree_count": len(items), "items": items}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
