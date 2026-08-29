#!/usr/bin/env python3
"""Move registered non-primary worktrees aside without deleting their contents."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def worktrees(root: Path) -> list[Path]:
    result = subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=root, text=True, capture_output=True, check=True)
    return [Path(line[9:]).resolve() for line in result.stdout.splitlines() if line.startswith("worktree ")]


def active_cwd(path: Path) -> list[str]:
    active = []
    proc = Path("/proc")
    if not proc.exists():
        return active
    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        try:
            cwd = Path(os.path.realpath(entry / "cwd"))
            if cwd == path or path in cwd.parents:
                active.append(entry.name)
        except OSError:
            continue
    return active


def main() -> int:
    execute = "--execute" in sys.argv[1:]
    root = Path.cwd().resolve()
    entries = []
    failures = []
    for path in worktrees(root):
        if path == root:
            continue
        if not path.exists():
            entries.append({"path": str(path), "action": "prune_missing"})
            continue
        active = active_cwd(path)
        if active:
            failures.append({"path": str(path), "reason": "active_process_cwd", "pids": active})
            continue
        target = path.parent / (path.name + ".git-cleaning-crew-quarantine-20260829")
        if target.exists():
            failures.append({"path": str(path), "reason": "quarantine_target_exists", "target": str(target)})
            continue
        before = path.stat()
        item = {"path": str(path), "target": str(target), "device": before.st_dev, "inode": before.st_ino, "bytes": int(subprocess.run(["du", "-sx", "--bytes", str(path)], text=True, capture_output=True, check=True).stdout.split()[0]), "action": "move"}
        if target.parent.stat().st_dev != before.st_dev:
            failures.append({"path": str(path), "reason": "cross_device_target", "target": str(target)})
            continue
        if execute:
            os.rename(path, target)
            after = target.stat()
            item.update({"moved": True, "post_device": after.st_dev, "post_inode": after.st_ino, "post_bytes": int(subprocess.run(["du", "-sx", "--bytes", str(target)], text=True, capture_output=True, check=True).stdout.split()[0])})
            if after.st_dev != before.st_dev or after.st_ino != before.st_ino or item["bytes"] != item["post_bytes"]:
                failures.append({"path": str(path), "reason": "post_move_mismatch", "item": item})
        entries.append(item)
    print(json.dumps({"execute": execute, "count": len(entries), "moved": sum(x.get("moved", False) for x in entries), "failures": failures, "items": entries}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
