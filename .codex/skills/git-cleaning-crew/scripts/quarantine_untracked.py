#!/usr/bin/env python3
"""Move primary-checkout untracked entries aside without deleting content."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: quarantine_untracked.py OUTPUT_DIR", file=sys.stderr)
        return 2
    root = Path.cwd().resolve()
    output = Path(sys.argv[1]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    status = subprocess.run(["git", "status", "--porcelain=v1"], cwd=root, text=True, capture_output=True, check=True).stdout
    paths = []
    for line in status.splitlines():
        if line.startswith("?? "):
            relative = line[3:].rstrip("/")
            candidate = root / relative
            if candidate.exists() and not any(parent in paths for parent in candidate.parents):
                paths.append(candidate)
    moved = []
    for source in paths:
        relative = source.relative_to(root)
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        before = source.stat()
        os.rename(source, target)
        after = target.stat()
        if before.st_dev != after.st_dev or before.st_ino != after.st_ino:
            print(json.dumps({"error": "identity mismatch", "source": str(source), "target": str(target)}))
            return 1
        moved.append({"source": str(source), "target": str(target), "device": before.st_dev, "inode": before.st_ino})
    print(json.dumps({"count": len(moved), "moved": moved, "output": str(output)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
