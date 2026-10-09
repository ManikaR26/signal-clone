# Assignment requirement checklist

This maps the supplied “Secure Messaging Platform (Signal Clone)” PDF to the implementation. Checked source features are implemented; publication tasks remain explicitly unchecked until actual external URLs exist. See `QA_REPORT.md` for executed tests and [`FINAL_AUDIT.md`](FINAL_AUDIT.md) for the requirement-by-requirement implementation, test path and file location.

## Required stack

- [x] Next.js with TypeScript: `frontend/`, App Router and static export.
- [x] Python with FastAPI: `backend/app/`.
- [x] SQLite with a custom relational schema: `backend/app/db.py`.
- [x] Real-time messaging using WebSockets: `main.py`, `realtime.py`, `useMessenger.ts`.

## 1. Authentication / onboarding

- [x] Registration with username or phone number, fixed demo OTP `123456`.
- [x] Display name and avatar selection during registration.
- [x] Profile photo upload and profile editing in Settings.
- [x] Login and logout; token-based session restoration after reload.
- [x] Mocked verification/key exchange disclosed; no real encryption claim.

## 2. Contacts and conversation list

- [x] Left-hand conversation list beside the chat pane.
- [x] Sort conversations by most recent message activity.
- [x] Search conversations and contacts.
- [x] Add an existing registered user as a contact.
- [x] Unread indicators and last-message previews.
- [x] Live presence and stored last-seen timestamps; no fabricated online state.
- [x] All, Unread and Groups filters.

## 3. One-on-one messaging

- [x] Real-time text messages between independent authenticated WebSocket sessions; independent browser-session verification remains pending.
- [x] Message timestamps and date separators.
- [x] Single/double check delivery and reading indicators.
- [x] Sending, sent, delivered and read states; additional failed/retry state.
- [x] Typing indicators with an expiry so abandoned typing does not remain forever.
- [x] Messages persist in SQLite.
- [x] Reconnection and history refresh.
- [x] Backend verifies conversation membership; changing a URL/ID does not grant access.

## 4. Group messaging

- [x] Create a named group with selected members; browser UI verification remains pending.
- [x] Real-time group messages; browser UI verification remains pending.
- [x] View group members and admin role; browser UI verification remains pending.
- [x] Admin-only add/remove controls, enforced by backend permissions.
- [x] Group, membership and message persistence.
- [x] Removed members lose access to future sends and history requests.

## 5. Signal experience

- [x] Signal-inspired navigation rail, conversation list and chat pane; visual browser review remains pending.
- [x] Rounded incoming/outgoing message bubbles, grouping and timestamps.
- [x] Contact/group forms, dialogs, search and filters; visual browser review remains pending.
- [x] In-app notifications and toast feedback.
- [x] Settings: profile, privacy, notifications, appearance and linked devices; visual browser review remains pending.
- [x] Explicit empty, loading, reconnecting and failed-message states.
- [x] Focus-trapped dialogs, labeled icon controls and keyboard navigation.
- [ ] Pixel-perfect equivalence to every original Signal version is **not claimed**. The UI is an original visual recreation based on Signal references and should be reviewed by the candidate before submission.

## Permitted placeholders

- [x] Voice and video calls: Coming Soon feedback.
- [x] Stories: placeholder view.
- [x] Linked devices: placeholder settings panel.
- [x] Encryption: explicitly simulated, plaintext storage disclosed.

## Optional bonuses implemented

- [x] Images/files up to 10 MB with authenticated downloads; browser upload/download verification remains pending.
- [x] Emoji reactions; one reaction per user/message, togglable.
- [x] Reply-to/quoted messages.
- [x] Functional disappearing messages, including a 30-second demonstration option.
- [x] Light, dark and system appearance; browser visual verification remains pending.
- [x] Responsive desktop/tablet/mobile navigation; browser visual verification remains pending.
- [x] Keyboard shortcuts; browser interaction verification remains pending.

Disappearing timers intentionally begin at send time; this differs from Signal's exact behavior. Expired message rows are deleted; downloaded files cannot be recalled, and file bytes are not securely erased.

## Data and documentation

- [x] Multiple seeded users, direct/group conversations and messages.
- [x] Idempotent seed: restarting does not erase existing data.
- [x] Original implementation, not copied from a clone repository.
- [x] README with setup, stack, architecture, database schema, API overview and assumptions.
- [x] Interview explanation guide and quick-start instructions.
- [x] Integration tests and verification report.

## Deliverables / submission

- [x] Source code organized as `frontend/` and `backend/`.
- [x] Buildable project and included prebuilt frontend in the downloadable ZIP; Docker image build remains pending on a Docker-capable host.
- [x] Dockerfile, Compose setup and Render deployment blueprint.
- [ ] **Public GitHub repository:** needs publication through the candidate's GitHub account.
- [ ] **Hosted working URL:** needs deployment to a Python/WebSocket host with persistent storage.
- [ ] **Public deployment verification:** independent browser messaging and restart-persistence check on the actual host.
- [ ] **Submission form:** submit both final URLs with the recruiter's required email.

Do not mark the last four items complete merely because local tests pass or deployment configuration exists.
