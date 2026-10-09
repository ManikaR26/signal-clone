# Understand your submission

Use this guide while reading the actual files. It is a starting point, not a substitute for understanding the code you submit.

## The 45-second overview

“I built a Signal-inspired messaging application using Next.js with TypeScript, FastAPI and SQLite. REST endpoints handle persistent operations such as authentication, groups and messages. WebSockets notify connected users about new messages, receipts, typing and presence. The database is the source of truth, so chats survive refreshes and disconnected users can load their history when they return. Each conversation operation checks membership on the server, and group membership changes also require an admin role. OTP verification and encryption are mocked, as allowed by the assignment.”

## Trace one message

1. Read `ChatPane.tsx`: the composer calls `send` with text, an optional attachment and a quoted message.
2. Read `useMessenger.ts`: a UUID is created as `client_id`. An optimistic message appears with status `sending`.
3. Read `api.ts`: the request includes the session bearer token and posts to `/conversations/{id}/messages`.
4. Read `security.py`: the token hash must match an unexpired database session.
5. Read `routes.py`, `send_message`: the server checks chat membership, content, quoted message scope and attachment ownership.
6. The server writes the message and per-recipient receipt rows in one SQLite transaction. The unique sender/client-ID constraint prevents duplicate retries.
7. After committing, `hub.broadcast` sends the message to the current members' connected sockets. The REST response also returns the saved message.
8. The client replaces the optimistic entry using `client_id`, avoiding a second copy when HTTP and WebSocket responses both arrive.
9. The recipient acknowledges delivery. If the conversation is open and the document visible, it acknowledges reading.
10. The backend updates receipts and publishes the changed status to participants.

The chat hook also keeps loading, empty and error states separate. If history
loading fails, `ChatPane.tsx` shows the error and a retry action instead of
pretending that the conversation has no messages.

## Why these tables?

- `users` contains identity/profile data; `sessions` separates login sessions from users so logout can revoke just one session.
- `contacts` is directional. Adding Maya to Alex's contacts does not imply Maya added Alex.
- `conversations` represents a chat; `conversation_members` represents who belongs to it and their role. This supports groups without storing comma-separated user IDs.
- `messages` belongs to one conversation and one sender.
- `message_receipts` must be separate because a group message can be read by one member but not another.
- `attachments` contains file metadata, while bytes remain on disk. Downloads require authorization.
- `reactions` prevents one person from accumulating unlimited duplicate reactions on one message.

## Questions to practise

### Why WebSockets instead of repeated polling?

WebSockets keep a connection open so the server can push changes promptly. Polling repeatedly asks for updates even when nothing changes. This app still uses REST for durable writes and history because those operations are easy to validate, retry and document.

### Why does the backend save before broadcasting?

If it broadcast first and the database write failed, users would see a message that does not exist after refresh. Committing first makes the database authoritative.

### What happens if the user loses internet?

The socket reconnects with capped exponential backoff. History and pending deliveries are fetched again. If a send request fails, the UI offers Retry. The same client ID makes a retry safe even if the first request committed but its response was lost.

### Can users access another chat by changing the ID?

No. The server looks up the authenticated user's membership for every protected conversation operation. It does not trust a user ID sent by the browser. Attachments also check ownership or membership in a conversation that references the file.

### How are group admin controls enforced?

The UI hides member-management controls for non-admins, but the real protection is the backend `membership(..., admin=True)` check. Calling the API directly as a non-admin returns 403. Removing someone immediately prevents future history fetches and sends.

### What do sent, delivered and read mean?

Sent means committed to SQLite. Delivered means recipients acknowledged receipt. Read means recipients viewed the open conversation in a visible browser tab. Group status becomes delivered/read once all original recipients reach that state.

### Why store a hash of a session token?

The browser holds an unpredictable random token. The database stores only its SHA-256 hash. A database leak does not directly reveal usable bearer tokens. This does not fix the deliberate fixed-OTP authentication weakness; real identity verification is outside this assignment.

### Is this actually encrypted?

No. The UI and documentation explicitly disclose the simulation. HTTPS protects traffic when properly deployed, but that is not end-to-end encryption. Real Signal encryption would require a substantially different client-side protocol and key management design.

### Why SQLite?

It is required by the assignment and is convenient for a single-instance demo. Foreign keys, unique constraints, transactions, indexes and WAL mode still matter. Multiple writers and multiple service instances would need a revised deployment/database strategy.

### Why only one Python worker?

The current connection hub lives in process memory. Two workers would have separate socket registries. A message saved in one worker would not automatically reach clients connected to the other. Shared pub/sub is needed to scale that design.

### Why export Next.js instead of running a Node server?

The app is an interactive client-side application and does not need server rendering. Next.js still builds the TypeScript/React frontend; its output can be served by FastAPI, keeping a single production URL and a simpler deployment.

### How do disappearing messages work?

A timer on the conversation sets an expiry timestamp for future messages. Reads filter out expired messages, and the `expire_once()` cleanup pass deletes them and notifies clients. The pass is called by a two-second background task and is tested directly so the database deletion is verifiable. This demo starts timers when messages are sent; it does not claim to implement Signal's exact timer semantics or secure file erasure.

## Read these files in order

1. `frontend/lib/types.ts` — domain shapes.
2. `backend/app/db.py` — schema and transactions.
3. `backend/app/security.py` — authentication and authorization.
4. `backend/app/routes.py` — start with auth, then direct messages, then groups.
5. `backend/app/realtime.py` and `main.py` — live event handling.
6. `frontend/lib/api.ts` and `useMessenger.ts` — browser data flow.
7. `Auth.tsx`, `Messenger.tsx`, `ChatPane.tsx`, `Dialogs.tsx` — visible interactions.
8. `backend/tests/test_workflows.py` — proof of the main invariants.

## Be ready to demonstrate

- Register a new user and upload a profile photo.
- Find a seeded user and add them as a contact.
- Send a message to another browser and explain the receipt changes.
- Create a group and show that a non-admin cannot remove people.
- Reload both browsers and show persisted history.
- React, reply, send a file and change the theme.
- Set a 30-second expiry and show a new message disappearing.
- Explain one limitation honestly and describe how you would improve it.
