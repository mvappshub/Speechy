# Repository Guidelines

## Project Structure & Module Organization
The main app lives in `src/` and uses the Next.js App Router. Put routes and global styles in `src/app/`, keep only actively used UI helpers in `src/components/`, and place shared utilities in `src/lib/`. Reader-specific code lives under `src/features/reader/` split into `domain`, `application`, `infrastructure`, and `ui`. Static assets live in `public/`. The local text-to-speech backend entrypoint is `tts-server/server.py`, with implementation split across `tts-server/presentation`, `application`, `domain`, and `infrastructure`.

## Target Architecture & Layer Rules
The target architecture is strict separation of presentation from logic. Existing files that violate these rules are refactor debt, not precedent. Do not copy their shape into new code.

Frontend reader layers:
- `src/features/reader/ui/`: React presentation only. UI receives data, renders controls, manages local visual state such as hover/menu/focus, and calls callbacks or application hooks. UI must not call API clients, browser storage, audio adapters, polling loops, project synchronization, or workflow orchestration directly.
- `src/features/reader/application/`: use-case orchestration, React hooks, reducers, state transitions, and coordination between domain rules and infrastructure adapters. Application code may call infrastructure, but should keep long-running workflows split by responsibility.
- `src/features/reader/domain/`: pure rules, types, calculations, state machines, chunk/playback decisions, and text transforms. No React, browser APIs, API clients, timers, storage, or audio objects.
- `src/features/reader/infrastructure/`: external adapters only: TTS API, audio player, clipboard, local storage, and other browser or network effects. Infrastructure must not decide reader workflow policy.

Backend TTS layers:
- `tts-server/presentation/`: FastAPI routes, request/response models, HTTP status mapping, and serialization. No render orchestration or persistence policy.
- `tts-server/application/`: use cases and orchestration: project rendering, job lifecycle, progress, and coordination of runtime + storage. Split orchestration files before they become god objects.
- `tts-server/domain/`: pure Python rules and types. No filesystem, FastAPI, GPU, model, or network dependencies.
- `tts-server/infrastructure/`: filesystem stores, voice store, GPU checks, XTTS runtime, and audio/model adapters. Infrastructure provides capabilities; application decides workflow.

Current refactor targets:
- `useLongFormPlaybackSession.ts` should be split into focused application hooks/services for audio lifecycle, project polling, project preparation, and playback transitions.
- `useReaderController.ts` should not duplicate project hydration and workflow setup sequences.
- `JobService` should be split so legacy render jobs, project render orchestration, task registry, and audio assembly are not one object.
- `ProjectStore` should move domain decisions such as timeline/cache/status calculations out of raw persistence over time.

Before starting architecture refactors, use `docs/architecture/REFACTOR_PLAN.md` as the execution playbook. It contains the repo-specific invariants, stop conditions, extraction order, and verification commands. Do not treat it as optional background; it is the working checklist for reducing these hotspots safely.

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

## Local Git Note
On this Windows machine, PowerShell may not reliably resolve `git` from `PATH`, even when Git is installed and the path was previously fixed. Do not waste time re-debugging `PATH` for routine repo work. Use the installed Git executable directly:
- `C:\Program Files\Git\cmd\git.exe`

Example:
- `& 'C:\Program Files\Git\cmd\git.exe' status --short`

## Coding Style & Naming Conventions
Use 2-space indentation in both TypeScript and Python to match the existing files. Prefer TypeScript functional React components, `PascalCase` for component exports, and `camelCase` for hooks, helpers, variables, and functions. Keep route files in App Router defaults such as `page.tsx` and `layout.tsx`. Use Tailwind utilities for styling; keep shared primitives in `src/components/ui/`. Run `npm run lint` before opening a PR.

## Testing Guidelines
Use `npm run test` as the baseline automated gate and `npm run lint` as the structural/frontend gate. Then manually verify the main reading flow in the browser and confirm the TTS backend responds at `/api/health`. Keep tests out of `node_modules/`, and use `*.test.ts` or `*.spec.ts` naming for frontend tests.

## Commit & Pull Request Guidelines
The visible history is minimal and uses short imperative subjects (`Initial commit`). Follow that pattern: concise, present-tense commit messages focused on one change. Pull requests should include a short summary, affected areas, manual verification steps, and screenshots or recordings for UI changes. Call out schema or backend setup changes explicitly.

## Configuration Notes
Keep secrets in `.env` and do not commit local credentials or generated logs. Configure the frontend TTS backend via `NEXT_PUBLIC_TTS_API_BASE_URL` when the API is not available on `http://localhost:8000`. Large model files under `tts-server/` should only change when the voice or model setup intentionally changes.

## Knowledge Graph (Graphify)
This project has a knowledge graph at `graphify-out/` with 309 nodes, 410 edges, 16 communities.
- **God nodes** (most connected): `JobService`, `ProjectStore`, `XttsRuntime`, `JobServiceTests`
- **Cross-community bridges**: `JobService` connects backend job orchestration communities, `ProjectStore` connects persistence to job orchestration, `create_app()` connects HTTP presentation to runtime setup

For Codex: before answering architecture questions, tracing dependencies, searching broadly across files, or planning refactors/code-smell work, read `graphify-out/GRAPH_REPORT.md` first. Use Graphify whenever it is likely to reduce token usage or avoid broad raw-file scanning, especially for architecture questions, dependency tracing, code-smell discovery, refactor planning, unfamiliar subsystems, and cross-module impact analysis. Skip Graphify for narrow tasks where the exact file or symbol is already known and reading the graph would add more overhead than value. If local `graphify-out/graph.json` exists, use:
- `npm run graphify:query -- "question"` — query the graph (~1.7k tokens vs 100k+ naive)
- `npm run graphify:explain -- "ComponentName"` — plain-language explanation
- `npm run graphify:path -- "A" "B"` — shortest path between components

For refactor planning, use Graphify to identify likely hotspots such as god nodes, cross-community bridges, thin communities, and surprising inferred edges; then verify every finding directly in the source with targeted file reads, tests, lint, and dependency searches. Treat `INFERRED` edges as leads to verify in source files, not as facts. Graphify may miss integration paths across HTTP boundaries, so trace frontend API calls to backend routes manually when planning cross-stack changes. `graphify-out/graph.json`, `graph.html`, and cache files are generated local artifacts and intentionally ignored; only `graphify-out/GRAPH_REPORT.md` is tracked. `.graphifyignore` keeps local/generated folders out of the graph. Rebuild the local graph after major structural changes with `npm run graphify:build`, then commit only the updated report if it is still useful.

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

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
