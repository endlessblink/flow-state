#!/usr/bin/env python3
"""Archive dirty registered worktrees without touching Git state."""
from __future__ import annotations

import json
import subprocess
import sys
import tarfile
from pathlib import Path

EXCLUDED = (".env", "credential", "token", "secret", "authorization")


def git(args: list[str], cwd: Path) -> tuple[int, str, str]:
    try:
        p = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, timeout=20)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 125, "", str(exc)


def protected(path: str) -> bool:
    lower = path.lower()
    return any(part == lower or needle in lower for part in (".env",) for needle in EXCLUDED) or any(x in lower for x in EXCLUDED[1:])


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: archive_dirty_worktrees.py OUTPUT_DIR", file=sys.stderr)
        return 2
    output = Path(sys.argv[1]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    code, listing, error = git(["worktree", "list", "--porcelain"], Path.cwd())
    if code:
        print(error or listing, file=sys.stderr)
        return code
    paths = [Path(line[9:]) for line in listing.splitlines() if line.startswith("worktree ")]
    results = []
    for index, path in enumerate(paths):
        code, status, error = git(["status", "--porcelain=v1"], path)
        if code or not status.strip():
            continue
        item_dir = output / f"worktree-{index:03d}"
        item_dir.mkdir()
        (item_dir / "path.txt").write_text(str(path) + "\n")
        (item_dir / "status.txt").write_text(status)
        head_code, head, _ = git(["rev-parse", "HEAD"], path)
        (item_dir / "head.txt").write_text(head if head_code == 0 else "unknown\n")
        tracked_args = ["diff", "--binary", "--", "."] + [f":(exclude)**/*{x}*" for x in EXCLUDED]
        _, diff, diff_error = git(tracked_args, path)
        (item_dir / "tracked.patch").write_text(diff)
        _, untracked, _ = git(["ls-files", "--others", "--exclude-standard"], path)
        safe = [p for p in untracked.splitlines() if p and not protected(p)]
        (item_dir / "untracked-manifest.txt").write_text("\n".join(safe) + ("\n" if safe else ""))
        with tarfile.open(item_dir / "untracked-safe.tar.gz", "w:gz") as archive:
            for relative in safe:
                candidate = path / relative
                if candidate.is_file() and not candidate.is_symlink():
                    archive.add(candidate, arcname=relative)
        results.append({"path": str(path), "archive": str(item_dir), "protected_or_skipped": len(untracked.splitlines()) - len(safe), "diff_error": diff_error or None})
    (output / "dirty-worktrees.json").write_text(json.dumps({"count": len(results), "items": results}, indent=2) + "\n")
    print(json.dumps({"count": len(results), "output": str(output)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
