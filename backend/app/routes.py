"""REST resources. Every chat/message/file operation checks server-side membership."""

import secrets
import os
import re
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Query
from fastapi.responses import FileResponse
from .db import db, now, DATA_DIR
from .security import current_user, digest, membership
from .models import (
    Login,
    Profile,
    Contact,
    ConversationCreate,
    MemberAdd,
    MessageCreate,
    Receipt,
    Reaction,
    Timer,
)
from .service import (
    public_user,
    member_ids,
    serialize_message,
    serialize_conversation,
    COLORS,
)
from .realtime import hub

router = APIRouter(prefix="/api")
User = Annotated[dict, Depends(current_user)]


def avatar_valid(value):
    if value in COLORS:
        return value
    if len(value) <= 300000 and re.fullmatch(
        r"data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+", value
    ):
        return value
    raise HTTPException(422, "Choose an avatar color or a PNG, JPG, or WebP image.")


def conversation_or_404(c, cid: int):
    """Return a conversation row or a client-friendly not-found error."""
    row = c.execute("SELECT * FROM conversations WHERE id=?", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Conversation not found.")
    return row


@router.get("/health")
def health():
    return {"status": "ok", "mode": "assignment-demo", "encryption": "not implemented"}


@router.get("/demo-users")
def demo_users():
    with db() as c:
        return [
            public_user(r)
            for r in c.execute(
                "SELECT * FROM users WHERE username IN ('alex','maya','jordan') ORDER BY id"
            )
        ]


@router.post("/auth/login")
def login(data: Login):
    if data.otp != os.getenv("DEMO_OTP", "123456"):
        raise HTTPException(
            401, "Incorrect code. The demo verification code is 123456."
        )
    with db() as c:
        row = c.execute(
            "SELECT * FROM users WHERE username=?", (data.username,)
        ).fetchone()
        if not row:
            if not data.display_name.strip():
                raise HTTPException(422, "Enter a display name to create your account.")
            uid = c.execute(
                "INSERT INTO users(username,display_name,avatar,last_seen,created_at) VALUES(?,?,?,?,?)",
                (
                    data.username,
                    data.display_name.strip(),
                    avatar_valid(data.avatar),
                    now(),
                    now(),
                ),
            ).lastrowid
            row = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        token = secrets.token_urlsafe(32)
        c.execute("DELETE FROM sessions WHERE expires_at<?", (now(),))
        c.execute(
            "INSERT INTO sessions VALUES(?,?,?)",
            (digest(token), row["id"], now() + 7 * 86400000),
        )
        return {"token": token, "user": public_user(row)}


@router.get("/auth/me")
def me(user: User):
    return public_user(user)


@router.post("/auth/logout")
async def logout(user: User, authorization: str = Header()):
    token = authorization[7:]
    with db() as c:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token),))
    # Revoke only sockets belonging to this exact session.
    for ws in list(hub.clients.get(user["id"], {})):
        if getattr(ws.state, "token_hash", None) == digest(token):
            await ws.close(code=1008)
            hub.remove(user["id"], ws)
    return {"ok": True}


@router.patch("/profile")
async def profile(data: Profile, user: User):
    if not data.display_name.strip():
        raise HTTPException(422, "Display name cannot be empty.")
    with db() as c:
        c.execute(
            "UPDATE users SET display_name=?,avatar=? WHERE id=?",
            (data.display_name.strip(), avatar_valid(data.avatar), user["id"]),
        )
        result = public_user(
            c.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        )
        peers = [
            r[0]
            for r in c.execute(
                "SELECT DISTINCT b.user_id FROM conversation_members a JOIN conversation_members b ON a.conversation_id=b.conversation_id WHERE a.user_id=?",
                (user["id"],),
            )
        ]
    await hub.broadcast(peers, {"type": "refresh"})
    return result


@router.get("/users")
def users(user: User, q: str = Query(default="", max_length=80)):
    with db() as c:
        return [
            public_user(r)
            for r in c.execute(
                "SELECT * FROM users WHERE id!=? AND (username LIKE ? OR display_name LIKE ?) ORDER BY display_name LIMIT 100",
                (user["id"], f"%{q}%", f"%{q}%"),
            )
        ]


