# Start here

This folder contains the full project. Keep `frontend/` and `backend/` together.

## Fastest way to open the included build on Windows

Install Python 3.12 or newer. Open this folder in VS Code. In its terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open **http://localhost:8000**. The ZIP includes a prebuilt `frontend/out/`, so this route does not need Node.js just to try the application. Keep the terminal running.

Click **Alex** on the sign-in screen. In a private/incognito window, open the same address and click **Maya**. Open each other's conversation. Type and send messages to see typing indicators and read receipts.

## To develop or change the frontend

Install Node.js 22 LTS. Open a second terminal at the project root:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000**. Keep the Python backend on port 8000. Source changes update automatically. After finishing changes, run `npm run build` and restart the Python server to serve the new export at port 8000.

## Before submitting

1. Read `docs/REQUIREMENTS.md` and try the workflows.
2. Review the source and documentation; trace one message from the frontend through the REST API, SQLite, and WebSocket hub.
3. Keep the public GitHub repository limited to project source and submission documentation. Do not upload `node_modules/`, `.venv/`, `.next/`, local databases, or `.env` files.
4. Follow `docs/DEPLOYMENT.md` to deploy the complete app. The current free Render demo uses ephemeral SQLite storage; a paid persistent volume is optional for production, not required for this assignment demo.
5. Test the public URL in two separate browser sessions, then submit that URL and the GitHub repository URL using the email specified by the recruiter.

**Current links:** Public repository: https://github.com/ManikaR26/signal-clone
Hosted demo: https://signal-clone-g5ln.onrender.com

**Mocked by design:** OTP `123456`, encryption, calls, stories and linked devices. Real messaging, storage, groups, permissions, typing and receipts are implemented. Anyone can sign in as a demo user using the fixed OTP, so use only fictional demo content.
