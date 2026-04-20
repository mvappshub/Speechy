# Architecture

**Document:** ARCHITECTURE.md  
**Project:** Předčítač Českého Textu (Czech Text Reader)  
**Last Updated:** April 2026

---

## System Overview

```
┌─────────────────┐      HTTP/REST       ┌─────────────────┐
│   Next.js App   │  ←────────────────→  │  FastAPI TTS    │
│   (Port 3000)   │                      │  (Port 8000)    │
└─────────────────┘                      └─────────────────┘
│  ┌───────────┐  │                      │  ┌───────────┐  │
│  │  Reader   │  │                      │  │  Job      │  │
│  │  Feature  │  │                      │  │  Service  │  │
│  │  (domain/ │  │                      │  │           │  │
│  │  app/     │  │                      │  │           │  │
│  │  infra/   │  │                      │  │           │  │
│  │  ui)      │  │                      │  │           │  │
│  └───────────┘  │                      │  └───────────┘  │
│       ↑         │                      │       ↑         │
│  ┌───────────┐  │                      │  ┌───────────┐  │
│  │  TTS API  │  │                      │  │  XTTS     │  │
│  │  Client   │  │                      │  │  Runtime  │  │
│  └───────────┘  │                      │  └───────────┘  │
└─────────────────┘                      └─────────────────┘
```

---

## Frontend Architecture

### Layer Pattern (Clean Architecture)

**src/features/reader/** is organized in layers:

```
reader/
├── domain/          # Business logic, pure functions
│   ├── types.ts     # Domain types (Voice, Project, PlaybackState)
│   ├── chunkSelection.ts
│   ├── playback.ts
│   └── textCleaning.ts
├── application/     # Use cases, state management
│   ├── useReaderController.ts   # Main controller hook
│   ├── useReaderSettings.ts
│   ├── useLongFormPlaybackSession.ts
│   ├── readerActions.ts
│   └── readerReducer.ts
├── infrastructure/  # External services, I/O
│   ├── ttsApi.ts    # HTTP client for backend
│   ├── audioPlayer.ts
│   └── readerSettingsStore.ts
└── ui/              # React components
    ├── ReaderScreen.tsx    # Main screen
    ├── TextEditor.tsx
    ├── PlaybackControls.tsx
    ├── VoiceSelector.tsx
    ├── ProjectSelector.tsx
    └── ...
```

### State Management

**Controller Pattern:**
- `useReaderController()` — Central hook aggregating all state and actions
- Returns controller object consumed by UI components
- Combines React Query (server state) + Zustand (local state)

**Data Flow:**
```
User Action → Controller Hook → Service/Reducer → API/State → UI Update
```

### Component Architecture

**Page:** `src/app/page.tsx` → Renders `ReaderScreen`

**Layout:** `src/app/layout.tsx`
- Inter + Roboto Mono fonts
- Czech language (`lang="cs"`)
- Toaster for notifications

---

## Backend Architecture

### Layered Architecture (Python)

```
tts-server/
├── presentation/    # HTTP layer
│   └── http.py      # FastAPI routes, Pydantic models
├── application/     # Business logic
│   └── job_service.py   # Job orchestration, project management
├── domain/          # Core logic
│   ├── types.py     # TypedDict models
│   └── text_chunking.py # Text splitting algorithm
└── infrastructure/  # External concerns
    ├── xtts_runtime.py    # OmniVoice integration
    ├── voice_store.py     # Voice file management
    ├── project_store.py   # Project persistence
    └── gpu.py             # GPU utilities
```

### Key Patterns

**Job Service:**
- Async job queue with semaphore (max 2 concurrent)
- TTL-based cleanup (15 min default)
- Project persistence via `ProjectStore`

**Block Rendering:**
- Text → Chunks → Parallel render → Concatenate
- Per-block caching (by voice + text hash)
- Progressive delivery (play first block while rendering rest)

---

## Data Flow

### Render Flow

```
1. User inputs text
   ↓
2. Frontend calls POST /api/projects/sync
   ↓
3. Backend splits text into chunks
   ↓
4. Checks cache for existing block audio
   ↓
5. Queues missing blocks for rendering
   ↓
6. Returns project with block statuses
   ↓
7. Frontend polls GET /api/projects/{id}
   ↓
8. Playback starts on first ready block
   ↓
9. Background continues rendering
   ↓
10. User downloads final concatenated WAV
```

### Voice Upload Flow

```
1. User selects WAV file
   ↓
2. Frontend POST /api/voices
   ↓
3. Backend validates (size, format)
   ↓
4. Saved to tts-server/voices/
   ↓
5. Optional: ASR for transcript (if no .txt sidecar)
   ↓
6. Voice available for selection
```

---

## Key Design Decisions

### 1. Split Frontend/Backend
- Frontend: Next.js (React, TypeScript)
- Backend: FastAPI (Python, OmniVoice)
- Reason: Python ML ecosystem required for TTS

### 2. Block-Based Rendering
- Text split into ~N character chunks
- Each block independent
- Enables progressive playback

### 3. Transcript Sidecar Pattern
- Voice file: `speaker.wav`
- Transcript: `speaker.txt` (same name)
- Avoids ASR when transcript available

### 4. Layered Organization
- Clean separation of concerns
- Testable domain logic
- UI isolated from infrastructure

---

## Entry Points

| Component | Path | Purpose |
|-----------|------|---------|
| Frontend App | `src/app/page.tsx` | Main reader UI |
| Frontend Layout | `src/app/layout.tsx` | Root layout |
| Backend Server | `tts-server/server.py` | Uvicorn entry |
| Backend HTTP | `tts-server/presentation/http.py` | FastAPI app |
| Backend Jobs | `tts-server/application/job_service.py` | Core logic |

---

*Generated by gsd-map-codebase*
