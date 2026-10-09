"""Integration tests against a real temporary SQLite database and FastAPI websocket endpoint."""

import asyncio
import uuid
import pytest
from fastapi.testclient import TestClient
from app import db as database
from app.main import app, expire_once


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    with TestClient(app) as client:
        yield client


def login(c, name):
    r = c.post(
        "/api/auth/login",
        json={"username": name, "otp": "123456", "display_name": name.title()},
    )
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}, r.json()


def send(c, headers, cid, body="Hello", **extra):
    return c.post(
        f"/api/conversations/{cid}/messages",
        headers=headers,
        json={"body": body, "client_id": uuid.uuid4().hex, **extra},
    )


def test_auth_registration_persistence_and_logout(client):
    assert (
        client.post(
            "/api/auth/login", json={"username": "newuser", "otp": "000000"}
        ).status_code
        == 401
    )
    assert client.get("/api/conversations").status_code == 401
    h, data = login(client, "newuser")
    assert client.get("/api/auth/me", headers=h).json()["username"] == "newuser"
    h2, data2 = login(client, "newuser")
    assert data2["user"]["id"] == data["user"]["id"]
    assert (
        client.patch(
            "/api/profile",
            headers=h,
            json={"display_name": "New Name", "avatar": "teal"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=h2).json()["display_name"] == "New Name"
    assert client.post("/api/auth/logout", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.get("/api/auth/me", headers=h2).status_code == 200


def test_auth_validation_phone_registration_and_profile_validation(client):
    assert (
        client.post(
            "/api/auth/login",
            json={
                "username": "bad username",
                "otp": "123456",
                "display_name": "Invalid",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/login",
            json={
                "username": "validuser",
                "otp": "1234",
                "display_name": "Valid User",
            },
        ).status_code
        == 422
    )

    headers, result = login(client, "+919876543210")
    assert result["user"]["username"] == "+919876543210"

    assert (
        client.patch(
            "/api/profile",
            headers=headers,
            json={"display_name": "   ", "avatar": "blue"},
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/profile",
            headers=headers,
            json={"display_name": "Valid User", "avatar": "not-an-avatar"},
        ).status_code
        == 422
    )


def test_contacts_direct_messages_and_idempotency(client):
    a, ad = login(client, "alex")
    m, md = login(client, "maya")
    assert (
        client.post("/api/contacts", headers=a, json={"username": "maya"}).status_code
        == 200
    )
    assert (
        client.post(
            "/api/contacts", headers=a, json={"username": "unknown"}
        ).status_code
        == 404
    )
    body = {"kind": "direct", "member_ids": [md["user"]["id"]]}
    cid = client.post("/api/conversations", headers=a, json=body).json()["id"]
    assert client.post("/api/conversations", headers=a, json=body).json()["id"] == cid
    payload = {"body": "Persistent message", "client_id": "retry-me"}
    first = client.post(
        f"/api/conversations/{cid}/messages", headers=a, json=payload
    ).json()
    second = client.post(
        f"/api/conversations/{cid}/messages", headers=a, json=payload
    ).json()
    assert first["id"] == second["id"]
    assert first["status"] == "sent"
    assert (
        client.post(
            "/api/receipts",
            headers=m,
            json={"message_ids": [first["id"]], "status": "delivered"},
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/conversations/{cid}/messages", headers=a).json()[-1]["status"]
        == "delivered"
    )
    client.post(
        "/api/receipts",
        headers=m,
        json={"message_ids": [first["id"]], "status": "read"},
    )
    assert (
        client.get(f"/api/conversations/{cid}/messages", headers=a).json()[-1]["status"]
        == "read"
    )
    page = client.get(f"/api/conversations/{cid}/messages?limit=1", headers=a).json()
    assert page[0]["id"] == first["id"]
    older = client.get(
        f"/api/conversations/{cid}/messages?before={first['id']}", headers=a
    ).json()
    assert all(x["id"] < first["id"] for x in older)


def test_contact_search_recent_sorting_preview_and_unread_count(client):
    alex, _ = login(client, "alex")
    recent, recent_data = login(client, "recentuser")

    client.patch(
        "/api/profile",
        headers=recent,
        json={"display_name": "Recent Contact", "avatar": "teal"},
    )

    search = client.get("/api/users?q=recent%20contact", headers=alex).json()
    assert [person["username"] for person in search] == ["recentuser"]

    add = client.post(
        "/api/contacts", headers=alex, json={"username": "recentuser"}
    )
    assert add.status_code == 200
    assert (
        client.post(
            "/api/contacts", headers=alex, json={"username": "recentuser"}
        ).status_code
        == 200
    )
    contacts = client.get("/api/contacts", headers=alex).json()
    assert [person["username"] for person in contacts].count("recentuser") == 1

    conversation = client.post(
        "/api/conversations",
        headers=alex,
        json={"kind": "direct", "member_ids": [recent_data["user"]["id"]]},
    ).json()
    cid = conversation["id"]
    message = send(client, recent, cid, "Latest contact update").json()

    conversations = client.get("/api/conversations", headers=alex).json()
    current = next(item for item in conversations if item["id"] == cid)
    assert conversations[0]["id"] == cid
    assert current["last_message"]["body"] == "Latest contact update"
    assert current["updated_at"] == message["created_at"]
    assert current["unread"] == 1

    client.post(
        "/api/receipts",
        headers=alex,
        json={"message_ids": [message["id"]], "status": "read"},
    )
    refreshed = client.get("/api/conversations", headers=alex).json()
    current = next(item for item in refreshed if item["id"] == cid)
    assert current["unread"] == 0


def test_pending_delivery_recovery(client):
    sender, _ = login(client, "alex")
    recipient, _ = login(client, "maya")

    message = send(client, sender, 1, "Recovered after reconnect").json()
    pending = client.get("/api/pending-deliveries", headers=recipient).json()
    recovered = next(item for item in pending if item["id"] == message["id"])
    assert recovered["body"] == "Recovered after reconnect"
    assert recovered["status"] == "sent"

    delivered = client.post(
        "/api/receipts",
        headers=recipient,
        json={"message_ids": [message["id"]], "status": "delivered"},
    )
    assert delivered.status_code == 200
    remaining = client.get("/api/pending-deliveries", headers=recipient).json()
    assert all(item["id"] != message["id"] for item in remaining)

    history = client.get("/api/conversations/1/messages", headers=recipient).json()
    assert any(item["id"] == message["id"] for item in history)


def test_websocket_rejects_invalid_events(client):
    _, account = login(client, "alex")
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": account["token"]})
        receive_type(ws, "connected")
        receive_type(ws, "presence")

        ws.send_json(["not-an-event-object"])
        assert receive_type(ws, "error")["detail"] == "Invalid WebSocket event."

        ws.send_json({"type": "typing", "conversation_id": "1", "active": True})
        assert receive_type(ws, "error")["detail"] == "Invalid typing event."

        ws.send_json({"type": "not-supported"})
        assert "Unknown WebSocket event" in receive_type(ws, "error")["detail"]


def test_group_admin_permissions_and_removed_members(client):
    a, ad = login(client, "alex")
    m, md = login(client, "maya")
    j, jd = login(client, "jordan")
    o, od = login(client, "outsider")
    cid = client.post(
        "/api/conversations",
        headers=a,
        json={"kind": "group", "name": "Test Group", "member_ids": [md["user"]["id"]]},
    ).json()["id"]
    assert (
        client.post(
            f"/api/conversations/{cid}/members",
            headers=m,
            json={"user_id": jd["user"]["id"]},
        ).status_code
        == 403
    )
    assert (
        client.get(f"/api/conversations/{cid}/messages", headers=o).status_code == 403
    )
    assert send(client, o, cid).status_code == 403
    assert (
        client.post(
            f"/api/conversations/{cid}/members",
            headers=a,
            json={"user_id": jd["user"]["id"]},
        ).status_code
        == 200
    )
    assert send(client, j, cid).status_code == 200
    assert (
        client.delete(
            f"/api/conversations/{cid}/members/{ad['user']['id']}", headers=a
        ).status_code
        == 400
    )
    assert (
        client.delete(
            f"/api/conversations/{cid}/members/{jd['user']['id']}", headers=a
        ).status_code
        == 200
    )
    assert send(client, j, cid).status_code == 403
    assert (
        client.get(f"/api/conversations/{cid}/messages", headers=j).status_code == 403
    )
    assert (
        client.patch(
            f"/api/conversations/{cid}/timer",
            headers=m,
            json={"seconds": 30},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/conversations/999/members",
            headers=a,
            json={"user_id": md["user"]["id"]},
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/conversations/999/members/{md['user']['id']}", headers=a
        ).status_code
        == 404
    )
    assert (
        client.patch(
            "/api/conversations/999/timer", headers=a, json={"seconds": 30}
        ).status_code
        == 404
    )


def test_group_messages_persist_and_aggregate_receipts(client):
    a, ad = login(client, "alex")
    m, md = login(client, "maya")
    j, jd = login(client, "jordan")

    created = client.post(
        "/api/conversations",
        headers=a,
        json={
            "kind": "group",
            "name": "Study Circle",
            "member_ids": [md["user"]["id"], jd["user"]["id"]],
        },
    )
    assert created.status_code == 200, created.text
    group = created.json()
    cid = group["id"]
    assert group["kind"] == "group"
    assert group["name"] == "Study Circle"
    assert {member["username"] for member in group["members"]} == {
        "alex",
        "maya",
        "jordan",
    }
    assert next(member for member in group["members"] if member["id"] == ad["user"]["id"])[
        "role"
    ] == "admin"

    inbound = send(client, m, cid, "The group database design is ready.").json()
    assert inbound["status"] == "sent"
    alex_group = next(
        item
        for item in client.get("/api/conversations", headers=a).json()
        if item["id"] == cid
    )
    assert alex_group["last_message"]["body"] == "The group database design is ready."
    assert alex_group["unread"] == 1

    outbound = send(client, a, cid, "Great, I will review it now.").json()
    assert outbound["status"] == "sent"

    def status_for_alex():
        history = client.get(f"/api/conversations/{cid}/messages", headers=a).json()
        return next(item for item in history if item["id"] == outbound["id"])["status"]

    assert status_for_alex() == "sent"
    assert (
        client.post(
            "/api/receipts",
            headers=m,
            json={"message_ids": [outbound["id"]], "status": "delivered"},
        ).status_code
        == 200
    )
    assert status_for_alex() == "sent"
    assert (
        client.post(
            "/api/receipts",
            headers=j,
            json={"message_ids": [outbound["id"]], "status": "delivered"},
        ).status_code
        == 200
    )
    assert status_for_alex() == "delivered"
    client.post(
        "/api/receipts",
        headers=m,
        json={"message_ids": [outbound["id"]], "status": "read"},
    )
    assert status_for_alex() == "delivered"
    client.post(
        "/api/receipts",
        headers=j,
        json={"message_ids": [outbound["id"]], "status": "read"},
    )
    assert status_for_alex() == "read"

    # A fresh session still sees the same group and its messages from SQLite.
    fresh_alex, _ = login(client, "alex")
    persisted_group = next(
        item
        for item in client.get("/api/conversations", headers=fresh_alex).json()
        if item["id"] == cid
    )
    assert persisted_group["name"] == "Study Circle"
    persisted_messages = client.get(
        f"/api/conversations/{cid}/messages", headers=fresh_alex
    ).json()
    assert [item["body"] for item in persisted_messages][-2:] == [
        "The group database design is ready.",
        "Great, I will review it now.",
    ]


def test_replies_reactions_and_disappearing_messages(client):
    a, _ = login(client, "alex")
    m, md = login(client, "maya")
    first = send(client, a, 1).json()
    reply = send(client, m, 1, "A reply", reply_to=first["id"]).json()
    assert reply["reply"]["body"] == "Hello"
    assert send(client, a, 2, reply_to=first["id"]).status_code == 400
    persisted_reply = next(
        item
        for item in client.get("/api/conversations/1/messages", headers=a).json()
        if item["id"] == reply["id"]
    )
    assert persisted_reply["reply"]["id"] == first["id"]
    r = client.post(
        f"/api/messages/{first['id']}/reaction", headers=m, json={"emoji": "❤️"}
    ).json()
    assert len(r["reactions"]) == 1
    persisted_reaction = next(
        item
        for item in client.get("/api/conversations/1/messages", headers=a).json()
        if item["id"] == first["id"]
    )
    assert persisted_reaction["reactions"] == [
        {"user_id": md["user"]["id"], "emoji": "❤️"}
    ]
    r = client.post(
        f"/api/messages/{first['id']}/reaction", headers=m, json={"emoji": "❤️"}
    ).json()
    assert len(r["reactions"]) == 0
    assert (
        client.patch(
            "/api/conversations/1/timer", headers=a, json={"seconds": 30}
        ).status_code
        == 200
    )
    msg = send(client, a, 1, "Temporary").json()
    assert msg["expires_at"] - msg["created_at"] == 30000
    with database.db() as c:
        c.execute("UPDATE messages SET expires_at=1 WHERE id=?", (msg["id"],))
    asyncio.run(expire_once())
    with database.db() as c:
        assert not c.execute(
            "SELECT 1 FROM messages WHERE id=?", (msg["id"],)
        ).fetchone()
    assert not any(
        x["id"] == msg["id"]
        for x in client.get("/api/conversations/1/messages", headers=a).json()
    )


def test_attachments_are_protected(client):
    a, _ = login(client, "alex")
    m, _ = login(client, "maya")
    o, _ = login(client, "outsider")
    attachment = client.post(
        "/api/attachments",
        headers=a,
        files={"file": ("notes.txt", b"hello", "text/plain")},
    ).json()
    aid = attachment["id"]
    assert client.get(f"/api/attachments/{aid}", headers=m).status_code == 403
    assert send(client, m, 1, "", attachment_id=aid).status_code == 403
    assert send(client, a, 1, "", attachment_id=aid).status_code == 200
    assert client.get(f"/api/attachments/{aid}", headers=m).content == b"hello"
    assert client.get(f"/api/attachments/{aid}", headers=o).status_code == 403


def receive_type(ws, event_type):
    for _ in range(20):
        data = ws.receive_json()
        if data["type"] == event_type:
            return data
    raise AssertionError(f"No {event_type} event")


def test_real_websocket_delivery_typing_and_receipts(client):
    a, ad = login(client, "alex")
    m, md = login(client, "maya")
    with client.websocket_connect("/ws") as wa, client.websocket_connect("/ws") as wm:
        wa.send_json({"type": "auth", "token": ad["token"]})
        receive_type(wa, "connected")
        assert receive_type(wa, "presence")["user_id"] == ad["user"]["id"]
        wm.send_json({"type": "auth", "token": md["token"]})
        receive_type(wm, "connected")
        presence = receive_type(wa, "presence")
        assert presence["user_id"] == md["user"]["id"]
        assert presence["online"] is True
        wa.send_json({"type": "typing", "conversation_id": 1, "active": True})
        assert receive_type(wm, "typing")["user_id"] == ad["user"]["id"]
        msg = send(client, a, 1, "Live message").json()
        assert receive_type(wm, "message")["message"]["id"] == msg["id"]
        client.post(
            "/api/receipts",
            headers=m,
            json={"message_ids": [msg["id"]], "status": "read"},
        )
        assert receive_type(wa, "receipts")["messages"][0]["status"] == "read"
