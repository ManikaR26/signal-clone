"use client";
import { useEffect, useState } from "react";
import {
  Search,
  MessageCircle,
  Phone,
  Users,
  UserPlus,
  Check,
  ChevronRight,
  Shield,
  Bell,
  Palette,
  Monitor,
  LogOut,
  Camera,
  Timer,
  LockKeyhole,
  UserRound,
  Heart,
  Settings2,
  Database,
  HardDriveDownload,
} from "lucide-react";
import { api } from "@/lib/api";
import { User, Conversation, chatName, chatAvatar } from "@/lib/types";
import { Avatar, Modal } from "./ui";
export function NewChat({
  user,
  contacts,
  group = false,
  onClose,
  onCreated,
  notify,
  refresh,
}: {
  user: User;
  contacts: User[];
  group?: boolean;
  onClose: () => void;
  onCreated: (c: Conversation) => void;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
}) {
  const [mode, setMode] = useState(group ? "group" : "chat"),
    [search, setSearch] = useState(""),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<number[]>([]),
    [people, setPeople] = useState(contacts),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (search.trim()) {
        api<User[]>(`/users?q=${encodeURIComponent(search)}`)
          .then((r) => {
            if (active) setPeople(r);
          })
          .catch((e) => setError(e.message));
      } else setPeople(contacts);
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, contacts]);
  async function create(ids = selected) {
    setBusy(true);
    setError("");
    try {
      const c = await api<Conversation>("/conversations", "POST", {
        kind: mode === "group" ? "group" : "direct",
        name,
        member_ids: ids,
      });
      onCreated(c);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    setBusy(true);
    setError("");
    try {
      const u = await api<User>("/contacts", "POST", { username: search });
      await refresh();
      setMode("chat");
      setSearch("");
      setPeople((old) => [...old.filter((x) => x.id !== u.id), u]);
      notify(`${u.display_name} added to contacts`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "group"
          ? "New group"
          : mode === "add"
            ? "Find a contact"
            : "New chat"
      }
      onClose={onClose}
    >
      <div className="modal-body">
        {mode === "chat" && (
          <div className="new-actions">
            <button onClick={() => setMode("group")}>
              <span className="round-icon">
                <Users size={20} />
              </span>
              New group
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => {
                setMode("add");
                setSearch("");
              }}
            >
              <span className="round-icon">
                <UserPlus size={20} />
              </span>
              Find by username or phone number
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        {mode === "group" && (
          <label>
            Group name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give your group a name"
              maxLength={80}
            />
          </label>
        )}
        <div className="search-field modal-search">
          <Search size={18} />
          <input
            aria-label="Search contacts"
            autoFocus={mode !== "group"}
            placeholder={
              mode === "add"
                ? "Username or phone number"
                : "Name, username, or number"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {mode === "add" ? (
          <>
            <p className="helper">
              Your contact must already have an account. Try <b>maya</b>,{" "}
              <b>jordan</b>, or ask a friend to register.
            </p>
            <button
              className="primary"
              disabled={busy || !search.trim()}
              onClick={() => void add()}
            >
              Add contact
            </button>
          </>
        ) : (
          <>
            <div className="section-label">
              {mode === "group" ? `${selected.length} selected` : "Contacts"}
            </div>
            <div className="people-list">
              {people
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <button
                    disabled={busy}
                    className="person-row"
                    key={p.id}
                    aria-pressed={
                      mode === "group" ? selected.includes(p.id) : undefined
                    }
                    onClick={() =>
                      mode === "group"
                        ? setSelected((old) =>
                            old.includes(p.id)
                              ? old.filter((x) => x !== p.id)
                              : [...old, p.id],
                          )
                        : void create([p.id])
                    }
                  >
                    <Avatar name={p.display_name} color={p.avatar} />
                    <span>
                      <b>{p.display_name}</b>
                      <small>@{p.username}</small>
                    </span>
                    {mode === "group" && (
                      <span
                        className={`check-box ${selected.includes(p.id) ? "checked" : ""}`}
                      >
                        {selected.includes(p.id) && <Check size={15} />}
                      </span>
                    )}
                  </button>
                ))}
              {!people.length && (
                <p className="empty-small">
                  No contacts found. Search for a registered username.
                </p>
              )}
            </div>
            {mode === "group" && (
              <button
                className="primary"
                disabled={busy || !name.trim() || !selected.length}
                onClick={() => void create()}
              >
                {busy ? "Creating…" : "Create group"}
              </button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
export function ChatDetails({
  chat,
  user,
  onClose,
  refresh,
  notify,
}: {
  chat: Conversation;
  user: User;
  onClose: () => void;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [adding, setAdding] = useState(false),
    [people, setPeople] = useState<User[]>([]),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<User | null>(null);
  const admin = chat.members.find((m) => m.id === user.id)?.role === "admin";
  useEffect(() => {
    if (adding)
      void api<User[]>("/users")
        .then(setPeople)
        .catch((e) => notify(e.message));
  }, [adding, notify]);
  async function change(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(path, method, body);
      await refresh();
      setAdding(false);
      setRemove(null);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const name = chatName(chat, user.id);
  return (
    <Modal
      title={chat.kind === "group" ? "Group details" : "Conversation details"}
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="details-profile">
          <Avatar
            name={name}
            color={chatAvatar(chat, user.id)}
            group={chat.kind === "group"}
            size={88}
          />
          <h2>{name}</h2>
          <p>
            {chat.kind === "group"
              ? `${chat.members.length} members`
              : `@${chat.members.find((m) => m.id !== user.id)?.username}`}
          </p>
        </div>
        <div className="detail-setting">
          <Timer size={20} />
          <span>
            <b>Disappearing messages</b>
            <small>New messages expire after sending</small>
          </span>
          <select
            aria-label="Disappearing messages"
            disabled={busy || (chat.kind === "group" && !admin)}
            value={chat.disappear_seconds}
            onChange={(e) =>
              void change(`/conversations/${chat.id}/timer`, "PATCH", {
                seconds: Number(e.target.value),
              })
            }
          >
            {[
              [0, "Off"],
              [30, "30 seconds"],
              [300, "5 minutes"],
              [3600, "1 hour"],
              [86400, "1 day"],
              [604800, "1 week"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="privacy-note">
          <LockKeyhole size={16} />
          <span>
            Encryption is simulated in this assignment. Messages are stored as
            plaintext.
          </span>
        </div>
        {chat.kind === "group" && (
          <>
            <div className="section-label members-heading">
              <span>Members · {chat.members.length}</span>
              {admin && (
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => setAdding(!adding)}
                >
                  <UserPlus size={16} /> Add
                </button>
              )}
            </div>
            {chat.members.map((m) => (
              <div className="person-row" key={m.id}>
                <Avatar name={m.display_name} color={m.avatar} size={38} />
                <span>
                  <b>
                    {m.display_name}
                    {m.id === user.id ? " (you)" : ""}
                  </b>
                  <small>
                    {m.role === "admin" ? "Group admin" : `@${m.username}`}
                  </small>
                </span>
                {admin && m.role !== "admin" && (
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => setRemove(m)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {remove && (
              <div className="confirm-box">
                <p>Remove {remove.display_name} from this group?</p>
                <div>
                  <button className="secondary" onClick={() => setRemove(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void change(
                        `/conversations/${chat.id}/members/${remove.id}`,
                        "DELETE",
                      )
                    }
                  >
                    Remove member
                  </button>
                </div>
              </div>
            )}
            {adding && (
              <div className="add-members">
                <div className="section-label">Add people</div>
                {people
                  .filter((p) => !chat.members.some((m) => m.id === p.id))
                  .map((p) => (
                    <button
                      className="person-row"
                      disabled={busy}
                      key={p.id}
                      onClick={() =>
                        void change(
                          `/conversations/${chat.id}/members`,
                          "POST",
                          { user_id: p.id },
                        )
                      }
                    >
                      <Avatar
                        name={p.display_name}
                        color={p.avatar}
                        size={34}
                      />
                      <span>{p.display_name}</span>
                      <UserPlus size={18} />
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
export function Settings({
  user,
  onClose,
  onUser,
  logout,
  theme,
  setTheme,
  notify,
}: {
  user: User;
  onClose: () => void;
  onUser: (u: User) => void;
  logout: () => void;
  theme: string;
  setTheme: (t: string) => void;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("profile"),
    [display, setDisplay] = useState(user.display_name),
    [avatar, setAvatar] = useState(user.avatar),
    [notifications, setNotifications] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(
    () =>
      setNotifications(localStorage.getItem("signal_notifications") !== "off"),
    [],
  );
  async function save() {
    setBusy(true);
    try {
      const u = await api<User>("/profile", "PATCH", {
        display_name: display,
        avatar,
      });
      onUser(u);
      notify("Profile updated");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("Choose a PNG, JPG, or WebP image.");
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 192;
      canvas.height = 192;
      const ctx = canvas.getContext("2d")!;
      const side = Math.min(image.width, image.height);
      ctx.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        192,
        192,
      );
      setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      notify("This image could not be opened.");
    };
    image.src = url;
  }
  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settings-layout">
        <nav>
          {[
            {
              id: "profile",
              label: "Account",
              icon: (
                <Avatar
                  name={user.display_name}
                  color={user.avatar}
                  size={22}
                />
              ),
            },
            { id: "donate", label: "Donate to Signal", icon: <Heart size={19} /> },
            { id: "general", label: "General", icon: <Settings2 size={19} /> },
            {
              id: "appearance",
              label: "Appearance",
              icon: <Palette size={19} />,
            },
            {
              id: "notifications",
              label: "Notifications",
              icon: <Bell size={19} />,
            },
            { id: "chats", label: "Chats", icon: <MessageCircle size={19} /> },
            { id: "calls", label: "Calls", icon: <Phone size={19} /> },
            { id: "privacy", label: "Privacy", icon: <Shield size={19} /> },
            { id: "data", label: "Data usage", icon: <Database size={19} /> },
            { id: "backups", label: "Backups", icon: <HardDriveDownload size={19} /> },
          ].map((t) => (
            <button
              className={tab === t.id ? "selected" : ""}
              key={t.id}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <button className="danger" onClick={logout}>
            <LogOut size={19} />
            Log out
          </button>
        </nav>
        <div className="settings-content">
          {tab === "profile" && (
            <>
              <div className="profile-photo">
                <Avatar name={display} color={avatar} size={90} />
                <label title="Upload profile photo" className="photo-button">
                  <Camera size={17} />
                  <input
                    aria-label="Upload profile photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => void photo(e.target.files?.[0])}
                  />
                </label>
              </div>
              <h3>Your profile</h3>
              <p className="helper">Choose how you appear to your contacts.</p>
              <label>
                Display name
                <input
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  maxLength={60}
                />
              </label>
              <label>
                Username
                <input readOnly value={`@${user.username}`} />
              </label>
              <div className="avatar-picker">
                {["blue", "rose", "green", "purple", "amber", "teal"].map(
                  (c) => (
                    <button
                      type="button"
                      key={c}
                      aria-label={`Choose ${c} avatar`}
                      aria-pressed={avatar === c}
                      onClick={() => setAvatar(c)}
                      className={`color-dot avatar-${c} ${avatar === c ? "selected" : ""}`}
                    />
                  ),
                )}
              </div>
              <button
                className="primary"
                disabled={busy || !display.trim()}
                onClick={() => void save()}
              >
                Save changes
              </button>
            </>
          )}
          {tab === "donate" && (
            <>
              <Heart size={42} className="muted" />
              <h3>Donate to Signal</h3>
              <p className="helper">Support private, open-source communication.</p>
              <button className="secondary" onClick={() => notify("Donations are not connected in this demo.")}>Learn more</button>
            </>
          )}
          {tab === "general" && (
            <>
              <h3>General</h3>
              <p className="helper">Manage general application preferences.</p>
              <p className="settings-note">This assignment demo keeps these options at their default values.</p>
            </>
          )}
          {tab === "appearance" && (
            <>
              <h3>Appearance</h3>
              <p className="helper">Make yourself at home.</p>
              <label>
                Theme
                <select
                  aria-label="Theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Use system setting</option>
                </select>
              </label>
              <div
                className={`theme-preview ${theme === "dark" ? "night" : ""}`}
              >
                <span />
                <span />
                <span />
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <h3>Notifications</h3>
              <p className="helper">
                Choose whether to show in-app new-message notifications.
              </p>
              <label className="toggle-row">
                Message notifications
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => {
                    setNotifications(e.target.checked);
                    localStorage.setItem(
                      "signal_notifications",
                      e.target.checked ? "on" : "off",
                    );
                  }}
                />
              </label>
            </>
          )}
          {tab === "chats" && (
            <>
              <h3>Chats</h3>
              <p className="helper">Chat preferences and message behavior.</p>
              <p className="settings-note">Read receipts, typing indicators, and disappearing messages are available in conversations.</p>
            </>
          )}
          {tab === "calls" && (
            <>
              <Phone size={42} className="muted" />
              <h3>Calls</h3>
              <p className="helper">Voice and video calls are coming soon in this demo.</p>
            </>
          )}
          {tab === "privacy" && (
            <>
              <h3>Privacy</h3>
              <div className="privacy-card">
                <Shield size={30} />
                <h4>About this demo</h4>
                <p>
                  Verification uses a fixed OTP. Messages are not end-to-end
                  encrypted. Use fictional conversations, not sensitive
                  information.
                </p>
              </div>
              <p className="helper">
                Screen security and advanced privacy controls are coming soon.
                Read receipts and typing indicators are enabled.
              </p>
            </>
          )}
          {tab === "devices" && (
            <>
              <Monitor size={44} className="muted" />
              <h3>Linked devices</h3>
              <p className="helper">
                Coming soon. You can already sign in on multiple browser
                sessions to try messaging.
              </p>
            </>
          )}
          {tab === "data" && (
            <>
              <h3>Data usage</h3>
              <p className="helper">Control how messages and attachments use data.</p>
              <p className="settings-note">Attachments are stored by the local demo service.</p>
            </>
          )}
          {tab === "backups" && (
            <>
              <HardDriveDownload size={42} className="muted" />
              <h3>Backups</h3>
              <p className="helper">Backups are not enabled for this assignment demo.</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
