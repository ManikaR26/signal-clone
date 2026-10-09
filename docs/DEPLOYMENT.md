# Deploy the complete application

## Recommended topology

One Docker web service serves the exported Next.js UI, the FastAPI REST API and WebSocket endpoint. Use one service instance and one Python worker. A persistent volume is useful for a production deployment, but the current Render demo intentionally uses the free plan without a persistent disk.

This avoids deploying a frontend that looks functional but cannot talk to a live Python backend. Vercel/Netlify may serve the frontend separately, but the Python/WebSocket backend still needs a compatible host and persistent disk.

## Render blueprint

1. Push the project to a **public GitHub repository**, keeping `Dockerfile`, `render.yaml`, `frontend/` and `backend/` at the root.
2. Sign in to Render and choose to create a new Blueprint from that repository.
3. Review `render.yaml`. It specifies a **free web service without a persistent disk**, so no paid Render resource is required for the assignment demo.
4. Deploy. Render builds the Next.js frontend, installs the Python dependencies and starts the application using the Dockerfile.
5. Wait for the deployment to pass `/api/health` and open the assigned public HTTPS URL.
6. Open it in two independent browser sessions, sign in as different demo users, and check live messaging.
7. Remember that custom SQLite records and uploaded files may reset when the free service restarts or redeploys. Seeded demo data is recreated automatically.

Environment:

| Variable | Value in the supplied deployment |
| --- | --- |
| `DATA_DIR` | `/app/data` |
| `FRONTEND_DIST` | `/app/frontend/out` |
| `SEED_DEMO` | `1` |
| `DEMO_OTP` | `123456` |
| `PORT` | Supplied by the host; Dockerfile respects it |
| `NEXT_PUBLIC_API_URL` | Leave unset for same-origin deployment |

The current free Render demo uses ephemeral local storage. This is acceptable for an assignment demonstration, but it means custom messages and uploaded files are not guaranteed to survive a restart or redeploy. A production deployment should use an equivalent persistent volume; do not change the required database to an unrelated hosted service just to fit a free tier.

## Production-like local verification

Before publishing, run the service in the same one-process shape used by the
container and verify the complete path locally:

1. Use a clean temporary `DATA_DIR` and set `FRONTEND_DIST=../frontend/out`.
2. Start Uvicorn with one worker and open `/api/health`.
3. Check `/`, `/openapi.json`, `/api/demo-users`, login, `/api/auth/me`, and
   `/api/conversations`.
4. Create one message, connect to `/ws`, authenticate, and verify `connected`
   and `pong` events.
5. Stop and restart the process, then verify the same session and message are
   still available.

This smoke check passed locally on 2026-10-09 using a clean SQLite directory.
The hosted root URL and `/api/health` endpoint were also verified on
2026-10-09. This does not replace a full two-browser hosted WebSocket check.

## Docker-capable alternative

On a server with Docker installed, from the repository root:

```bash
docker compose up --build -d
```

The named volume survives container replacement. Configure an HTTPS reverse proxy and a public hostname. Allow WebSocket upgrades for `/ws`. Do not run multiple replicas with the current in-memory connection hub.

The bundled Compose file is for a simple local/server setup. TLS certificates, DNS and firewall configuration are responsibilities of the hosting environment.

## Optional split deployment

For a separately hosted static frontend:

1. Deploy FastAPI on a Python/Docker host with a persistent disk.
2. Set `NEXT_PUBLIC_API_URL=https://YOUR_BACKEND` **before building** the frontend.
3. Build using `npm ci && npm run build`; publish `frontend/out/`.
4. Set backend `CORS_ORIGINS` to the exact frontend origin, with no trailing slash.
5. Verify that the backend host supports WebSockets and HTTPS; the client derives `wss://` automatically.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login returns “Failed to fetch” | Backend URL, backend health and CORS; rebuild after changing `NEXT_PUBLIC_API_URL` |
| UI is 404 from Python | Build `frontend/out/` before starting Python, or correct `FRONTEND_DIST` |
| Messages save but do not arrive live | WebSocket connection/upgrade; do not run multiple workers |
| Data vanishes after redeploy | Persistent volume mount and `DATA_DIR` |
| Avatar/image fails to load | Valid PNG/JPEG/WebP profile image; valid session for attachments |
| OTP rejected | `DEMO_OTP` must stay `123456` to match demo buttons |
| Port already in use locally | Stop the existing process; use a consistent alternate API URL if changing backend ports |

## Final handoff checklist

- Public GitHub link opens without signing in.
- Hosted HTTPS URL opens independently of the development computer.
- Demo users exist, and both direct and group messages work between independent sessions.
- Backend health and API docs load.
- The hosted root and `/api/health` endpoints respond successfully.
- If persistent storage is configured, newly created records survive a service restart.
- README and requirement checklist are present in the repository.
- Submit both actual URLs through the recruiter's form, using the required email address.

Reference documentation: [Render Docker](https://render.com/docs/docker), [persistent disks](https://render.com/docs/disks), [Blueprint specification](https://render.com/docs/blueprint-spec).

**Status:** The public repository and Render demo are available. The live root
URL and `/api/health` endpoint were verified on 2026-10-09. Complete the
two-browser hosted workflow check before submitting.
