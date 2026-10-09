"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Phone,
  Settings as SettingsIcon,
  Search,
  SquarePen,
  CheckCheck,
  Bookmark,
  X,
  Check,
  MoreVertical,
} from "lucide-react";
import { User, chatName, chatAvatar } from "@/lib/types";
import { useMessenger } from "@/lib/useMessenger";
import { Avatar, IconButton, listTime } from "./ui";
import { NewChat, ChatDetails, Settings } from "./Dialogs";
import ChatPane from "./ChatPane";
export default function Messenger({
  user,
  onUser,
  onLogout,
  onExpired,
}: {
  user: User;
  onUser: (u: User) => void;
  onLogout: () => void;
  onExpired: () => void;
}) {
  const m = useMessenger(user, onExpired),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [dialog, setDialog] = useState(""),
    [theme, setThemeState] = useState("light"),
    [sideTab, setSideTab] = useState("chats");
  const searchRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setDialog(""), []);
  useEffect(() => {
    setThemeState(localStorage.getItem("signal_theme") || "light");
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  function setTheme(t: string) {
    setThemeState(t);
    localStorage.setItem("signal_theme", t);
  }
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        setDialog("new");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && !dialog) {
        m.setSelected(null);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [dialog, m.setSelected]);
  const chat = m.chats.find((c) => c.id === m.selected),
    unread = m.chats.reduce((n, c) => n + c.unread, 0);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingContacts = normalizedQuery
    ? m.contacts.filter((c) =>
        [c.username, c.display_name].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : [];
  const chats = m.chats.filter(
    (c) =>
      (filter === "all" ||
        (filter === "unread" ? c.unread > 0 : c.kind === "group")) &&
      (chatName(c, user.id).toLowerCase().includes(normalizedQuery) ||
        c.members.some((u) =>
          [u.username, u.display_name].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          ),
        )),
  );
  useEffect(() => {
    document.title = unread
      ? `(${unread}) Signal · Messenger`
      : "Signal · Messenger";
  }, [unread]);
  return (
    <main className={`messenger ${m.selected ? "chat-open" : ""}`}>
      <nav className="navigation-rail" aria-label="Main navigation">
        <button
          className="my-avatar"
          aria-label="Your profile"
          onClick={() => setDialog("settings")}
        >
          <Avatar name={user.display_name} color={user.avatar} size={38} />
        </button>
        <div className="rail-tabs">
          <div className="rail-item">
            <IconButton
              label="Chats"
              active={sideTab === "chats"}
              onClick={() => setSideTab("chats")}
            >
              <MessageCircle size={23} />
            </IconButton>
            {unread > 0 && (
              <span className="rail-badge">{unread > 9 ? "9+" : unread}</span>
            )}
            <span>Chats</span>
          </div>
          <div className="rail-item">
            <IconButton
              label="Calls"
              active={sideTab === "calls"}
              onClick={() => setSideTab("calls")}
            >
              <Phone size={21} />
            </IconButton>
            <span>Calls</span>
          </div>
          <div className="rail-item">
            <IconButton
              label="Stories"
              active={sideTab === "stories"}
              onClick={() => setSideTab("stories")}
            >
              <span className="stories-icon" />
            </IconButton>
            <span>Stories</span>
          </div>
        </div>
        <div className="rail-bottom">
          <IconButton label="Settings" onClick={() => setDialog("settings")}>
            <SettingsIcon size={23} />
          </IconButton>
          <span
            className={`connection-dot ${m.connected ? "connected" : ""}`}
            title={m.connected ? "Connected" : "Connecting"}
          />
        </div>
      </nav>
      <aside className="sidebar" aria-label="Conversations and contacts">
        <header className="sidebar-header">
          <h1>
            {sideTab === "chats"
              ? "Chats"
              : sideTab === "calls"
                ? "Calls"
                : "Stories"}
          </h1>
          <div className="sidebar-header-actions">
            <IconButton label="New chat" onClick={() => setDialog("new")}>
              <SquarePen size={21} />
            </IconButton>
            <IconButton
              label="Chat options"
              onClick={() => m.notify("Chat options are coming soon")}
            >
              <MoreVertical size={21} />
            </IconButton>
          </div>
        </header>
        {sideTab === "chats" ? (
          <>
            <div className="sidebar-search">
              <div className="search-field">
                <Search size={18} />
                <input
                  ref={searchRef}
                  aria-label="Search conversations and contacts"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <IconButton label="Clear search" onClick={() => setQuery("")}>
                    <X size={15} />
                  </IconButton>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
            </div>
            <div
              className="chat-filters"
              role="group"
              aria-label="Filter conversations"
            >
              {[
                ["all", "All"],
                ["unread", "Unread"],
                ["groups", "Groups"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  className={filter === value ? "selected" : ""}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  {value === "unread" && unread > 0 && <span>{unread}</span>}
                </button>
              ))}
            </div>
            <div className="conversation-list">
              {chats.map((c) => {
                const other = c.members.find((u) => u.id !== user.id),
                  name = chatName(c, user.id),
                  last = c.last_message;
                return (
                  <button
                    key={c.id}
                    className={`conversation ${m.selected === c.id ? "selected" : ""}`}
                    onClick={() => m.setSelected(c.id)}
                  >
                    <div className="conversation-avatar">
                      <Avatar
                        name={name}
                        color={chatAvatar(c, user.id)}
                        group={c.kind === "group"}
                        size={48}
                      />
                      {c.kind === "direct" && other?.online && (
                        <span className="avatar-online" />
                      )}
                    </div>
                    <span className="conversation-copy">
                      <span className="conversation-top">
                        <b>{name}</b>
                        <time className={c.unread ? "unread-time" : ""}>
                          {listTime(c.updated_at)}
                        </time>
                      </span>
                      <span className="conversation-bottom">
                        <span
                          className={`last-message ${c.unread ? "unread-message" : ""}`}
                        >
                          {last?.sender_id === user.id &&
                            (last.status === "sent" ? (
                              <Check size={15} />
                            ) : (
                              <CheckCheck size={15} />
                            ))}
                          {last
                            ? (c.kind === "group"
                                ? `${last.sender_id === user.id ? "You" : c.members.find((u) => u.id === last.sender_id)?.display_name.split(" ")[0] || "Member"}: `
                                : "") + (last.body || "Attachment")
                            : "Start a conversation"}
                        </span>
                        {c.unread > 0 && (
                          <span className="unread-badge">{c.unread}</span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!chats.length && (
                <div className="empty-list">
                  <MessageCircle size={30} />
                  <b>
                    {query
                      ? "No conversations found"
                      : filter === "unread"
                        ? "You’re all caught up"
                        : "No conversations yet"}
                  </b>
                  <p>
                    {query
                      ? "Search contacts below or start a new message."
                      : "A good conversation starts with hello."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setDialog("new")}
                  >
                    New message
                  </button>
                </div>
              )}
              {matchingContacts.length > 0 && (
                <>
                  <div className="section-label search-contact-label">
                    Contacts
                  </div>
                  {matchingContacts.map((c) => (
                    <button
                      className="person-row searched-contact"
                      key={c.id}
                      onClick={async () => {
                        try {
                          const { api } = await import("@/lib/api");
                          const chat = await api<
                            import("@/lib/types").Conversation
                          >("/conversations", "POST", {
                            kind: "direct",
                            member_ids: [c.id],
                          });
                          await m.refresh();
                          m.setSelected(chat.id);
                          setQuery("");
                        } catch (e) {
                          m.notify((e as Error).message);
                        }
                      }}
                    >
                      <Avatar
                        name={c.display_name}
                        color={c.avatar}
                        size={39}
                      />
                      <span>
                        <b>{c.display_name}</b>
                        <small>@{c.username}</small>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="sidebar-footer">
              <span className="footer-lock">
                <Bookmark size={14} />
              </span>
              <span>
                Your everyday conversations,
                <br />
                <b>all in one place.</b>
              </span>
            </div>
          </>
        ) : (
          <div className="placeholder-panel">
            {sideTab === "calls" ? (
              <Phone size={38} />
            ) : (
              <span className="stories-icon large" />
            )}
            <h2>
              {sideTab === "calls"
                ? "No calls"
                : "No stories"}
            </h2>
            <p>
              {sideTab === "calls"
                ? "Recent calls will appear here."
                : "New stories will appear here."}
            </p>
          </div>
        )}
      </aside>
      <ChatPane
        chat={chat}
        user={user}
        messages={m.messages}
        loading={m.loading}
        loadError={m.loadError}
        typing={m.typing}
        connected={m.connected}
        onBack={() => m.setSelected(null)}
        onDetails={() => setDialog("details")}
        notify={m.notify}
        send={m.send}
        sendTyping={m.sendTyping}
        hasMore={m.hasMore}
        loadOlder={m.loadOlder}
        retryMessages={m.retryMessages}
      />
      {dialog === "new" && (
        <NewChat
          user={user}
          contacts={m.contacts}
          onClose={close}
          onCreated={(c) => {
            void m.refresh();
            m.setSelected(c.id);
            setSideTab("chats");
          }}
          notify={m.notify}
          refresh={m.refresh}
        />
      )}{" "}
      {dialog === "details" && chat && (
        <ChatDetails
          chat={chat}
          user={user}
          onClose={close}
          refresh={m.refresh}
          notify={m.notify}
        />
      )}{" "}
      {dialog === "settings" && (
        <Settings
          user={user}
          onClose={close}
          onUser={onUser}
          logout={onLogout}
          theme={theme}
          setTheme={setTheme}
          notify={m.notify}
        />
      )}{" "}
      {m.toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{m.toast}</span>
          <IconButton label="Dismiss notification" onClick={() => m.notify("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </main>
  );
}
