"""Original fictional demo data; idempotent and never resets existing conversations."""

from .db import db, now


def seed():
    with db() as c:
        if c.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            return
        t = now()
        people = [
            ("alex", "Alex Morgan", "blue"),
            ("maya", "Maya Chen", "rose"),
            ("jordan", "Jordan Lee", "green"),
            ("sam", "Sam Rivera", "purple"),
            ("priya", "Priya Shah", "amber"),
            ("leo", "Leo Martin", "teal"),
        ]
        for username, name, color in people:
            c.execute(
                "INSERT INTO users(username,display_name,avatar,last_seen,created_at) VALUES(?,?,?,?,?)",
                (username, name, color, t - 300000, t),
            )
        for owner in range(1, 7):
            for other in range(1, 7):
                if owner != other:
                    c.execute("INSERT INTO contacts VALUES(?,?)", (owner, other))
        chats = [
            ("direct", None, "1:2", [1, 2]),
            ("group", "Weekend people", None, [1, 2, 3, 4]),
            ("direct", None, "1:3", [1, 3]),
            ("group", "Design studio", None, [1, 2, 5, 6]),
            ("direct", None, "1:5", [1, 5]),
            ("direct", None, "1:4", [1, 4]),
            ("direct", None, "1:6", [1, 6]),
        ]
        for kind, name, key, members in chats:
            cid = c.execute(
                "INSERT INTO conversations(kind,name,direct_key,created_by,created_at) VALUES(?,?,?,?,?)",
                (kind, name, key, 1, t - 86400000),
            ).lastrowid
            for uid in members:
                c.execute(
                    "INSERT INTO conversation_members VALUES(?,?,?,?)",
                    (cid, uid, "admin" if uid == 1 else "member", t - 86400000),
                )
        data = [
            (1, 2, "Hey! Did you get a chance to look at the photos?"),
            (1, 1, "Just did. That light at the lake was unreal."),
            (1, 2, "Right? Already thinking about our next little escape 🌿"),
            (1, 1, "Same here. How about Saturday morning?"),
            (1, 2, "Saturday works! There’s a trail I’ve been wanting to try."),
            (
                1,
                2,
                "We could grab coffee on the way. The little place near the station?",
            ),
            (1, 1, "You had me at coffee ☕"),
            (1, 2, "Perfect. Meet at 8:30? I’ll send you the route."),
            (2, 3, "Saturday plans are coming together!"),
            (2, 4, "I’m bringing snacks. Priorities."),
            (2, 2, "Who’s in for a morning hike? 🥾"),
            (3, 3, "That playlist you sent is so good."),
            (3, 1, "Track four has been on repeat."),
            (3, 3, "Adding a few more for the weekend 🎧"),
            (4, 5, "The new direction is looking really good."),
            (4, 6, "I added the final sketches."),
            (4, 2, "Let’s catch up tomorrow morning."),
            (5, 5, "Thanks for the book recommendation!"),
            (5, 1, "Let me know what you think of the ending."),
            (6, 4, "Made it home. Thanks for a lovely evening!"),
            (7, 6, "See you at the studio tomorrow."),
        ]
        for index, (cid, uid, body) in enumerate(data):
            # Most recent direct conversation stays first.
            created = t - (index + 1) * 180000 if cid != 1 else t - (8 - index) * 180000
            mid = c.execute(
                "INSERT INTO messages(conversation_id,sender_id,body,client_id,created_at) VALUES(?,?,?,?,?)",
                (cid, uid, body, f"seed-{index}", created),
            ).lastrowid
            recipients = c.execute(
                "SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id!=?",
                (cid, uid),
            ).fetchall()
            for r in recipients:
                unread = r["user_id"] == 1 and cid in (1, 2) and index in (7, 10)
                c.execute(
                    "INSERT INTO message_receipts VALUES(?,?,?,?)",
                    (
                        mid,
                        r["user_id"],
                        created + 500,
                        None if unread else created + 1500,
                    ),
                )
