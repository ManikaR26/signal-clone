"""Assignment-only fixed OTP; unpredictable, expiring, server-revocable bearer sessions."""

import hashlib
from fastapi import Header, HTTPException
from .db import db, now


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def resolve_token(token: str):
    with db() as c:
        row = c.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?",
            (digest(token), now()),
        ).fetchone()
        return dict(row) if row else None


def current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please sign in again.")
    user = resolve_token(authorization[7:])
    if not user:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return user


def membership(c, conversation_id: int, user_id: int, admin=False):
    row = c.execute(
        "SELECT * FROM conversation_members WHERE conversation_id=? AND user_id=?",
        (conversation_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(403, "You are not a member of this conversation.")
    if admin and row["role"] != "admin":
        raise HTTPException(403, "Only a group admin can do this.")
    return row
