from .db import now
from .realtime import hub

COLORS = {"blue", "rose", "green", "purple", "amber", "teal"}


def public_user(row):
    value = dict(row)
    value.pop("created_at", None)
    value["online"] = value["id"] in hub.clients
    return value


def member_ids(c, cid):
    return [
        r[0]
        for r in c.execute(
            "SELECT user_id FROM conversation_members WHERE conversation_id=?", (cid,)
        )
    ]


def serialize_message(c, row):
    m = dict(row)
    receipts = [
        dict(r)
        for r in c.execute(
            "SELECT user_id,delivered_at,read_at FROM message_receipts WHERE message_id=?",
            (m["id"],),
        )
    ]
    m["receipts"] = receipts
    m["status"] = (
        "read"
        if receipts and all(r["read_at"] for r in receipts)
        else "delivered"
        if receipts and all(r["delivered_at"] for r in receipts)
        else "sent"
    )
    m["reactions"] = [
        dict(r)
        for r in c.execute(
            "SELECT user_id,emoji FROM reactions WHERE message_id=?", (m["id"],)
        )
    ]
    m["attachment"] = None
    if m["attachment_id"]:
        row = c.execute(
            "SELECT id,name,mime,size FROM attachments WHERE id=?",
            (m["attachment_id"],),
        ).fetchone()
        if row:
            m["attachment"] = dict(row)
    m["reply"] = None
    if m["reply_to"]:
        row = c.execute(
            "SELECT m.id,m.body,u.display_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=? AND (m.expires_at IS NULL OR m.expires_at>?)",
            (m["reply_to"], now()),
        ).fetchone()
        if row:
            m["reply"] = dict(row)
    return m


def serialize_conversation(c, row, uid):
    d = dict(row)
    d["members"] = [
        public_user(r) | {"role": r["role"]}
        for r in c.execute(
            "SELECT u.*,cm.role FROM users u JOIN conversation_members cm ON cm.user_id=u.id WHERE cm.conversation_id=?",
            (d["id"],),
        )
    ]
    last = c.execute(
        "SELECT * FROM messages WHERE conversation_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY id DESC LIMIT 1",
        (d["id"], now()),
    ).fetchone()
    d["last_message"] = serialize_message(c, last) if last else None
    d["updated_at"] = last["created_at"] if last else d["created_at"]
    d["unread"] = c.execute(
        "SELECT count(*) FROM message_receipts r JOIN messages m ON m.id=r.message_id WHERE m.conversation_id=? AND r.user_id=? AND r.read_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>?)",
        (d["id"], uid, now()),
    ).fetchone()[0]
    return d
