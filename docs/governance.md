# Governance

Architecture rules are protected assets. This document defines how they change, what is protected, and how the system prevents accidental erosion.

## Change Classification

| Type | Description | Process |
|---|---|---|
| **Governance change** | Modifies a rule in `docs/constitution.md`, `docs/architecture.md`, `docs/governance.md`, or the enforcement scripts | Requires governance record + code owner review |
| **Feature change** | Adds or modifies runtime code (domain, application, infrastructure, ui/presentation) | Normal PR process |
| **Hybrid change** | Touches both governance and runtime code | **Banned.** Must split into separate PRs |

## Protected Governance Area

The following files are governance-protected. Any change to them requires a governance record:

- `docs/constitution.md`
- `docs/architecture.md`
- `docs/governance.md`
- `AGENTS.md`
- `tts-server/AGENTS.md` (if it exists)
- `.github/workflows/ci.yml`
- `CODEOWNERS`
- `scripts/architecture-check.mjs`
- `scripts/protected-files-check.mjs`
- `eslint.config.mjs` (lint configuration)
- `tsconfig.json` (typecheck configuration)
- `package.json` (only the `scripts` section — build/lint/test commands)

## Governance Record

When a governance-protected file changes, the PR must include an entry in this file's **Change Log** section below explaining:

1. **What rule changed** — the specific rule, limit, or boundary that was modified
2. **Why the existing rule was insufficient** — what real scenario the old rule could not handle
3. **Which new risk is accepted** — what could go wrong that the old rule prevented

A PR that changes a protected file without a governance record will fail the `protected-files-check` CI step.

## Mixed Diff Ban

A single PR must not touch both governance-protected files and runtime/feature code. This prevents hiding governance erosion inside feature work.

**Enforcement:** The `scripts/protected-files-check.mjs` script compares the list of changed files against the protected set. If the diff contains at least one protected file and at least one non-protected runtime file, the check fails.

**Exceptions:**
- Changes to `package.json` that only touch the `scripts` section are governance changes; changes to `dependencies`/`devDependencies` are feature changes. If both change, split the PR.
- Documentation-only changes to non-constitutional docs (README, etc.) are not governance changes.

## Change-Size Guard

A feature change must not exceed:
- **8 files touched** (excluding test files)
- **400 net lines added**

If a change exceeds these limits, split it into smaller PRs. This prevents large undiffable diffs and makes review tractable.

## Ratchet Principle

Rules can only tighten, never loosen, without explicit governance review. If a limit is 180 LOC for UI components, a PR that raises it to 200 requires a governance record. A PR that lowers it to 150 does not (but is still a governance change since it modifies a rule).

## Exception Process

If a governance rule must be temporarily suspended (e.g., during an emergency hotfix):

1. Add a time-boxed exception entry to the Change Log below
2. The exception must include: the rule suspended, the reason, and the expiry date
3. The exception automatically expires after 7 days
4. No exception may be renewed without a full governance review

## Hosting-Level Requirements

These are enforced at the GitHub repository level, not in code:

1. **Protected `main` branch** — no direct pushes, all changes via PR
2. **Required status checks** — CI must pass before merge
3. **Required PR review** — at least one approval from a code owner
4. **Code owner review** — changes to protected files require code owner approval (enforced by CODEOWNERS)
5. **No merge on failed checks** — branch protection must block merge if any required check fails

## Change Log

- **2026-05-01**: Tightened the UI/application separation rule after Graphify review found playback and backend orchestration hotspots. Clarified that UI may keep only local visual state, application workflows must be split before extension, existing hotspots are refactor debt rather than precedent, and entrypoints are capped at 20 LOC to match the active architecture check. Accepted risk: the documented target is stricter than several current files, so refactor work must reduce those violations incrementally instead of enabling a failing guard all at once.
- **2026-04-15**: Consolidated governance from `docs/architecture/CONSTITUTION.md`, `BOUNDARIES.md`, and `GOVERNANCE.md` into canonical `docs/constitution.md`, `docs/architecture.md`, and `docs/governance.md`. Expanded rules to include LOC limits per category, dumping-ground ban, mixed-diff ban, change-size guard, refactor-before-extend triggers, forbidden API in presentation, and hosting-level requirements. Retired `.governance/GOVERNANCE_CHANGE.md` in favor of the Change Log in this file.
- **2026-04-14**: Introduced layered reader and TTS architecture, plus automated boundary checks and hotspot limits.
