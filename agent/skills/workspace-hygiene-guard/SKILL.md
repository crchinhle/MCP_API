---
name: workspace-hygiene-guard
description: Inspect and protect a source repository before, during, and after coding. Use before creating files, scaffolding, refactoring, adding dependencies or migrations, and before handoff to find existing implementations, prevent duplicate components/services/types/tests, preserve unrelated user changes, and block temporary files, generated output, backups, copies, secrets, and other workspace clutter.
---

# Workspace Hygiene Guard

Apply a search-before-create protocol and deterministic pre/post checks. Keep legitimate user changes intact.

## 1. Capture the baseline

From the repository root, run:

```bash
python3 <skill-path>/scripts/workspace_guard.py snapshot --root . --output /tmp/workspace-guard.json
python3 <skill-path>/scripts/repo_inventory.py --root .
```

If Git is unavailable, continue with the filesystem inventory and say that change-scope checks are limited.

## 2. Search before creating

For every proposed component, hook, service, DTO, type, utility, repository, migration, endpoint, queue, test helper, or configuration file:

1. Search by intended filename, symbol, route, table, event, and business phrase.
2. Inspect nearby call sites and analogous modules.
3. Reuse or extend an existing owner when responsibility matches.
4. Create a file only when it has a distinct responsibility and a natural location.
5. Record the reason for a new abstraction or dependency in the task handoff when it is not obvious.

Use `repo_inventory.py --search '<term>'` for a quick cross-file scan, then verify with `rg`.

## 3. Work without contamination

Follow [policy.md](references/policy.md). Use a temporary directory outside the repository for generated previews, downloaded references, debug logs, screenshots, exports, and experimental code. Do not rename the user's existing files to “old”, “backup”, or “final”. Do not run broad formatters over untouched files.

## 4. Check the result

Run:

```bash
python3 <skill-path>/scripts/workspace_guard.py check --root . --baseline /tmp/workspace-guard.json
git diff --check
git status --short
```

Treat new duplicate-content source files, editor backups, copy-suffixed files, unignored build/coverage directories, rejected patches, and secret-like filenames as blockers until explained or removed. Do not delete anything that predates the baseline.

## 5. Handoff

State which existing code was reused, every intentionally new file, checks run, and any warning deliberately retained. Never describe the workspace as clean solely because tests passed.