@router.get("/contacts")
def contacts(user: User):
    with db() as c:
        return [
            public_user(r)
            for r in c.execute(
                "SELECT u.* FROM users u JOIN contacts co ON co.contact_id=u.id WHERE co.owner_id=? ORDER BY u.display_name",
                (user["id"],),
            )
        ]


@router.post("/contacts")
def add_contact(data: Contact, user: User):
    with db() as c:
        row = c.execute(
            "SELECT * FROM users WHERE username=?", (data.username.strip().lower(),)
        ).fetchone()
        if not row:
            raise HTTPException(
                404, "No registered user has that username or phone number."
            )
        if row["id"] == user["id"]:
            raise HTTPException(400, "Choose another user.")
        c.execute("INSERT OR IGNORE INTO contacts VALUES(?,?)", (user["id"], row["id"]))
        return public_user(row)


@router.get("/conversations")
def conversations(user: User):
    with db() as c:
        rows = c.execute(
            "SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id WHERE m.user_id=?",
            (user["id"],),
        ).fetchall()
        return sorted(
            [serialize_conversation(c, r, user["id"]) for r in rows],
            key=lambda d: d["updated_at"],
            reverse=True,
        )


@router.post("/conversations")
async def create_conversation(data: ConversationCreate, user: User):
    others = set(data.member_ids) - {user["id"]}
    if data.kind not in ("direct", "group") or not others:
        raise HTTPException(422, "Select at least one other person.")
    if data.kind == "direct" and len(others) != 1:
        raise HTTPException(422, "A direct chat needs exactly two people.")
    if data.kind == "group" and not data.name.strip():
        raise HTTPException(422, "Give your group a name.")
    members = others | {user["id"]}
    key = ":".join(map(str, sorted(members))) if data.kind == "direct" else None
    with db() as c:
        if key:
            existing = c.execute(
                "SELECT * FROM conversations WHERE direct_key=?", (key,)
            ).fetchone()
            if existing:
                return serialize_conversation(c, existing, user["id"])
        if any(
            not c.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone()
            for uid in members
        ):
            raise HTTPException(404, "One of the selected users no longer exists.")
        cid = c.execute(
            "INSERT INTO conversations(kind,name,direct_key,created_by,created_at) VALUES(?,?,?,?,?)",
            (
                data.kind,
                data.name.strip() if data.kind == "group" else None,
                key,
                user["id"],
                now(),
            ),
        ).lastrowid
        for uid in members:
            c.execute(
                "INSERT INTO conversation_members VALUES(?,?,?,?)",
                (cid, uid, "admin" if uid == user["id"] else "member", now()),
            )
        result = serialize_conversation(
            c,
            c.execute("SELECT * FROM conversations WHERE id=?", (cid,)).fetchone(),
            user["id"],
        )
    await hub.broadcast(members, {"type": "refresh"})
    return result


@router.post("/conversations/{cid}/members")
async def add_member(cid: int, data: MemberAdd, user: User):
    with db() as c:
        conversation = conversation_or_404(c, cid)
        membership(c, cid, user["id"], admin=True)
        if conversation["kind"] != "group":
            raise HTTPException(400, "Members can only be added to groups.")
        if not c.execute("SELECT 1 FROM users WHERE id=?", (data.user_id,)).fetchone():
            raise HTTPException(404, "User not found.")
        c.execute(
            "INSERT OR IGNORE INTO conversation_members VALUES(?,?,'member',?)",
            (cid, data.user_id, now()),
        )
        ids = member_ids(c, cid)
    await hub.broadcast(ids, {"type": "refresh"})
    return {"ok": True}


@router.delete("/conversations/{cid}/members/{uid}")
async def remove_member(cid: int, uid: int, user: User):
    with db() as c:
        conversation = conversation_or_404(c, cid)
        membership(c, cid, user["id"], admin=True)
        if conversation["kind"] != "group":
            raise HTTPException(400, "This is not a group.")
        target = membership(c, cid, uid)
        if target["role"] == "admin":
            raise HTTPException(400, "The group admin cannot be removed.")
        ids = member_ids(c, cid)
        c.execute(
            "DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?",
            (cid, uid),
        )
    await hub.broadcast(ids, {"type": "refresh"})
    return {"ok": True}


