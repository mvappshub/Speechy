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
