# XTTS Long-Form Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long Czech texts play to completion by generating and playing XTTS-v2 audio in ordered segments instead of stopping after the first block.

**Architecture:** The Python backend becomes responsible for chunking long text and managing segment-oriented async jobs. The Next.js frontend switches from one-shot long-form playback to a polling queue player that auto-advances through completed segments.

**Tech Stack:** Next.js App Router, React, TypeScript, FastAPI, Python 3.11, Coqui TTS XTTS-v2.

---

### Task 1: Backend chunking and job model

**Files:**
- Create: `tts-server/chunking.py`
- Modify: `tts-server/server.py`
- Test: `tts-server/tests/test_chunking.py`

- [ ] Add pure Python chunking helpers for paragraph-aware sentence grouping.
- [ ] Write tests for chunk size limits, paragraph boundaries, and empty input handling.
- [ ] Extend async jobs to store ordered segments and generation progress instead of one final blob.

### Task 2: Backend segment generation endpoints

**Files:**
- Modify: `tts-server/server.py`
- Test: `tts-server/tests/test_chunking.py`

- [ ] Add stable XTTS inference defaults for long-form use.
- [ ] Generate async job segments sequentially and store each segment as ready/error.
- [ ] Expose job progress and per-segment metadata from `GET /api/job/{job_id}`.
- [ ] Add `GET /api/job/{job_id}/audio/{segment_index}` to stream one generated segment.

### Task 3: Frontend queue playback

**Files:**
- Modify: `src/app/page.tsx`

- [ ] Keep short text on the synchronous `/api/synthesize` path.
- [ ] Start `/api/synthesize-async` for long text and poll job state.
- [ ] Queue ready segment URLs and auto-play them sequentially on `audio.onended`.
- [ ] Track segment progress, stop/resume behavior, and cleanup of object URLs.

### Task 4: Verification

**Files:**
- Modify: `AGENTS.md`

- [ ] Document the Python test command now that backend helper tests exist.
- [ ] Run `python -m unittest discover -s tts-server/tests -v`.
- [ ] Run `npm run lint`.