@router.patch("/conversations/{cid}/timer")
async def set_timer(cid: int, data: Timer, user: User):
    if data.seconds not in (0, 30, 300, 3600, 86400, 604800):
        raise HTTPException(422, "Unsupported timer.")
    with db() as c:
        conversation = conversation_or_404(c, cid)
        membership(c, cid, user["id"])
        if conversation["kind"] == "group":
            membership(c, cid, user["id"], admin=True)
        c.execute(
            "UPDATE conversations SET disappear_seconds=? WHERE id=?",
            (data.seconds, cid),
        )
        ids = member_ids(c, cid)
    await hub.broadcast(ids, {"type": "refresh"})
    return {"ok": True}


@router.get("/conversations/{cid}/messages")
def messages(
    cid: int,
    user: User,
    before: int | None = None,
    limit: int = Query(100, ge=1, le=200),
):
    with db() as c:
        membership(c, cid, user["id"])
        rows = c.execute(
            "SELECT * FROM messages WHERE conversation_id=? AND (? IS NULL OR id<?) AND (expires_at IS NULL OR expires_at>?) ORDER BY id DESC LIMIT ?",
            (cid, before, before, now(), limit),
        ).fetchall()
        return [serialize_message(c, r) for r in reversed(rows)]


@router.post("/conversations/{cid}/messages")
async def send_message(cid: int, data: MessageCreate, user: User):
    if not data.body.strip() and not data.attachment_id:
        raise HTTPException(422, "Write a message or attach a file.")
    with db() as c:
        membership(c, cid, user["id"])
        existing = c.execute(
            "SELECT * FROM messages WHERE sender_id=? AND client_id=?",
            (user["id"], data.client_id),
        ).fetchone()
        if existing:
            if existing["conversation_id"] != cid:
                raise HTTPException(409, "This message identifier is already in use.")
            return serialize_message(c, existing)
        if (
            data.reply_to
            and not c.execute(
                "SELECT 1 FROM messages WHERE id=? AND conversation_id=? AND (expires_at IS NULL OR expires_at>?)",
                (data.reply_to, cid, now()),
            ).fetchone()
        ):
            raise HTTPException(400, "The quoted message is no longer available.")
        if (
            data.attachment_id
            and not c.execute(
                "SELECT 1 FROM attachments WHERE id=? AND owner_id=?",
                (data.attachment_id, user["id"]),
            ).fetchone()
        ):
            raise HTTPException(403, "That attachment does not belong to you.")
        seconds = c.execute(
            "SELECT disappear_seconds FROM conversations WHERE id=?", (cid,)
        ).fetchone()[0]
        timestamp = now()
        mid = c.execute(
            "INSERT INTO messages(conversation_id,sender_id,body,client_id,created_at,reply_to,attachment_id,expires_at) VALUES(?,?,?,?,?,?,?,?)",
            (
                cid,
                user["id"],
                data.body.strip(),
                data.client_id,
                timestamp,
                data.reply_to,
                data.attachment_id,
                timestamp + seconds * 1000 if seconds else None,
            ),
        ).lastrowid
        ids = member_ids(c, cid)
        for uid in ids:
            if uid != user["id"]:
                c.execute(
                    "INSERT INTO message_receipts(message_id,user_id) VALUES(?,?)",
                    (mid, uid),
                )
        result = serialize_message(
            c, c.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
        )
    await hub.broadcast(ids, {"type": "message", "message": result})
    return result


