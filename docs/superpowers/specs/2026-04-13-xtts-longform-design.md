# XTTS Long-Form Playback Design

## Goal
Make the Czech XTTS-v2 reader reliably finish very long texts without stopping after the first generated segment, while exposing only stability-oriented inference controls that fit this app.

## Current Problem
- The frontend currently generates and plays only the first synthesized block for long text.
- Playback ends when the first audio blob ends because no follow-up segment is fetched or queued.
- The backend has async job endpoints, but they still model a single final audio payload instead of progressive long-form synthesis.

## Design
### Runtime model
- Keep `coqui/XTTS-v2` as the synthesis engine.
- Prefer stability over expressive randomness for long reading sessions.
- Split long input into multi-sentence chunks with conservative size limits instead of generating the whole book in one pass.

### Backend
- Add text chunking utilities tuned for Czech punctuation and paragraph boundaries.
- Extend async jobs so a job tracks ordered segment generation, per-segment status, and final completion.
- Cache speaker conditioning for `speaker.wav` so segment generation does not repeatedly recompute the same reference state.
- Expose stable inference controls internally: `speed`, `temperature`, `top_p`, `repetition_penalty`, and text splitting behavior.

### Frontend
- Replace one-shot long-text playback with a queue player.
- Start an async job for long text, poll job progress, enqueue ready segment URLs, and auto-play the next segment on `ended`.
- Keep short text on the simple synchronous path.
- Surface progress and clearer error messages when a specific segment fails.

## Recommended XTTS defaults
- `speed=1.0`
- `temperature=0.55`
- `top_p=0.8`
- `repetition_penalty=2.5`
- `split_sentences=False` at the API layer when the app already chunks text deliberately

## Verification
- Add unit tests for chunking and job state progression on the Python side.
- Run `npm run lint`.
- Run Python tests for the chunking/job helpers.
