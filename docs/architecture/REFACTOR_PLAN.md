# Refactor Playbook: Speechy Architecture Recovery

This is an execution playbook for future refactor work. It is intentionally concrete: use it before editing so the refactor lowers risk instead of only moving code around.

## North Star

Speechy should have this dependency shape:

```text
Frontend:
ui -> application -> domain
                 -> infrastructure -> domain

Backend:
presentation -> application -> domain
                         -> infrastructure -> domain
```

Meaning:

- UI renders data and delegates events. It owns only local visual state: hover, open menus, focus, selected tab, transient draft input.
- Application owns workflows and state transitions. It may call domain and infrastructure, but each hook/service should coordinate one cohesive use case.
- Domain owns pure decisions: chunk selection, workflow stage transitions, timeline calculations, cache-key inputs, block readiness policy.
- Infrastructure owns effects only: API, audio element, object URLs, localStorage, clipboard, filesystem, model runtime, GPU checks.

If code does not clearly fit one of those bullets, stop and name the responsibility before adding it.

## Evidence Behind This Plan

These are verified repo facts, not guesses:

| Area | Evidence | Why it matters |
|---|---:|---|
| `JobService` | Graphify degree 41; source starts at `tts-server/application/job_service.py:19` | It is a god object and cross-community bridge. |
| `ProjectStore` | Graphify degree 27; source starts at `tts-server/infrastructure/project_store.py:24` | Persistence is coupled to project policy. |
| `useLongFormPlaybackSession` | 581 LOC; source starts at `src/features/reader/application/useLongFormPlaybackSession.ts:49` | One hook owns several timelines and side effects. |
| Playback mutable state | refs at lines 56-69 plus `tryPlayDesiredChunkRef` around 161 | Correctness depends on update order across many refs. |
| `useReaderController` | 293 LOC; source starts at `src/features/reader/application/useReaderController.ts:14` | It exceeds the application target and repeats project setup flows. |
| `ProjectStore.get_project()` | loads, recomputes timeline, saves, then returns | A read operation mutates storage. |
| `http.py:create_app()` | route factory contains dependency setup, serializers, and many routes | Presentation is doing too much composition. |

Graphify is a lead generator, not proof by itself. The bullets above were confirmed with source reads and line counts.

## Non-Negotiable Invariants

Do not break these while refactoring:

1. Existing public API routes and response shapes stay stable unless a separate API migration is explicitly planned.
2. Existing reader flows stay stable:
   - paste/edit text
   - split into blocks
   - choose global voice
   - choose per-block voice
   - create/open/rename/pin/delete project
   - play, pause, resume, stop
   - click a block during playback/rendering
   - download final project audio
3. Render cache behavior stays stable:
   - unchanged blocks reuse existing audio
   - changed text or voice regenerates only affected blocks
   - final audio is invalidated when block keys change
4. Error states remain observable:
   - prompt creation failure marks the job/project as error
   - block render failure marks only the failing path as error
   - frontend polling failures stop playback and surface the message once
5. Cleanup remains intact:
   - object URLs are revoked
   - audio stops when project/playback changes
   - cancelled backend tasks do not keep stale active jobs
   - deleted projects remove their project directory and block WAVs

If a proposed extraction makes any invariant harder to test or reason about, the extraction is too large.

## Refactor Rules During Execution

Use these rules every time:

1. Characterize behavior first when behavior is subtle. Prefer tests around pure decisions and adapter boundaries.
2. Extract without changing behavior first. Rename and improve only after tests pass.
3. Keep compatibility facades temporarily. Do not force every caller to change in the same patch.
4. One patch should have one reason to change. Do not mix frontend split, backend split, and governance tightening.
5. Do not move code into `domain` if it touches React, browser APIs, filesystem, FastAPI, torch, model runtime, timers, or network.
6. Do not move code into `infrastructure` if it decides workflow policy.
7. Do not add stricter architecture guards until the current code can pass them. Ratchet after cleanup, not before.

## Phase 0: Baseline Map And Tests

Purpose: make the next extraction safe.

Actions:

- Record current hotspots with:
  - `npm run graphify:explain -- "useLongFormPlaybackSession()"`
  - `npm run graphify:explain -- "JobService"`
  - targeted `rg` reads for imports, refs, and method lists
- Run the baseline checks before touching runtime code:
  - `npm run test:frontend`
  - `npm run test:backend`
  - `npm run check:architecture`

Add characterization tests only where behavior is not already covered:

- Frontend pure tests for:
  - next playable block selection
  - workflow stage after stop
  - project/playback status mapping
  - polling failure deduplication if extracted into a pure helper
