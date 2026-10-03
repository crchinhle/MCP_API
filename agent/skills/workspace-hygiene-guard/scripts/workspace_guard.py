#!/usr/bin/env python3
"""Snapshot and check a Git workspace for newly introduced clutter or duplicates."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

EXCLUDED_DIRS = {
    ".git", ".idea", ".vscode", ".cache", ".next", ".nuxt", ".output",
    ".turbo", ".expo", "node_modules", "dist", "build", "coverage",
    "target", "vendor", "Pods", "DerivedData", "__pycache__",
}
SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".kt", ".kts",
    ".sol", ".py", ".java", ".sql", ".graphql", ".gql", ".css", ".scss",
}
SUSPICIOUS_RE = re.compile(
    r"(?:\.(?:bak|backup|orig|rej|tmp|temp|swp|swo)$|(?:^|[-_. (])copy(?:[-_. )]|$)|final[-_. ]?final)",
    re.IGNORECASE,
)
SECRET_NAME_RE = re.compile(
    r"(?:^|/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|.*(?:private[-_]?key|credentials|secrets?).*)$",
    re.IGNORECASE,
)
GENERATED_TOP_LEVEL = {"dist", "build", "coverage", "playwright-report", "test-results"}


def run_git(root: Path, *args: str) -> tuple[int, str]:
    process = subprocess.run(
        ["git", "-C", str(root), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    return process.returncode, process.stdout


def git_files(root: Path) -> tuple[bool, set[str], set[str], str]:
    code, tracked_raw = run_git(root, "ls-files", "-z")
    if code != 0:
        return False, set(), set(), "Git repository not detected"
    _, untracked_raw = run_git(root, "ls-files", "--others", "--exclude-standard", "-z")
    _, status_raw = run_git(root, "status", "--porcelain=v1", "-z")
    tracked = {item for item in tracked_raw.split("\0") if item}
    untracked = {item for item in untracked_raw.split("\0") if item}
    return True, tracked, untracked, status_raw


def iter_source_files(root: Path):
    for current, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        for name in sorted(files):
            path = Path(current) / name
            if path.suffix.lower() in SOURCE_EXTENSIONS:
                yield path


def hash_file(path: Path) -> str | None:
    try:
        size = path.stat().st_size
        if size < 80 or size > 2_000_000:
            return None
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def duplicate_groups(root: Path) -> list[list[str]]:
    by_hash: dict[str, list[str]] = {}
    for path in iter_source_files(root):
        digest = hash_file(path)
        if digest:
            by_hash.setdefault(digest, []).append(path.relative_to(root).as_posix())
    return sorted(
        [sorted(paths) for paths in by_hash.values() if len(paths) > 1],
        key=lambda group: group[0],
    )


def suspicious_paths(untracked: set[str]) -> list[str]:
    findings = []
    for value in sorted(untracked):
        path = Path(value)
        top = path.parts[0] if path.parts else ""
        if SUSPICIOUS_RE.search(value) or SECRET_NAME_RE.search(value) or top in GENERATED_TOP_LEVEL:
            findings.append(value)
    return findings


def collect(root: Path) -> dict[str, object]:
    is_git, tracked, untracked, status = git_files(root)
    return {
        "version": 1,
        "root": str(root),
        "git": is_git,
        "tracked": sorted(tracked),
        "untracked": sorted(untracked),
        "status_sha256": hashlib.sha256(status.encode()).hexdigest(),
        "suspicious": suspicious_paths(untracked),
        "duplicates": duplicate_groups(root),
    }


def write_snapshot(path: Path, data: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    snapshot = sub.add_parser("snapshot")
    snapshot.add_argument("--root", default=".")
    snapshot.add_argument("--output", required=True)
    check = sub.add_parser("check")
    check.add_argument("--root", default=".")
    check.add_argument("--baseline", required=True)
    scan = sub.add_parser("scan")
    scan.add_argument("--root", default=".")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    current = collect(root)

    if args.command == "snapshot":
        output = Path(args.output).resolve()
        write_snapshot(output, current)
        print(f"Workspace baseline saved outside repository: {output}")
        print(f"Tracked={len(current['tracked'])} untracked={len(current['untracked'])}")
        return 0

    if args.command == "scan":
        print(json.dumps(current, ensure_ascii=False, indent=2))
        return 1 if current["suspicious"] else 0

    baseline_path = Path(args.baseline).resolve()
    try:
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read baseline {baseline_path}: {exc}")
        return 2

    baseline_untracked = set(baseline.get("untracked", []))
    current_untracked = set(current.get("untracked", []))
    new_untracked = current_untracked - baseline_untracked
    new_suspicious = [path for path in current["suspicious"] if path in new_untracked]
    old_duplicate_sets = {tuple(group) for group in baseline.get("duplicates", [])}
    new_duplicate_groups = [
        group for group in current["duplicates"]
        if tuple(group) not in old_duplicate_sets and any(path in new_untracked for path in group)
    ]

    problems = False
    if new_suspicious:
        problems = True
        print("BLOCK: newly introduced suspicious/unignored artifacts:")
        for path in new_suspicious:
            print(f"  {path}")
    if new_duplicate_groups:
        problems = True
        print("BLOCK: newly introduced source files duplicate existing content:")
        for group in new_duplicate_groups:
            print("  " + " == ".join(group))
    if not current["git"]:
        print("WARN: Git repository not detected; new-file scope checks are limited")
    if not problems:
        print(f"Workspace hygiene check passed; new untracked files={len(new_untracked)}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
