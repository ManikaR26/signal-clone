# Final assignment audit

Audit date: 2026-10-09

The project source, automated tests, frontend production build, and
production-like local single-service smoke test were reviewed. Browser-only,
Docker-host, and public-host checks are clearly marked as pending because they
were not independently verified in this workspace.

## Verification baseline

- Backend: `13 passed` with `pytest -q`.
- Frontend: `npm run typecheck` passed.
- Frontend: `npm run build` passed.
- Production-like local smoke: passed with a clean SQLite directory, seeded
  data, login/session persistence, message persistence across restart, and an
  authenticated WebSocket connection.

## Requirement checklist

| Requirement | Implemented? | How to test | File/location |
| --- | --- | --- | --- |
| Next.js with TypeScript | Yes — tested | Run `npm run typecheck` and `npm run build` | `frontend/app/`, `frontend/next.config.ts` |
| Python FastAPI backend | Yes — tested | Start Uvicorn and call `/api/health` | `backend/app/main.py`, `backend/app/routes.py` |
| SQLite database | Yes — tested | Start with a clean `DATA_DIR` and inspect seeded records | `backend/app/db.py` |
| Authenticated WebSockets | Yes — automated and local-smoke tested | Authenticate `/ws`, send `ping`, verify `pong` | `backend/app/main.py`, `backend/app/realtime.py`, `frontend/lib/useMessenger.ts` |
| Username or phone registration | Yes — automated tested | Register with valid and invalid username/phone data | `backend/app/routes.py`, `backend/tests/test_workflows.py` |
| Fixed/mock OTP verification | Yes — tested | Use demo OTP `123456`; try an incorrect OTP | `backend/app/routes.py`, `backend/.env.example` |
| Display name and avatar | Yes — source and API tested | Register, update profile, reload profile | `frontend/components/Auth.tsx`, `frontend/components/Dialogs.tsx`, `backend/app/routes.py` |
| Login and logout | Yes — automated tested | Login, call `/api/auth/me`, logout, retry authenticated request | `backend/app/routes.py`, `backend/tests/test_workflows.py` |
| Session after refresh/restart | Yes — local-smoke tested | Reuse token after backend process restart | `backend/app/db.py`, `backend/app/routes.py` |
| Validation and error messages | Yes — automated/source tested | Submit invalid auth, contact, message, and group data | `backend/app/schemas.py`, `frontend/components/Auth.tsx`, `frontend/components/Dialogs.tsx` |
| Signal-style conversation panel | Yes — source and production-build tested | Open the built frontend and inspect the sidebar/chat layout | `frontend/components/Messenger.tsx`, `frontend/app/globals.css` |
| Recent conversation sorting | Yes — automated tested | Create activity and reload conversation list | `backend/app/routes.py`, `backend/tests/test_workflows.py` |
| Conversation/contact search | Yes — source tested | Search a conversation and a registered contact | `frontend/components/Messenger.tsx`, `backend/app/routes.py` |
| Add contact/new conversation | Yes — automated/source tested | Add a seeded user and open a direct conversation | `frontend/components/Dialogs.tsx`, `backend/app/routes.py` |
| Unread indicators and previews | Yes — automated/source tested | Receive a message while another conversation is selected | `frontend/components/Messenger.tsx`, `backend/app/routes.py` |
| Online/last-seen presence | Yes — WebSocket automated tested | Connect/disconnect two users and inspect presence events | `backend/app/main.py`, `frontend/lib/useMessenger.ts` |
| Real-time one-to-one messages | Yes — backend WebSocket tested; browser check pending | Use two independent browser sessions and send both directions | `backend/tests/test_workflows.py`, `backend/app/main.py`, `frontend/lib/useMessenger.ts` |
| Message timestamps/date grouping | Yes — source tested | Send messages on the same and different dates | `frontend/components/ChatPane.tsx`, `frontend/lib/types.ts` |
| Typing indicators | Yes — WebSocket automated tested | Type in one session while the other is viewing the chat | `backend/app/main.py`, `frontend/lib/useMessenger.ts` |
| Sending → sent → delivered → read lifecycle | Yes — automated tested | Send, deliver, open, and mark a message read | `backend/app/routes.py`, `backend/tests/test_workflows.py` |
| Check-style receipts | Yes — automated/source tested | Compare outgoing message status before and after recipient actions | `frontend/components/ChatPane.tsx`, `frontend/app/globals.css` |
| SQLite message persistence | Yes — automated and restart-smoke tested | Reload history and restart the service before loading it again | `backend/app/routes.py`, `backend/app/db.py` |
| Reconnection/offline recovery | Yes — automated tested | Disconnect a session, send a message, reconnect and reload pending deliveries | `backend/app/routes.py`, `frontend/lib/useMessenger.ts` |
| Empty/loading/error/offline states | Yes — source and build tested; browser review pending | Simulate loading, failed history request, and WebSocket disconnect | `frontend/components/ChatPane.tsx`, `frontend/lib/useMessenger.ts` |
| Create group with members | Yes — backend/source tested; browser check pending | Create a group through the UI and verify selected members | `backend/app/routes.py`, `frontend/components/Dialogs.tsx` |
| Group send and receive | Yes — automated tested; browser check pending | Send a group message from two member sessions | `backend/tests/test_workflows.py`, `frontend/lib/useMessenger.ts` |
| View/add/remove group members | Yes — permission API/source tested; browser check pending | Use the group details dialog as admin and member | `backend/app/routes.py`, `frontend/components/Dialogs.tsx` |
| Group admin permissions | Yes — automated tested | Verify non-admin add/remove requests are rejected | `backend/tests/test_workflows.py`, `backend/app/routes.py` |
| Persistent groups and group messages | Yes — automated tested | Restart/reload and inspect group history | `backend/app/db.py`, `backend/tests/test_workflows.py` |
| Signal-inspired bubbles and layout | Yes — source/build tested; visual browser review pending | Open at desktop/tablet/mobile widths | `frontend/components/ChatPane.tsx`, `frontend/app/globals.css` |
| Forms, modals, filters and toasts | Yes — source/build tested; browser review pending | Create contact/group, change filters, trigger a toast | `frontend/components/Dialogs.tsx`, `frontend/components/Messenger.tsx` |
| Privacy, notifications and appearance settings | Yes — source/build tested | Open Settings and inspect each tab | `frontend/components/Dialogs.tsx` |
| Voice/video call placeholder | Yes — placeholder implemented | Select Calls and verify Coming Soon feedback | `frontend/components/Messenger.tsx` |
| Stories placeholder | Yes — placeholder implemented | Select Stories and verify Coming Soon feedback | `frontend/components/Messenger.tsx` |
| Linked devices placeholder | Yes — placeholder implemented | Open Settings → Linked devices | `frontend/components/Dialogs.tsx` |
| Real E2E encryption | No — intentionally mocked | Read the limitation notice; do not claim E2EE | `README.md`, `docs/EXPLAIN_THE_CODE.md` |
| Relational database design | Yes — tested | Create a fresh database and inspect related tables | `backend/app/db.py`, `docs/DATABASE_SCHEMA.md` |
| Idempotent seed data | Yes — automated tested | Initialize/seed twice and compare records | `backend/app/seed.py`, `backend/tests/test_database.py` |
| Message reactions | Yes — automated tested | Add/remove a reaction and reload history | `backend/app/routes.py`, `backend/tests/test_workflows.py` |
| Reply-to messages | Yes — automated tested | Reply to a message and reload quoted metadata | `backend/app/routes.py`, `frontend/components/ChatPane.tsx` |
| Dark/system appearance | Yes — source/build tested; browser review pending | Change Appearance setting and reload | `frontend/components/Dialogs.tsx`, `frontend/app/globals.css` |
| Responsive mobile/tablet layout | Yes — CSS implemented; visual review pending | Inspect at desktop, tablet and mobile widths | `frontend/app/globals.css` |
| Image/file attachments | Yes — API authorization automated tested | Upload a supported file and download it as an authorized user | `backend/app/routes.py`, `frontend/components/ChatPane.tsx` |
| Disappearing messages | Yes — cleanup automated tested | Set a timer, send a message, run expiry cleanup, reload history | `backend/app/main.py`, `backend/tests/test_workflows.py` |
| Keyboard shortcuts | Yes — source implemented; browser review pending | Use documented shortcuts in the messenger | `frontend/components/Messenger.tsx`, `README.md` |
| Docker/Compose deployment | Configuration exists; build pending | Run `docker compose up --build -d` on a Docker-capable host | `Dockerfile`, `compose.yaml` |
| Persistent hosted storage | Configuration exists; host check pending | Restart the hosted service and verify a new message remains | `render.yaml`, `docs/DEPLOYMENT.md` |
| Production CORS | Configured for split deployment; external check pending | Set exact frontend origin and test API/WebSocket access | `backend/app/main.py`, `backend/.env.example` |
| Public GitHub repository | Not completed | Publish the repository from the candidate’s account | `docs/DEPLOYMENT.md` |
| Hosted working URL | Not completed | Deploy to a Python/WebSocket host and open its HTTPS URL | `render.yaml`, `docs/DEPLOYMENT.md` |
| Independent-browser hosted verification | Not completed | Test two users in separate/incognito browser sessions | `docs/QA_REPORT.md` |
| Submission form | Not completed | Submit the final repository and hosted URLs | `docs/REQUIREMENTS.md` |

## Final limitations before submission

The project is functionally implemented and locally verified, but the
following actions still require the candidate's machine or hosting account:

1. Run the application in a real browser and verify login, refresh, logout,
   profile editing, group management, and responsive layout.
2. Use two browser sessions to demonstrate live messaging and receipts.
3. Build and run the Docker image with its persistent volume.
4. Publish the repository and deploy a public HTTPS/WebSocket instance.
5. Test the hosted instance in an incognito browser and submit both URLs.

The fixed OTP, simulated encryption, plaintext SQLite messages, and single
worker WebSocket hub are intentional assignment-demo limitations and are
documented in `README.md`.
