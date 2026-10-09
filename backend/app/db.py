"""SQLite persistence. One short connection/transaction per operation; foreign keys everywhere."""

import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
DB_PATH = DATA_DIR / "signal.db"


@contextmanager
def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def now():
    return int(time.time() * 1000)


def initialize():
    with db() as c:
        c.execute("PRAGMA journal_mode = WAL")
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT 'blue',
          last_seen INTEGER NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS contacts (
          owner_id INTEGER NOT NULL REFERENCES users(id), contact_id INTEGER NOT NULL REFERENCES users(id),
          PRIMARY KEY(owner_id, contact_id), CHECK(owner_id != contact_id));
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('direct','group')),
          name TEXT, direct_key TEXT UNIQUE, created_by INTEGER NOT NULL REFERENCES users(id),
          created_at INTEGER NOT NULL, disappear_seconds INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS conversation_members (
          conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('admin','member')),
          joined_at INTEGER NOT NULL, PRIMARY KEY(conversation_id,user_id));
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
          mime TEXT NOT NULL, size INTEGER NOT NULL, path TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
          client_id TEXT NOT NULL, created_at INTEGER NOT NULL,
          reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL,
          attachment_id TEXT REFERENCES attachments(id), expires_at INTEGER,
          UNIQUE(sender_id,client_id));
        CREATE TABLE IF NOT EXISTS message_receipts (
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id), delivered_at INTEGER, read_at INTEGER,
          PRIMARY KEY(message_id,user_id));
        CREATE TABLE IF NOT EXISTS reactions (
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id), emoji TEXT NOT NULL,
          PRIMARY KEY(message_id,user_id));
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(conversation_id,id);
        CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id,read_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_expiry ON messages(expires_at);
        """)
