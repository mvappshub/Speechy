# Boundaries

## Frontend
- `ui` may import `application` and `domain`
- `application` may import `domain` and `infrastructure`
- `domain` may import only `domain`
- `infrastructure` may import `domain`

## Backend
- `presentation` may import `application`, `domain`, `infrastructure`
- `application` may import `domain`, `infrastructure`
- `domain` may not import `application`, `presentation`, or `infrastructure`
- `infrastructure` may import `domain`

## Hotspot limits
- `src/app/page.tsx` max 20 lines
- `tts-server/server.py` max 20 lines
- feature UI files max 220 lines
- application files max 280 lines
