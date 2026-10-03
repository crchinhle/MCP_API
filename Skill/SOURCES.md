# Skill sources

This bundle keeps each skill independent so Codex can route by `name` and `description` instead of loading one oversized skill. Imported content is unchanged except for harmless whitespace normalization.

## Third-party sources

- Superpowers skills: https://github.com/obra/superpowers at commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` (MIT). Included as the complete upstream `skills/` set.
- `search-first`: https://github.com/affaan-m/ECC at commit `06c5e118c4d3e6c3b7f9445f973a2194c82de193` (MIT).
- API, CI/CD, simplification, context, doubt, frontend, observability, security, and source-driven skills: https://github.com/addyosmani/agent-skills at commit `df1edb2e05487d0aa6d93c747141e0aed1187f25` (MIT).
- `webapp-testing`: https://github.com/anthropics/skills at commit `f6656c1256d5a8adfa37db9110046ef20bac644c`; use under the license included with that skill.

License texts are stored in `_licenses/` and, where supplied upstream, inside the corresponding skill directory.

## Project-specific skills

- `license-platform-builder`: workflow and domain boundaries for the license sales and key-management platform.
- `workspace-hygiene-guard`: deterministic inspect-before-edit and workspace cleanliness checks.

These two project-specific skills were prepared for this project and include their complete references, scripts, assets, and Codex metadata.