- Backend tests for:
  - partial project edit regenerates only changed blocks
  - per-block voice change regenerates only that block
  - project render writes block WAVs into project directories
  - delete project removes project directory and block WAVs

Exit criteria:

- Current checks pass or known failures are written down before edits.
- The first extraction target has a test that can fail if behavior changes.

## Phase 1: Extract Frontend Project Preparation

Problem being solved:

`useLongFormPlaybackSession` currently owns `syncProject`, project opening, refreshes, progress application, and playback control. That makes project preparation inseparable from audio.

Target:

- Create `src/features/reader/application/useProjectPreparation.ts`.
- Move only project sync/open preparation there:
  - resolve block voices
  - call `syncProject`
  - apply project progress
  - refresh project list
  - return a `ProjectSnapshot`
- Keep audio, object URLs, and polling out of this hook.

Design boundary:

- It may import `ttsApi`, `readerActions`, domain types/rules.
- It must not import `createAudioPlayer`.
- It should expose small operations, not a second giant controller.

Likely first extraction:

- Move duplicated `syncProject` payload construction from `onPlay` and `prepareProject`.
- Keep `useLongFormPlaybackSession` as the caller during the first patch.

Exit criteria:

- `useLongFormPlaybackSession` no longer builds project sync payloads in multiple places.
- Project preparation can be tested/mocked without an audio element.
- `npm run test:frontend` passes.

## Phase 2: Extract Frontend Polling

Problem being solved:

Polling token lifecycle, render restart, readiness checks, and polling failure handling are interleaved with audio playback.

Target:

- Create `src/features/reader/application/useProjectPolling.ts`.
- Own:
  - polling token increment/cancel
  - `fetchProject`
  - `startProjectRender`
  - restart when a project is ready but incomplete
  - polling failure normalization/deduplication
- Accept callbacks:
  - `onProject(project)`
  - `tryStartPlayback()`
  - `onFailure(message)`

Design boundary:

- It may call `ttsApi`.
- It must not import `createAudioPlayer`.
- It must not directly know about object URLs.

Exit criteria:

- `pollProjectUntilReady`, `handlePollingFailure`, and `startPolling` are no longer in the long-form hook.
- Polling can be reasoned about without reading audio code.
- `npm run test:frontend` passes.

## Phase 3: Extract Frontend Audio Session

Problem being solved:

Audio object lifecycle, object URLs, active/pending playback refs, and block advancement are mixed with project sync and polling.

Target:

- Create `src/features/reader/application/useAudioPlaybackSession.ts`.
- Own:
  - `createAudioPlayer()`
  - `URL.createObjectURL`
  - `URL.revokeObjectURL`
  - current active block
  - pending load/request id
  - stop/pause/resume
  - element error mapping
- Accept callbacks:
  - `onEnded(nextIndex)`
  - `onPlaybackState(state)`
  - `onError(message)`

Design boundary:

- Only this application hook should call `createAudioPlayer`.
- Infrastructure still owns the actual `audioPlayer` adapter implementation.
- The hook should not call project sync.

Exit criteria:

- `useLongFormPlaybackSession` becomes composition of preparation + polling + audio.
- Object URL cleanup has one owner.
- Click-during-render/playback behavior is covered manually or by tests.
- `npm run test:frontend` and `npm run lint` pass.

## Phase 4: Deduplicate Reader Controller Hydration

Problem being solved:

`useReaderController` repeats the sequence "open project -> set text -> set block mode -> set workflow stage -> set block voices" across restore/open/rename/create paths.

Target:

- Add a focused application helper such as `applyProjectToReaderState(project, dispatch, options)`.
- Or add a hook-level command object inside `useReaderController` if it needs refs.
- Keep the canonical sequence in one place.

Exit criteria:

- Restore, open, rename-refresh, and create project paths call the same setup path.
- `useReaderController` drops below the application target or is clearly split into smaller hooks.
- `npm run test:frontend` passes.

## Phase 5: Extract Backend Task Registry

Problem being solved:

`JobService` owns task maps, cancellation, active counts, waits, shutdown, legacy jobs, and project render jobs.

Target:

- Create `tts-server/application/task_registry.py`.
- Own:
  - active task maps
  - create/cancel/wait/shutdown helpers
  - active count rules
- Keep it small and boring.

Design boundary:

- It should not know about XTTS, project storage, or FastAPI.
- It can be tested with simple async tasks.

Exit criteria:

- `JobService` no longer manually manages every task map operation.
- Backend tests pass: `npm run test:backend`.

