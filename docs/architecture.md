# Architecture

This document defines where code belongs, what must not mix, and how to decide where new code goes.

## Scaffold Shape

```
├── src/
│   ├── app/                        # Next.js App Router (thin entrypoints only)
│   │   ├── page.tsx                # <= 20 LOC, delegates to feature UI
│   │   ├── layout.tsx              # App shell, providers, theme
│   │   └── globals.css
│   ├── components/ui/              # shadcn primitives only — no domain logic
│   ├── features/
│   │   └── reader/                 # Feature folder: one per bounded context
│   │       ├── domain/             # Pure logic, zero side effects
│   │       ├── application/        # Use-case orchestration, hooks, reducers
│   │       ├── infrastructure/     # External adapters (API, audio, storage)
│   │       └── ui/                 # React components (dumb presentation)
│   ├── hooks/                      # Global hooks (currently only shadcn toast)
│   └── lib/                        # Only shadcn cn() — no domain logic
├── tts-server/
│   ├── server.py                   # <= 20 LOC, wires FastAPI app
│   ├── presentation/               # HTTP routes, request/response models
│   ├── application/                # Job orchestration, service layer
│   ├── domain/                     # Pure logic (chunking, types)
│   ├── infrastructure/             # External adapters (GPU, voice store, XTTS)
│   └── tests/
├── docs/
│   ├── constitution.md             # Non-overridable rules
│   ├── architecture.md             # This file
│   └── governance.md               # Change process & protected area
├── scripts/
│   ├── architecture-check.mjs      # Enforces LOC limits, boundaries, no dumping grounds
│   └── protected-files-check.mjs   # Enforces mixed-diff ban
├── .github/workflows/ci.yml
├── CODEOWNERS
└── AGENTS.md                       # Codex operating manual
```

## Layer Boundaries — Frontend

```
ui ──→ application ──→ domain
                    ──→ infrastructure ──→ domain
```

| From        | May import                          | May NOT import           |
|-------------|--------------------------------------|--------------------------|
| `ui`        | `ui`, `application`, `domain`        | `infrastructure`         |
| `application` | `domain`, `infrastructure`, `application` | `ui`           |
| `infrastructure` | `domain`, `infrastructure`        | `application`, `ui`      |
| `domain`    | `domain` only                        | `ui`, `application`, `infrastructure` |

## Layer Boundaries — Backend

```
presentation ──→ application ──→ domain
             ──→ infrastructure ──→ domain
```

| From           | May import                                    | May NOT import           |
|----------------|-----------------------------------------------|--------------------------|
| `presentation` | `application`, `domain`, `infrastructure`    | —                        |
| `application`  | `domain`, `infrastructure`, `application`     | `presentation`           |
| `infrastructure` | `domain`, `infrastructure`                 | `application`, `presentation` |
| `domain`       | `domain` only                                 | `application`, `presentation`, `infrastructure` |

## Where New Code Goes

1. **Is it a pure calculation or type?** → `domain/`
2. **Does it call an external system (API, filesystem, GPU)?** → `infrastructure/`
3. **Does it coordinate domain + infrastructure for a use case?** → `application/`
4. **Is it a React component or HTTP route?** → `ui/` or `presentation/`
5. **Is it a new feature?** → Create a new folder under `src/features/<name>/` with the four layers

### Shared Helpers

There are no shared utility files. If two features need the same function, extract it into `domain/` within the feature that owns it. If it is genuinely cross-cutting (like `cn()` for CSS), it may live in `src/lib/utils.ts` — but this file must not grow beyond 10 LOC.

## What Must Not Mix

- **Domain code must not import infrastructure or application.** Domain is the innermost layer and must be testable in isolation.
- **UI must not import infrastructure or own workflow logic.** All side effects flow through application-layer hooks. UI can keep local visual state such as hover, menus, focus, and pending input text, but cannot own API calls, audio lifecycle, polling, project synchronization, or workflow transitions.
- **Application is not a dumping ground.** Application code coordinates use cases, but long-running workflows must be split by responsibility before a hook/service becomes a second UI layer with hidden mutable state.
- **Infrastructure provides capabilities, not policy.** API clients, stores, audio adapters, filesystem adapters, and model runtimes should not decide reader or project workflow rules.
- **No business logic in entrypoints.** `page.tsx` and `server.py` wire only.
- **No domain logic in `src/lib/` or `src/hooks/`.** These are shadcn scaffolding only. The existing `src/lib/chunking.ts` is a known violation that should be migrated to `src/features/reader/domain/`.
- **No side effects in `src/hooks/use-toast.ts`.** The existing file is shadcn-generated and contains side effects (timers, dispatch). It is grandfathered but must not be extended with domain logic.

## Existing Debt Is Not Precedent

The current codebase has several known architecture debts. These files may be touched only to reduce the debt, isolate behavior behind smaller seams, or add characterization tests before extraction:

- `src/features/reader/application/useLongFormPlaybackSession.ts`: split audio lifecycle, project polling, project preparation, and playback transition logic.
- `src/features/reader/application/useReaderController.ts`: remove duplicated project hydration and workflow setup sequences.
- `tts-server/application/job_service.py`: split legacy render jobs, project rendering, task registry, and audio assembly.
- `tts-server/infrastructure/project_store.py`: move cache/timeline/status policy toward domain/application so persistence stays mechanical.

Do not add new behavior to these files unless the change also makes the relevant responsibility smaller or better tested.

## Refactor Direction

Frontend target flow:

```
ui component -> application controller/hook -> domain rule
                                      -> infrastructure adapter
```

Backend target flow:

```
presentation route -> application use case -> domain rule
                                      -> infrastructure adapter
```

The direction is inward for rules and outward for effects. UI and HTTP routes translate user/API events into application calls; domain decides pure policy; infrastructure performs effects only when application asks it to.

## Refactor-Before-Extend Triggers

When any of these conditions are true, you must refactor before adding new features:

1. A file exceeds its LOC limit (see constitution §8)
2. A module has more than one reason to change
3. An import boundary is violated
4. A dumping-ground name appears (`utils/`, `helpers/`, `common/`, `misc/`, `shared/`, `base/`)
5. A function exceeds 60 LOC
