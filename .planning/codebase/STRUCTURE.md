# Directory Structure

**Document:** STRUCTURE.md  
**Project:** Předčítač Českého Textu (Czech Text Reader)  
**Last Updated:** April 2026

---

## Project Root

```
speechy/
├── .codex/              # Codex-specific files
├── .github/             # GitHub workflows
├── .governance/         # Governance rules
├── .next/               # Next.js build output
├── .planning/           # GSD planning documents
├── .windsurf/           # Windsurf configuration
│   └── workflows/       # Custom workflows
├── docs/                # Documentation
├── node_modules/        # npm dependencies
├── public/              # Static assets
├── scripts/             # Build/dev scripts
├── src/                 # Frontend source
├── tts-server/          # Python TTS backend
├── .env                 # Environment variables
├── .gitignore           # Git ignore rules
├── AGENTS.md            # Repository guidelines
├── Caddyfile            # Caddy proxy config
├── README.md            # Project readme
├── bun.lock             # Bun lockfile
├── eslint.config.mjs    # ESLint config
├── next.config.mjs      # Next.js config
├── package.json         # npm manifest
├── postcss.config.mjs   # PostCSS config
├── tailwind.config.ts   # Tailwind config
└── tsconfig.json        # TypeScript config
```

---

## Frontend Source (`src/`)

```
src/
├── app/                      # Next.js App Router
│   ├── globals.css           # Global styles + Tailwind
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page (renders ReaderScreen)
├── components/               # Shared UI components
│   └── ui/                   # shadcn/ui primitives
│       ├── toast.tsx
│       └── toaster.tsx
├── features/                 # Feature modules
│   └── reader/               # Main reader feature
│       ├── application/      # Hooks, state, controllers
│       │   ├── readerActions.ts
│       │   ├── readerReducer.ts
│       │   ├── useLongFormPlaybackSession.ts
│       │   ├── useReaderController.ts
│       │   ├── useReaderHealthAndVoices.ts
│       │   └── useReaderSettings.ts
│       ├── domain/           # Business logic
│       │   ├── chunkSelection.test.ts
│       │   ├── chunkSelection.ts
│       │   ├── playback.test.ts
│       │   ├── playback.ts
│       │   ├── textCleaning.test.ts
│       │   ├── textCleaning.ts
│       │   └── types.ts
│       ├── infrastructure/   # External services
│       │   ├── audioPlayer.test.ts
│       │   ├── audioPlayer.ts
│       │   ├── clipboard.ts
│       │   ├── readerSettingsStore.ts
│       │   ├── ttsApi.test.ts
│       │   └── ttsApi.ts
│       └── ui/               # React components
│           ├── ErrorBanner.tsx
│           ├── PlaybackControls.tsx
│           ├── PlaybackView.tsx
│           ├── ProjectSelector.tsx
│           ├── ReaderScreen.tsx
│           ├── TextEditor.tsx
│           └── VoiceSelector.tsx
├── hooks/                    # Global React hooks
│   └── use-toast.ts
└── lib/                      # Shared utilities
    ├── chunking.ts
    └── utils.ts
```

---

## Backend Source (`tts-server/`)

```
tts-server/
├── application/              # Business logic
│   ├── __init__.py
│   └── job_service.py        # Job orchestration
├── domain/                   # Core logic
│   ├── __init__.py
│   ├── text_chunking.py      # Text splitting
│   └── types.py              # TypedDict models
├── infrastructure/           # External concerns
│   ├── __init__.py
│   ├── gpu.py                # GPU utilities
│   ├── project_store.py      # Project persistence
│   ├── voice_store.py        # Voice file management
│   └── xtts_runtime.py       # OmniVoice integration
├── presentation/             # HTTP layer
│   ├── __init__.py
│   └── http.py               # FastAPI routes
├── tests/                    # Unit tests
│   ├── test_chunking.py
│   ├── test_governance_guard.py
│   ├── test_http_app.py
│   └── test_job_service.py
├── tmp-jobs/                 # Runtime job storage
├── tmp-jobs-debug/           # Debug job output
├── voices/                   # Voice files (.wav)
├── server.py                 # Uvicorn entry point
└── start.sh                  # Startup script
```

---

## Key Naming Conventions

### TypeScript/React
- Components: `PascalCase` (e.g., `ReaderScreen.tsx`)
- Hooks: `camelCase` with `use` prefix (e.g., `useReaderController.ts`)
- Utilities: `camelCase` (e.g., `chunking.ts`)
- Tests: `.test.ts` suffix (e.g., `playback.test.ts`)

### Python
- Modules: `snake_case` (e.g., `job_service.py`)
- Classes: `PascalCase` (e.g., `JobService`)
- Functions: `snake_case` (e.g., `create_job`)

### Directories
- Layer names: lowercase (e.g., `domain/`, `application/`)
- Feature names: lowercase (e.g., `reader/`)

---

## Important File Paths

| Purpose | Path |
|---------|------|
| Frontend entry | `src/app/page.tsx` |
| Backend entry | `tts-server/server.py` |
| HTTP routes | `tts-server/presentation/http.py` |
| Main controller | `src/features/reader/application/useReaderController.ts` |
| Domain types | `src/features/reader/domain/types.ts` |
| API client | `src/features/reader/infrastructure/ttsApi.ts` |
| Main UI | `src/features/reader/ui/ReaderScreen.tsx` |
| Guidelines | `AGENTS.md` |

---

*Generated by gsd-map-codebase*
