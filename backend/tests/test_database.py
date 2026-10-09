"""Fresh-database and seed-data checks for the SQLite foundation."""

import pytest
from fastapi.testclient import TestClient

from app import db as database
from app.main import app
from app.seed import seed


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Run the application against a new temporary SQLite database."""

    monkeypatch.setattr(database, "DB_PATH", tmp_path / "fresh.db")
    with TestClient(app) as test_client:
        yield test_client


def test_fresh_database_has_expected_schema_and_seed_data(client):
    with database.db() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        foreign_keys = connection.execute("PRAGMA foreign_keys").fetchone()[0]

        assert foreign_keys == 1
        assert {
            "users",
            "sessions",
            "contacts",
            "conversations",
            "conversation_members",
            "messages",
            "message_receipts",
            "attachments",
            "reactions",
        }.issubset(tables)
        assert connection.execute("SELECT count(*) FROM users").fetchone()[0] == 6
        assert (
            connection.execute("SELECT count(*) FROM conversations").fetchone()[0]
            == 7
        )
        assert connection.execute("SELECT count(*) FROM messages").fetchone()[0] == 21


def test_seed_is_idempotent(client):
    with database.db() as connection:
        before = tuple(
            connection.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
            for table in ("users", "contacts", "conversations", "messages")
        )

    seed()

    with database.db() as connection:
        after = tuple(
            connection.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
            for table in ("users", "contacts", "conversations", "messages")
        )

    assert after == before