@router.post("/receipts")
async def receipts(data: Receipt, user: User):
    if data.status not in ("delivered", "read"):
        raise HTTPException(422, "Invalid receipt state.")
    changed = {}
    with db() as c:
        for mid in set(data.message_ids):
            row = c.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
            if not row:
                continue
            membership(c, row["conversation_id"], user["id"])
            receipt = c.execute(
                "SELECT * FROM message_receipts WHERE message_id=? AND user_id=?",
                (mid, user["id"]),
            ).fetchone()
            if not receipt or (
                receipt["read_at"] if data.status == "read" else receipt["delivered_at"]
            ):
                continue
            t = now()
            c.execute(
                "UPDATE message_receipts SET delivered_at=coalesce(delivered_at,?),read_at=CASE WHEN ?='read' THEN coalesce(read_at,?) ELSE read_at END WHERE message_id=? AND user_id=?",
                (t, data.status, t, mid, user["id"]),
            )
            changed.setdefault(row["conversation_id"], []).append(
                serialize_message(c, row)
            )
        deliveries = [(member_ids(c, cid), msgs) for cid, msgs in changed.items()]
    for ids, msgs in deliveries:
        await hub.broadcast(ids, {"type": "receipts", "messages": msgs})
    return {"ok": True}


@router.post("/messages/{mid}/reaction")
async def reaction(mid: int, data: Reaction, user: User):
    if data.emoji not in ("❤️", "👍", "😂", "😮", "😢", "🙏"):
        raise HTTPException(422, "Unsupported reaction.")
    with db() as c:
        row = c.execute(
            "SELECT * FROM messages WHERE id=? AND (expires_at IS NULL OR expires_at>?)",
            (mid, now()),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Message not found.")
        membership(c, row["conversation_id"], user["id"])
        old = c.execute(
            "SELECT emoji FROM reactions WHERE message_id=? AND user_id=?",
            (mid, user["id"]),
        ).fetchone()
        if old and old[0] == data.emoji:
            c.execute(
                "DELETE FROM reactions WHERE message_id=? AND user_id=?",
                (mid, user["id"]),
            )
        else:
            c.execute(
                "INSERT INTO reactions VALUES(?,?,?) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji",
                (mid, user["id"], data.emoji),
            )
        result = serialize_message(c, row)
        ids = member_ids(c, row["conversation_id"])
    await hub.broadcast(ids, {"type": "receipts", "messages": [result]})
    return result


@router.post("/attachments")
async def upload(user: User, file: UploadFile = File()):
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Files must be 10 MB or smaller.")
    aid = secrets.token_hex(16)
    folder = DATA_DIR / "uploads"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / aid
    path.write_bytes(content)
    name = Path(file.filename or "attachment").name[:180]
    mime = file.content_type or "application/octet-stream"
    with db() as c:
        c.execute(
            "INSERT INTO attachments VALUES(?,?,?,?,?,?)",
            (aid, user["id"], name, mime, len(content), str(path)),
        )
    return {"id": aid, "name": name, "mime": mime, "size": len(content)}


@router.get("/attachments/{aid}")
def download(aid: str, user: User):
    with db() as c:
        row = c.execute("SELECT * FROM attachments WHERE id=?", (aid,)).fetchone()
        if not row:
            raise HTTPException(404, "Attachment not found.")
        allowed = (
            row["owner_id"] == user["id"]
            or c.execute(
                "SELECT 1 FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id WHERE m.attachment_id=? AND cm.user_id=? AND (m.expires_at IS NULL OR m.expires_at>?)",
                (aid, user["id"], now()),
            ).fetchone()
        )
        if not allowed:
            raise HTTPException(403, "You cannot access this attachment.")
        safe_mime = (
            row["mime"]
            if row["mime"] in ("image/png", "image/jpeg", "image/webp", "image/gif")
            else "application/octet-stream"
        )
        return FileResponse(
            row["path"],
            filename=row["name"],
            media_type=safe_mime,
            headers={"X-Content-Type-Options": "nosniff"},
        )


@router.get("/pending-deliveries")
def pending_deliveries(user: User):
    with db() as c:
        rows = c.execute(
            "SELECT m.* FROM messages m JOIN message_receipts r ON r.message_id=m.id JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=r.user_id WHERE r.user_id=? AND r.delivered_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>?) ORDER BY m.id LIMIT 500",
            (user["id"], now()),
        ).fetchall()
        return [serialize_message(c, r) for r in rows]
