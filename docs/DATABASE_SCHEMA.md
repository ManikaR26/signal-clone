# Database schema

The application uses SQLite as its source of truth. Each message is stored as
its own row; conversations are not stored as one JSON object. Foreign keys are
enabled for every connection, and short transactions commit durable state
before real-time events are broadcast.

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : owns
    USERS ||--o{ CONTACTS : creates
    USERS ||--o{ CONVERSATION_MEMBERS : joins
    CONVERSATIONS ||--o{ CONVERSATION_MEMBERS : contains
    CONVERSATIONS ||--o{ MESSAGES : contains
    USERS ||--o{ MESSAGES : sends
    MESSAGES ||--o{ MESSAGE_RECEIPTS : tracks
    USERS ||--o{ MESSAGE_RECEIPTS : acknowledges
    MESSAGES ||--o{ REACTIONS : receives
    USERS ||--o{ REACTIONS : adds
    ATTACHMENTS ||--o{ MESSAGES : supports
    MESSAGES ||--o| MESSAGES : quotes

    USERS {
        integer id PK
        string username UK
        string display_name
        string avatar
        integer last_seen
    }
    SESSIONS {
        string token_hash PK
        integer user_id FK
        integer expires_at
    }
    CONTACTS {
        integer owner_id PK, FK
        integer contact_id PK, FK
    }
    CONVERSATIONS {
        integer id PK
        string kind
        string direct_key UK
        string name
        integer created_by FK
        integer disappear_seconds
    }
    CONVERSATION_MEMBERS {
        integer conversation_id PK, FK
        integer user_id PK, FK
        string role
        integer joined_at
    }
    MESSAGES {
        integer id PK
        integer conversation_id FK
        integer sender_id FK
        string body
        string client_id
        integer created_at
        integer reply_to FK
        string attachment_id FK
        integer expires_at
    }
    MESSAGE_RECEIPTS {
        integer message_id PK, FK
        integer user_id PK, FK
        integer delivered_at
        integer read_at
    }
    ATTACHMENTS {
        string id PK
        integer owner_id FK
        string name
        string mime
        integer size
        string path
    }
    REACTIONS {
        integer message_id PK, FK
        integer user_id PK, FK
        string emoji
    }
```

## Design decisions

- `conversation_members` supports both direct and group conversations without
  storing comma-separated user IDs.
- `message_receipts` is separate because each group member can have a
  different delivery or read state.
- `UNIQUE(sender_id, client_id)` makes message retries idempotent.
- `direct_key` prevents duplicate direct conversations for the same pair.
- The current implementation uses parameterized `sqlite3` statements instead
  of an ORM. This keeps the required SQLite schema visible and avoids adding
  unnecessary abstraction for a single-instance assignment demo.
