# Verification report

Status: automated and production-like local verification complete. The hosted
root URL and health endpoint are live; the final two-browser hosted workflow
and visual review still require manual checking.

Date: 2026-10-09

## Automated checks

| Check | Result |
| --- | --- |
| Backend integration tests | Passed — 13 tests |
| SQLite initialization and seed test | Passed |
| Seed idempotency test | Passed |
| Authentication validation and phone registration test | Passed |
| Authentication HTTP lifecycle smoke test | Passed |
| Contact search and conversation metadata test | Passed |
| WebSocket presence update test | Passed |
| Offline pending-delivery recovery test | Passed |
| Malformed WebSocket event handling test | Passed |
| WebSocket delivery test | Passed |
| Group permission test | Passed |
| Group message persistence and aggregate receipt test | Passed |
| Bonus persistence/authorization test | Passed — quoted replies, reactions, private attachments and expired-row cleanup |
| Phase 6 UI implementation review | Passed — normalized contact search, explicit history-load error/retry state, responsive loading copy and selection accessibility states |
| Frontend TypeScript check | Passed |
| Next.js production build | Passed |
| Production-like single-service smoke | Passed — clean SQLite directory, seeded data, static frontend, OpenAPI, login/session persistence, message persistence across restart, and authenticated WebSocket |

## Coverage map

| Area | Evidence |
| --- | --- |
| Database schema and seed data | `test_database.py`: fresh schema, six demo users, seven conversations, 21 messages |
| Authentication and sessions | `test_workflows.py`: validation, registration, profile update, logout and session persistence |
| Contacts and conversations | `test_workflows.py`: contact search, recent sorting, previews, unread counts and direct-chat creation |
| Message persistence and retries | `test_workflows.py`: SQLite history, client-ID idempotency, pagination and receipt transitions |
| Group permissions and receipts | `test_workflows.py`: admin controls, removed-member denial, group persistence and aggregate receipts |
| WebSocket smoke coverage | `test_workflows.py`: presence, typing, message delivery, read receipts and malformed events |
| Bonus features | `test_workflows.py`: replies, reactions, expiry cleanup and attachment authorization |
| Frontend static quality | `npm run typecheck` and `npm run build` |
| Deployment topology | Local single-process smoke: FastAPI served `frontend/out`, REST API, SQLite and `/ws` from one service |

## Pending checks

- Login, refresh, logout, and profile update in a real browser.
- Real-time messaging between two independent browser sessions.
- Group creation and member-management UI.
- Visual browser review at desktop, tablet and mobile widths. The workspace-local
  preview is not reachable from the remote browser used for this session, so this
  must be performed locally before submission.
- Docker build and persistent-volume restart test.
- Full two-browser messaging and WebSocket verification on the public URL.

## Reproduction commands

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q

cd ../frontend
npm ci
npm run typecheck
npm run build
```

The fixed OTP, simulated encryption, and single-process WebSocket hub are
intentional assignment limitations and are documented in the README.

## Production-like local smoke evidence

On 2026-10-09, a clean temporary `DATA_DIR` was used with the same environment
variables as the Docker deployment. The service was started twice on one port.
The check confirmed `/api/health`, `/`, `/openapi.json`, demo seed data, login,
authenticated `/api/auth/me`, conversation loading, a newly created message,
and a WebSocket `connected`/`pong` exchange. The login session and new message
were both still available after the first process was stopped and the second
process started.

This is evidence for the application topology. The public HTTPS root URL and
health endpoint are now live. The free Render deployment does not provide a
persistent disk, so restart persistence for custom records is not claimed.
The independent-browser hosted workflow still requires a final manual check.