## Phase 6: Split Backend Render Use Cases Behind A Facade

Problem being solved:

`JobService` contains both legacy `/api/render` jobs and project rendering. These are related but not one responsibility.

Target modules:

- `tts-server/application/render_job_service.py`
  - legacy text render jobs used by `/api/render`
  - job status, block audio, final audio
- `tts-server/application/project_render_service.py`
  - project render orchestration
  - prompt cache by voice
  - block render/write/update
  - project render errors
- `tts-server/application/audio_assembly.py`
  - assemble final audio from done project blocks
- `tts-server/application/job_service.py`
  - temporary facade preserving current public methods for `http.py` and tests

Do this in small patches:

1. Move pure helper methods first: inference option build, audio assembly, block render wrapper if safe.
2. Move project render path next: `render_project`, `_run_project`, `_assemble_project_audio`.
3. Move legacy render path last: `create_job`, `_run_job`, `get_job`, render audio getters.

Exit criteria:

- The facade still exposes the same methods used by `http.py`.
- Existing backend tests pass after each step.
- Graphify degree for `JobService` should fall after graph rebuild.

## Phase 7: Move Project Policy Out Of ProjectStore

Problem being solved:

`ProjectStore` is infrastructure but owns policy:

- cache key construction
- block reuse decisions
- timeline recomputation
- readiness/status fields
- `get_project()` saves as a side effect

Target:

- Create pure domain/application helpers:
  - `build_project_cache_key`
  - `build_synced_project_blocks`
  - `recompute_project_timeline`
  - `project_progress`
- Keep `ProjectStore` responsible for:
  - read JSON
  - write JSON
  - list project summaries
  - delete project directories
  - save/read audio file paths
  - legacy storage cleanup

Important:

- Do not remove migration/defaulting from `_read_project_file` until old project JSON compatibility is explicitly covered.
- Make read-time normalization explicit. If a loaded project needs migration, call it `load_project_with_migration` or similar rather than hiding writes in `get_project`.

Exit criteria:

- Timeline/cache helpers have tests without filesystem access.
- A plain read does not unexpectedly rewrite project JSON.
- Backend tests pass.

## Phase 8: Slim HTTP Presentation

Problem being solved:

`create_app()` currently contains app factory, dependency setup, parsing, serialization, and route handlers.

Target:

- Extract serializers into `tts-server/presentation/serializers.py`.
- Extract dependency construction into a small composition helper if useful.
- Keep route handlers as:
  - validate request
  - call application method
  - catch known errors
  - serialize response

Exit criteria:

- `create_app()` is easier to scan and route handlers do not contain render workflow decisions.
- `npm run test:backend` passes.

## Phase 9: Ratchet Enforcement

Only after the relevant files are below target:

- Update `scripts/check-architecture.mjs` to enforce:
  - frontend UI max LOC
  - frontend application max LOC
  - backend app/infrastructure max LOC
  - forbidden tokens by layer where practical
- Add a temporary allowlist only for explicitly named legacy files, with comments pointing to this playbook.
- Remove allowlist entries as each file is cleaned.

Exit criteria:

- `npm run check:architecture` catches new violations.
- `npm run verify` passes.
- Rebuild Graphify and confirm the former god nodes are reduced or at least split into named responsibilities.

## Stop Conditions

Stop and reassess if any of these happen:

- A patch requires changing UI, frontend application, backend application, and persistence at once.
- A new helper needs knowledge of both audio object URLs and project storage.
- A "domain" helper needs browser, filesystem, FastAPI, torch, or time-based side effects.
- A "store" or "service" starts taking more than five unrelated collaborators.
- Tests require excessive mocking because the extracted unit still does too much.
- The compatibility facade grows new behavior instead of delegating existing behavior.

## What Not To Do

- Do not introduce Zustand or a new state library just to imitate another project. This repo already has reducer/actions and the problem is responsibility boundaries, not missing tooling.
- Do not create generic `utils`, `helpers`, `shared`, or `common` folders.
- Do not split by noun only. Split by reason to change: polling, audio lifecycle, project preparation, task registry, project persistence.
- Do not tighten guards before the files can pass them; that creates noise instead of leverage.
- Do not rely on Graphify inferred edges as facts without source confirmation.

## Minimal Next Step

The safest first runtime refactor is:

1. Add/adjust tests around project preparation and playback status if needed.
2. Extract project sync payload construction from `useLongFormPlaybackSession` into a small application helper.
3. Run `npm run test:frontend`.

This reduces duplication without touching audio lifecycle or backend behavior, so it has the smallest blast radius.
