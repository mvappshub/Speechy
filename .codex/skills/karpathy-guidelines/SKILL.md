---
name: karpathy-guidelines
description: Codex-optimized Karpathy-style working rules for this repository. Use when writing, reviewing, or refactoring code to reduce wrong assumptions, keep changes surgical, and verify outcomes with this repo's actual commands.
license: MIT
---

# Karpathy Guidelines For Codex In This Repo

These guidelines adapt the Karpathy-inspired workflow to Codex and to this repository's actual structure and verification commands.

Use them when implementing features, fixing bugs, reviewing code, or refactoring.

## 1. Think Before Coding

Before making changes:
- State assumptions explicitly instead of silently picking one interpretation.
- If the task is ambiguous and the ambiguity changes the implementation, pause and surface the tradeoff.
- Prefer discovering context from the repo first: inspect the relevant files, existing patterns, and tests before editing.
- Push back on approaches that add complexity without clear user value.

Repo-specific reminder:
- Reader code lives in `src/features/reader/`.
- Shared app code lives in `src/app/`, `src/components/`, and `src/lib/`.
- TTS backend code lives in `tts-server/`.

## 2. Simplicity First

Choose the smallest change that solves the requested problem.

- Avoid new abstractions unless they are already justified by repeated usage.
- Match the existing project style and architecture instead of introducing a new pattern.
- Do not add configurability, indirection, or speculative cleanup that the task did not require.
- Prefer a direct fix in the relevant module over cross-cutting rewrites.

## 3. Surgical Changes

Touch only code that is necessary for the task.

- Do not refactor nearby code unless the task requires it.
- Do not remove comments, formatting, or code you do not understand.
- Clean up only the dead imports, variables, or helper code created by your own changes.
- If you notice unrelated issues, mention them separately instead of bundling them into the same patch.

Success test:
- Every changed line should be traceable to the user's request or to direct fallout from the requested change.

## 4. Goal-Driven Verification

Turn work into explicit success criteria and verify them with this repository's real commands when they are relevant.

Preferred verification ladder:
1. Run the narrowest relevant test first.
2. Run broader project checks if the change affects shared behavior.
3. Report exactly what was verified and what was not run.

Repo-specific commands:
- Frontend tests: `npm run test:frontend`
- Backend tests: `npm run test:backend`
- Full tests: `npm run test`
- Lint: `npm run lint`
- Full gate: `npm run verify`
- Backend long-form chunking tests: `python -m unittest discover -s tts-server/tests -v`

Manual checks when relevant:
- Verify the main reading flow in the browser.
- Confirm the TTS backend responds at `/api/health`.

## 5. Codex Operating Notes

These points tailor the workflow to Codex specifically:

- Read before editing; do not infer architecture from filenames alone.
- Prefer `rg` for search and keep exploration targeted.
- Use `apply_patch` for file edits.
- Do not revert unrelated user changes in a dirty worktree.
- In final summaries, be concise and explicit about outcomes, verification, and remaining risks.

## 6. Practical Default

For non-trivial requests, follow this loop:

1. Understand the goal and inspect the relevant code.
2. Name assumptions or tradeoffs if they materially affect the solution.
3. Make the smallest viable change.
4. Verify with the narrowest relevant command.
5. Report what changed, what was verified, and any remaining caveats.
