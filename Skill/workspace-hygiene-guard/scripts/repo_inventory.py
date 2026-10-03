#!/usr/bin/env python3
"""Produce a compact repository inventory to support search-before-create."""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from pathlib import Path

EXCLUDED_DIRS = {
    ".git", ".idea", ".vscode", ".cache", ".next", ".nuxt", ".output",
    ".turbo", ".expo", "node_modules", "dist", "build", "coverage",
    "target", "vendor", "Pods", "DerivedData", "__pycache__",
}
SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".kt", ".kts",
    ".sol", ".py", ".java", ".sql", ".graphql", ".gql", ".css",
    ".scss", ".json", ".yaml", ".yml", ".md",
}
SYMBOL_RE = re.compile(
    r"\b(?:export\s+)?(?:default\s+)?(?:class|interface|type|enum|function|const)\s+([A-Za-z_$][\w$]*)"
)


def iter_files(root: Path):
    for current, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        for name in sorted(files):
            path = Path(current) / name
            if path.suffix.lower() in SOURCE_EXTENSIONS:
                yield path


def classify(path: Path) -> str:
    name = path.name.lower()
    checks = (
        ("test", (".test.", ".spec.", "__tests__")),
        ("migration", ("migration",)),
        ("controller", ("controller",)),
        ("route/page", ("route", "page.", "screen")),
        ("component", ("component", ".tsx", ".jsx")),
        ("service/use-case", ("service", "use-case", "usecase", "handler")),
        ("repository", ("repository", "repo.")),
        ("entity/model", ("entity", "model", "schema")),
        ("config", ("config", ".yaml", ".yml")),
    )
    normalized = path.as_posix().lower()
    for category, needles in checks:
        if any(needle in name or needle in normalized for needle in needles):
            return category
    return "other"


def read_text(path: Path) -> str:
    try:
        if path.stat().st_size > 2_000_000:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--search", help="Case-insensitive filename/content term")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument("--max-matches", type=int, default=80)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    files = list(iter_files(root))
    categories = Counter(classify(path.relative_to(root)) for path in files)
    extensions = Counter(path.suffix.lower() for path in files)
    symbols: Counter[str] = Counter()
    matches: list[dict[str, object]] = []
    needle = args.search.casefold() if args.search else None

    for path in files:
        rel = path.relative_to(root).as_posix()
        text = read_text(path)
        for symbol in SYMBOL_RE.findall(text):
            symbols[symbol] += 1
        if needle and len(matches) < args.max_matches:
            lines = []
            if needle in rel.casefold():
                lines.append(0)
            for number, line in enumerate(text.splitlines(), 1):
                if needle in line.casefold():
                    lines.append(number)
                    if len(lines) >= 8:
                        break
            if lines:
                matches.append({"path": rel, "lines": lines})

    repeated_symbols = [
        {"symbol": name, "count": count}
        for name, count in symbols.most_common()
        if count > 1
    ][:30]
    result = {
        "root": str(root),
        "source_files": len(files),
        "categories": dict(sorted(categories.items())),
        "extensions": dict(sorted(extensions.items())),
        "repeated_export_names": repeated_symbols,
        "matches": matches,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"Repository: {root}")
    print(f"Source-like files: {len(files)}")
    print("Categories: " + ", ".join(f"{k}={v}" for k, v in sorted(categories.items())))
    print("Extensions: " + ", ".join(f"{k}={v}" for k, v in sorted(extensions.items())))
    if repeated_symbols:
        print("Repeated exported names (review; not automatically duplicates):")
        for item in repeated_symbols[:12]:
            print(f"  {item['symbol']}: {item['count']}")
    if needle:
        print(f"Matches for {args.search!r}: {len(matches)}")
        for item in matches:
            line_text = ",".join(str(value) for value in item["lines"])
            print(f"  {item['path']}:{line_text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
