# Constitution

1. `src/app/page.tsx` and `tts-server/server.py` must stay thin entrypoints.
2. UI files render and delegate. They do not own API calls, storage, polling, or model orchestration.
3. Domain files stay pure. No `fetch`, `window`, `localStorage`, `Audio`, `FastAPI`, `torch`, or filesystem calls.
4. Infrastructure owns external effects and adapters.
5. Application coordinates use cases and state transitions.
6. New features must land under a feature folder, not in a global dumping ground.
7. Architecture rules can change only with an explicit governance record in `.governance/GOVERNANCE_CHANGE.md`.
