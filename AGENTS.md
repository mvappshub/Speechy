# Repository Guidelines

## Project Structure & Module Organization
The main app lives in `src/` and uses the Next.js App Router. Put routes and global styles in `src/app/`, keep only actively used UI helpers in `src/components/`, and place shared utilities in `src/lib/`. Reader-specific code lives under `src/features/reader/` split into `domain`, `application`, `infrastructure`, and `ui`. Static assets live in `public/`. The local text-to-speech backend entrypoint is `tts-server/server.py`, with implementation split across `tts-server/presentation`, `application`, `domain`, and `infrastructure`.

## Build, Test, and Development Commands
- `npm run dev`: starts the Next.js app on port 3000 and writes output to `dev.log`.
- `npm run build`: creates a production standalone build under `.next/standalone`.
- `npm run start`: runs the production server from the standalone build.
- `npm run lint`: runs ESLint across the TypeScript codebase.
- `npm run test:frontend`: runs Node-based frontend domain/infrastructure tests.
- `npm run test:backend`: runs Python backend tests.
- `npm run test`: runs both frontend and backend tests.
- `npm run verify`: runs architecture/governance checks, tests, lint, and production build.
- `python -m unittest discover -s tts-server/tests -v`: runs backend unit tests for long-form chunking logic.
- `cd tts-server && python server.py`: starts the local FastAPI TTS service on port 8000.

## Coding Style & Naming Conventions
Use 2-space indentation in both TypeScript and Python to match the existing files. Prefer TypeScript functional React components, `PascalCase` for component exports, and `camelCase` for hooks, helpers, variables, and functions. Keep route files in App Router defaults such as `page.tsx` and `layout.tsx`. Use Tailwind utilities for styling; keep shared primitives in `src/components/ui/`. Run `npm run lint` before opening a PR.

## Testing Guidelines
Use `npm run test` as the baseline automated gate and `npm run lint` as the structural/frontend gate. Then manually verify the main reading flow in the browser and confirm the TTS backend responds at `/api/health`. Keep tests out of `node_modules/`, and use `*.test.ts` or `*.spec.ts` naming for frontend tests.

## Commit & Pull Request Guidelines
The visible history is minimal and uses short imperative subjects (`Initial commit`). Follow that pattern: concise, present-tense commit messages focused on one change. Pull requests should include a short summary, affected areas, manual verification steps, and screenshots or recordings for UI changes. Call out schema or backend setup changes explicitly.

## Configuration Notes
Keep secrets in `.env` and do not commit local credentials or generated logs. Configure the frontend TTS backend via `NEXT_PUBLIC_TTS_API_BASE_URL` when the API is not available on `http://localhost:8000`. Large model files under `tts-server/` should only change when the voice or model setup intentionally changes.

## Knowledge Graph (Graphify)
This project has a knowledge graph at `graphify-out/` with 769 nodes, 1159 edges, 24 communities.
- **God nodes** (most connected): `JobService`, `OmniVoice`, `RuleDurationEstimator`, `StreamLengthGroupDataset`
- **Cross-community bridges**: `OmniVoice` connects Community 0/1/2, `RuleDurationEstimator` connects 0/1

Before exploring code or tracing dependencies, read `graphify-out/GRAPH_REPORT.md` or use:
- `npm run graphify:query -- "question"` — query the graph (~1.7k tokens vs 100k+ naive)
- `npm run graphify:explain -- "ComponentName"` — plain-language explanation
- `npm run graphify:path -- "A" "B"` — shortest path between components

Rebuild graph after major changes: `npm run graphify:build`

## Codex Workflow Addendum
This repository also includes a project-local skill at `.codex/skills/karpathy-guidelines/SKILL.md`.

When working in this repo, prefer that workflow in addition to the rules above:
- surface assumptions before implementation when ambiguity would change the approach
- keep changes minimal and local to the requested behavior
- verify with the narrowest relevant repo command such as `npm run test:frontend`, `npm run test:backend`, `npm run lint`, or `npm run verify`
- report what was verified and what remains unverified

## Selective Superpowers Policy
In this project, do not auto-activate heavyweight superpowers workflows for greetings, casual chat, simple factual questions, translation, summarization, or obvious one-step housekeeping.

The `using-superpowers` skill is overridden here: treat it as optional guidance, not a mandatory startup step for every message.

Use `brainstorming` only when at least one of these is true:
- the user asks for ideas, product/design exploration, or architecture direction
- the request is ambiguous enough that different interpretations would lead to different implementations
- the work introduces a new feature, workflow, or UI behavior with meaningful tradeoffs

Skip `brainstorming` when the task is already concrete, narrow, and has clear success criteria.

Use `systematic-debugging` when there is a real failure signal:
- failing tests
- build or lint failures without an obvious single-line fix
- runtime bugs
- unexpected integration behavior across frontend, backend, and local TTS pieces

Do not invoke full debugging ceremony for obvious typo-level or copy-only fixes.

Use `test-driven-development` for bug fixes and behavior changes when the behavior can be tested at reasonable cost, especially in:
- `src/features/reader/`
- `src/lib/`
- `tts-server/`

TDD is preferred but not mandatory for:
- copy changes
- documentation edits
- styling-only tweaks
- configuration-only changes
- log message changes
- tasks where no meaningful automated test exists yet and creating one would dominate the task

Use `verification-before-completion` whenever code changed and you are about to claim something is fixed, complete, or passing.

If multiple process skills could apply, keep it lean:
- for ambiguous feature work: `brainstorming` first, then implement
- for bugs: `systematic-debugging` first, then `test-driven-development` for the regression test when practical
- do not stack multiple heavy workflows unless each one clearly adds value

This repository is operated by a non-programmer user. Optimize for:
- plain-language explanations
- one focused question at a time only when necessary
- fewer speculative refactors
- stronger guardrails against hallucinated assumptions and unnecessary code churn
