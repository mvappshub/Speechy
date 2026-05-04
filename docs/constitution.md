# Constitution

Non-overridable rules. Changing any rule here requires a governance record in `docs/governance.md`.

## 1. Thin Entrypoints

`src/app/page.tsx` and `tts-server/server.py` must stay thin — they wire only. No business logic, no side effects beyond startup.

## 2. Dumb Presentation

UI files render and delegate. They do not own API calls, storage, polling, or model orchestration. A UI component may call application-layer hooks but must never call infrastructure or perform side effects directly.
UI may keep local visual state such as hover, focus, open menus, selected tabs, and draft form text. It must not own business state transitions, project synchronization, playback sequencing, polling loops, audio lifecycle, or retry/error workflow policy.

Forbidden in `ui`/`presentation` layers:
- `fetch`, `axios`, or any HTTP client
- `localStorage`, `sessionStorage`
- `Audio`, `WebSocket`
- Direct state management dispatch (use application hooks instead)
- Timer/scheduling calls (`setTimeout`, `setInterval`, `requestAnimationFrame`)

## 3. Pure Domain

Domain files stay pure. No `fetch`, `window`, `localStorage`, `Audio`, `FastAPI`, `torch`, or filesystem calls. Domain code must be testable with zero external dependencies.

## 4. Infrastructure Owns Effects

All external effects and adapters live in infrastructure. This includes API clients, audio playback, clipboard access, filesystem I/O, GPU runtime, and voice storage.

## 5. Application Coordinates

Application coordinates use cases and state transitions. It may call domain and infrastructure but must not contain JSX or HTTP route definitions.
Application modules must stay focused on one use case or one cohesive workflow. When an application hook/service accumulates multiple timelines, polling loops, external adapters, and mutable refs, split it before extending it.

## 6. No Dumping Grounds

New features must land under a feature folder, not in a global dumping ground. The following directory/file names are banned everywhere:
- `utils/`, `helpers/`, `common/`, `misc/`, `shared/`, `base/`

The only exceptions:
- `src/lib/utils.ts` — shadcn `cn()` utility, do not add more
- `src/components/ui/` — shadcn primitives only, do not add domain logic

## 7. Refactor Before Extend

When a file exceeds its LOC limit or a module's responsibility blurs, refactor before adding features. Do not extend a file that is already at its limit.

## 8. LOC Limits

| Category | Max LOC |
|---|---|
| Entrypoint (`page.tsx`, `server.py`) | 20 |
| UI component (per file) | 180 |
| Application service (per file) | 220 |
| Domain / Infrastructure module (per file) | 300 |
| Single function or method | 60 |

## 9. Change-Size Guard

A single feature change must not touch more than 8 files or add more than 400 net lines of code. If it does, split it into smaller changes.

## 10. No Speculative Abstraction

Do not introduce CQRS, event bus, mediator, plugin system, or enterprise ceremony. Add abstraction only when the codebase demonstrates the need through duplication or coupling, not in anticipation.

## 11. Minimum Test Coverage

Every pure domain function must have at least one reference test. Domain tests must run without network, filesystem, or browser APIs.

## 12. Architecture Rules Are Protected

Architecture rules can change only with an explicit governance record. See `docs/governance.md` for the change process.
