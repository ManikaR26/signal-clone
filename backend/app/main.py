import asyncio
import contextlib
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .db import initialize, db, now
from .seed import seed
from .routes import router
from .security import resolve_token, digest, membership
from .realtime import hub
from .service import member_ids


async def expire_once():
    """Delete expired messages and notify currently connected conversation members."""
    cutoff = now()
    with db() as c:
        expired = c.execute(
            "SELECT id,conversation_id FROM messages WHERE expires_at<=?", (cutoff,)
        ).fetchall()
        deliveries = [
            (member_ids(c, r["conversation_id"]), r["id"], r["conversation_id"])
            for r in expired
        ]
        c.execute("DELETE FROM messages WHERE expires_at<=?", (cutoff,))
    for ids, mid, cid in deliveries:
        await hub.broadcast(
            ids, {"type": "expired", "message_id": mid, "conversation_id": cid}
        )


async def expiration_loop():
    while True:
        await asyncio.sleep(2)
        await expire_once()


@asynccontextmanager
async def lifespan(app):
    initialize()
    if os.getenv("SEED_DEMO", "1") == "1":
        seed()
    task = asyncio.create_task(expiration_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="Signal Clone API", version="1.0.0", lifespan=lifespan)
origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


async def presence(uid):
    with db() as c:
        peers = [
            r[0]
            for r in c.execute(
                "SELECT DISTINCT b.user_id FROM conversation_members a JOIN conversation_members b ON a.conversation_id=b.conversation_id WHERE a.user_id=?",
                (uid,),
            )
        ]
        c.execute("UPDATE users SET last_seen=? WHERE id=?", (now(), uid))
    await hub.broadcast(
        peers,
        {
            "type": "presence",
            "user_id": uid,
            "online": uid in hub.clients,
            "last_seen": now(),
        },
    )


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    # First-frame auth keeps bearer tokens out of access logs and URL history.
    await ws.accept()
    user = None
    try:
        auth = await asyncio.wait_for(ws.receive_json(), timeout=10)
        if not isinstance(auth, dict):
            await ws.close(code=1008)
            return
        token = auth.get("token", "")
        user = resolve_token(token) if isinstance(token, str) else None
        if not user:
            await ws.close(code=1008)
            return
        ws.state.token_hash = digest(token)
        hub.add(user["id"], ws)
        await hub.send(user["id"], {"type": "connected"})
        await presence(user["id"])
        last_typing = 0
        while True:
            event = await ws.receive_json()
            if not isinstance(event, dict):
                await hub.send(
                    user["id"],
                    {"type": "error", "detail": "Invalid WebSocket event."},
                )
                continue
            if not resolve_token(token):
                await ws.close(code=1008)
                break
            event_type = event.get("type")
            if event_type == "ping":
                await hub.send(user["id"], {"type": "pong"})
            elif event_type == "typing":
                cid = event.get("conversation_id")
                active = event.get("active")
                if not isinstance(cid, int) or isinstance(cid, bool) or not isinstance(
                    active, bool
                ):
                    await hub.send(
                        user["id"],
                        {"type": "error", "detail": "Invalid typing event."},
                    )
                    continue
                if now() - last_typing < 250:
                    continue
                last_typing = now()
                try:
                    with db() as c:
                        membership(c, cid, user["id"])
                        ids = member_ids(c, cid)
                    await hub.broadcast(
                        [uid for uid in ids if uid != user["id"]],
                        {
                            "type": "typing",
                            "conversation_id": cid,
                            "user_id": user["id"],
                            "display_name": user["display_name"],
                            "active": bool(event.get("active")),
                        },
                    )
                except HTTPException:
                    await hub.send(
                        user["id"],
                        {"type": "error", "detail": "Conversation access denied."},
                    )
            else:
                await hub.send(
                    user["id"],
                    {
                        "type": "error",
                        "detail": f"Unknown WebSocket event: {event_type or 'missing type'}.",
                    },
                )
    except (WebSocketDisconnect, asyncio.TimeoutError, ValueError, TypeError):
        pass
    finally:
        if user:
            hub.remove(user["id"], ws)
            await presence(user["id"])


# A static Next.js export and Python API can share one deployment, origin and persistent disk.
frontend = Path(os.getenv("FRONTEND_DIST", "../frontend/out"))
if frontend.exists():
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
