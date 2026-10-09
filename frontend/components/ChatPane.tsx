"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Video,
  Phone,
  Search,
  MoreVertical,
  Smile,
  Plus,
  Send,
  Check,
  CheckCheck,
  Clock,
  Reply,
  X,
  FileText,
  Download,
  Timer,
  LockKeyhole,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import {
  Message,
  Conversation,
  User,
  Attachment,
  chatName,
  chatAvatar,
} from "@/lib/types";
import { api, fileBlob } from "@/lib/api";
import { Avatar, IconButton, timeLabel, SignalMark } from "./ui";
function ReceiptIcon({ status }: { status: Message["status"] }) {
  return (
    <span className={`receipt ${status}`} title={status} aria-label={status}>
      {status === "sending" ? (
        <Clock size={13} />
      ) : status === "failed" ? (
        <AlertCircle size={14} />
      ) : status === "sent" ? (
        <Check size={14} />
      ) : (
        <CheckCheck size={16} />
      )}
    </span>
  );
}
function AttachmentView({
  attachment,
  notify,
}: {
  attachment: Attachment;
  notify: (s: string) => void;
}) {
  const [src, setSrc] = useState("");
  const isImage = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ].includes(attachment.mime);
  useEffect(() => {
    let alive = true,
      url = "";
    if (isImage)
      fileBlob(attachment.id)
        .then((b) => {
          url = URL.createObjectURL(b);
          if (alive) setSrc(url);
          else URL.revokeObjectURL(url);
        })
        .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, isImage]);
  async function download() {
    try {
      const b = await fileBlob(attachment.id),
        url = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <button
      className="attachment-view"
      onClick={() => void download()}
      aria-label={`Download ${attachment.name}`}
    >
      {src ? (
        <img src={src} alt={attachment.name} />
      ) : (
        <span className="file-preview">
          <FileText size={27} />
          <span>
            <b>{attachment.name}</b>
            <small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small>
          </span>
          <Download size={17} />
        </span>
      )}
    </button>
  );
}
export default function ChatPane({
  chat,
  user,
  messages,
  loading,
  loadError,
  typing,
  connected,
  onBack,
  onDetails,
  notify,
  send,
  sendTyping,
  hasMore,
  loadOlder,
  retryMessages,
}: {
  chat: Conversation | undefined;
  user: User;
  messages: Message[];
  loading: boolean;
  loadError: string;
  typing: Record<number, { name: string; until: number }>;
  connected: boolean;
  onBack: () => void;
  onDetails: () => void;
  notify: (s: string) => void;
  send: (
    body: string,
    a?: Attachment | null,
    r?: Message | null,
    retry?: Message,
  ) => Promise<void>;
  sendTyping: (active: boolean) => void;
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  retryMessages: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [reply, setReply] = useState<Message | null>(null),
    [attachment, setAttachment] = useState<Attachment | null>(null),
    [uploading, setUploading] = useState(false),
    [emoji, setEmoji] = useState(false),
    [reaction, setReaction] = useState<number | null>(null),
    [search, setSearch] = useState(""),
    [searching, setSearching] = useState(false);
  const bottom = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    nearBottom = useRef(true),
    lastChat = useRef(chat?.id),
    lastTyping = useRef(0),
    chatId = useRef(chat?.id),
    uploadGeneration = useRef(0);
  chatId.current = chat?.id;
  useEffect(() => {
    setText("");
    setReply(null);
    setAttachment(null);
    setEmoji(false);
    setSearch("");
    setSearching(false);
    setReaction(null);
    setUploading(false);
    ++uploadGeneration.current;
    nearBottom.current = true;
    lastChat.current = chat?.id;
  }, [chat?.id]);
  useEffect(() => {
    if (nearBottom.current)
      bottom.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length, chat?.id, loading, Object.keys(typing).length]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        setSearching((v) => !v);
      }
      if (e.key === "Escape") {
        setReply(null);
        setEmoji(false);
        setReaction(null);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify("Files must be 10 MB or smaller.");
      return;
    }
    const generation = ++uploadGeneration.current;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const a = await api<Attachment>("/attachments", "POST", form);
      if (generation === uploadGeneration.current) setAttachment(a);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      if (generation === uploadGeneration.current) setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function submit() {
    if ((!text.trim() && !attachment) || uploading) return;
    void send(text, attachment, reply);
    setText("");
    setReply(null);
    setAttachment(null);
    setEmoji(false);
    nearBottom.current = true;
    input.current?.focus();
  }
  async function react(mid: number, value: string) {
    try {
      await api(`/messages/${mid}/reaction`, "POST", { emoji: value });
      setReaction(null);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (!chat)
    return (
      <section className="chat-pane empty-chat">
        <SignalMark size={100} />
        <h1>Keep your people close.</h1>
        <p>Select a conversation or start a new one.</p>
        <span className="empty-shortcut">
          <kbd>Alt</kbd> + <kbd>N</kbd> New message
        </span>
        <div className="empty-privacy">
          <LockKeyhole size={14} />
          Assignment demo · Encryption simulated
        </div>
      </section>
    );
  const name = chatName(chat, user.id),
    other = chat.members.find((m) => m.id !== user.id),
    typingNames = Object.values(typing)
      .filter((x) => x.until > Date.now())
      .map((x) => x.name.split(" ")[0]);
  const filtered = search
    ? messages.filter((m) =>
        m.body.toLowerCase().includes(search.toLowerCase()),
      )
    : messages;
  return (
    <section className="chat-pane">
      <header className="chat-header">
        <IconButton
          label="Back to conversations"
          className="mobile-back"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </IconButton>
        <button className="chat-person" onClick={onDetails}>
          <Avatar
            name={name}
            color={chatAvatar(chat, user.id)}
            group={chat.kind === "group"}
            size={42}
          />
          <span>
            <b>{name}</b>
            <small>
              {chat.kind === "group" ? (
                `${chat.members.length} members`
              ) : other?.online ? (
                <>
                  <i className="online-dot" />
                  Online
                </>
              ) : (
                `Last seen ${other ? timeLabel(other.last_seen) : "recently"}`
              )}
            </small>
          </span>
        </button>
        <div className="header-actions">
          <IconButton
            label="Start video call"
            onClick={() => notify("Video calls · Coming soon")}
          >
            <Video size={22} />
          </IconButton>
          <IconButton
            label="Start voice call"
            onClick={() => notify("Voice calls · Coming soon")}
          >
            <Phone size={20} />
          </IconButton>
          <span className="header-divider" />
          <IconButton
            label="Search this conversation"
            active={searching}
            onClick={() => setSearching((v) => !v)}
          >
            <Search size={21} />
          </IconButton>
          <IconButton label="Conversation details" onClick={onDetails}>
            <MoreVertical size={22} />
          </IconButton>
        </div>
      </header>
      {searching && (
        <div className="chat-search">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Search loaded messages"
            aria-label="Search messages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{search ? `${filtered.length} results` : ""}</span>
          <IconButton
            label="Close message search"
            onClick={() => {
              setSearching(false);
              setSearch("");
            }}
          >
            <X size={17} />
          </IconButton>
        </div>
      )}
      {!connected && (
        <div className="connection-banner" role="status" aria-live="polite">
          <LoaderCircle size={14} className="spin" />
          Reconnecting… messages remain saved.
        </div>
      )}
      <div
        className="message-scroll"
        ref={scroller}
        onScroll={() => {
          const e = scroller.current;
          nearBottom.current =
            !!e && e.scrollHeight - e.scrollTop - e.clientHeight < 120;
        }}
      >
        <div className="message-content">
          <div className="conversation-start">
            <LockKeyhole size={13} />
            <span>This is a demo conversation. Encryption is simulated.</span>
          </div>
          {chat.disappear_seconds > 0 && (
            <div className="timer-notice">
              <Timer size={13} />
              New messages disappear{" "}
              {chat.disappear_seconds < 60
                ? `${chat.disappear_seconds} seconds`
                : `${Math.round(chat.disappear_seconds / 60)} minutes`}{" "}
              after sending.
            </div>
          )}
          {hasMore && (
            <button className="load-older" onClick={() => void loadOlder()}>
              Load earlier messages
            </button>
          )}
          {loading ? (
            <div className="loading-messages">
              <LoaderCircle className="spin" size={24} />
              <span>Loading messages…</span>
            </div>
          ) : loadError ? (
            <div className="message-error" role="alert">
              <AlertCircle size={26} />
              <h2>Couldn’t load this conversation</h2>
              <p>{loadError}</p>
              <button className="secondary" onClick={() => void retryMessages()}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="start-message">
              <Avatar
                name={name}
                color={chatAvatar(chat, user.id)}
                group={chat.kind === "group"}
                size={72}
              />
              <h2>{search ? "No messages found" : name}</h2>
              <p>
                {search
                  ? "Try another search."
                  : "This is the beginning of your conversation. Say hello."}
              </p>
            </div>
          ) : (
            filtered.map((m, index) => {
              const mine = m.sender_id === user.id,
                sender = chat.members.find((u) => u.id === m.sender_id),
                prev = filtered[index - 1],
                next = filtered[index + 1],
                day = new Date(m.created_at).toDateString(),
                showDate =
                  !prev || new Date(prev.created_at).toDateString() !== day,
                grouped =
                  prev &&
                  prev.sender_id === m.sender_id &&
                  !showDate &&
                  m.created_at - prev.created_at < 180000,
                tail = !next || next.sender_id !== m.sender_id;
              return (
                <div key={m.client_id || m.id}>
                  {showDate && (
                    <div className="date-divider">
                      <span>
                        {day === new Date().toDateString()
                          ? "Today"
                          : new Date(m.created_at).toLocaleDateString([], {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                      </span>
                    </div>
                  )}
                  <div
                    className={`message-row ${mine ? "outgoing" : "incoming"} ${grouped ? "grouped" : ""}`}
                  >
                    <div
                      className={`bubble ${tail ? "tail" : ""} ${m.status === "failed" ? "failed-bubble" : ""}`}
                    >
                      {!mine && chat.kind === "group" && !grouped && (
                        <b className="sender-name">
                          {sender?.display_name || "Former member"}
                        </b>
                      )}
                      {m.reply && (
                        <div className="quoted-message">
                          <b>{m.reply.display_name}</b>
                          <span>{m.reply.body || "Attachment"}</span>
                        </div>
                      )}
                      {m.attachment && (
                        <AttachmentView
                          attachment={m.attachment}
                          notify={notify}
                        />
                      )}
                      <div className="message-text">{m.body}</div>
                      <div className="message-meta">
                        {m.expires_at && <Timer size={12} />}
                        <time dateTime={new Date(m.created_at).toISOString()}>
                          {timeLabel(m.created_at)}
                        </time>
                        {mine && <ReceiptIcon status={m.status} />}
                      </div>
                      {m.reactions.length > 0 && (
                        <div className="message-reactions">
                          {Array.from(
                            new Set(m.reactions.map((r) => r.emoji)),
                          ).map((r) => (
                            <button
                              key={r}
                              title="Toggle reaction"
                              className={
                                m.reactions.some(
                                  (x) => x.user_id === user.id && x.emoji === r,
                                )
                                  ? "own-reaction"
                                  : ""
                              }
                              onClick={() => void react(m.id, r)}
                            >
                              {r}
                              <small>
                                {
                                  m.reactions.filter((x) => x.emoji === r)
                                    .length
                                }
                              </small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.id > 0 && (
                      <div className="message-actions">
                        <IconButton
                          label="React to message"
                          onClick={() =>
                            setReaction(reaction === m.id ? null : m.id)
                          }
                        >
                          <Smile size={17} />
                        </IconButton>
                        <IconButton
                          label="Reply to message"
                          onClick={() => {
                            setReply(m);
                            input.current?.focus();
                          }}
                        >
                          <Reply size={17} />
                        </IconButton>
                      </div>
                    )}
                    {reaction === m.id && (
                      <div className="reaction-picker">
                        {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((e) => (
                          <button key={e} onClick={() => void react(m.id, e)}>
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                    {mine && m.status === "failed" && (
                      <button
                        className="retry-message"
                        onClick={() => void send(m.body, m.attachment, null, m)}
                      >
                        Not sent. Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {typingNames.length > 0 && (
            <div className="typing-indicator" role="status" aria-live="polite">
              <span>
                <i />
                <i />
                <i />
              </span>
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"}{" "}
              typing
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="composer-area">
        {reply && (
          <div className="reply-preview">
            <Reply size={19} />
            <span>
              <b>
                Reply to{" "}
                {chat.members.find((u) => u.id === reply.sender_id)
                  ?.display_name || "message"}
              </b>
              <small>{reply.body || "Attachment"}</small>
            </span>
            <IconButton label="Cancel reply" onClick={() => setReply(null)}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        {(attachment || uploading) && (
          <div className="attachment-preview">
            <FileText size={19} />
            <span>{uploading ? "Uploading…" : attachment?.name}</span>
            <IconButton
              label="Remove attachment"
              onClick={() => setAttachment(null)}
            >
              <X size={17} />
            </IconButton>
          </div>
        )}
        {emoji && (
          <div className="emoji-picker">
            {[
              "😀",
              "😊",
              "❤️",
              "👍",
              "🎉",
              "☕",
              "🌿",
              "🥾",
              "😂",
              "🙏",
              "✨",
              "🙌",
              "👀",
              "💙",
              "🔥",
              "💯",
            ].map((e) => (
              <button
                key={e}
                onClick={() => {
                  setText((t) => t + e);
                  input.current?.focus();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="composer">
          <IconButton
            label="Attach a file"
            onClick={() => fileInput.current?.click()}
          >
            <Plus size={24} />
          </IconButton>
          <input
            type="file"
            ref={fileInput}
            hidden
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <div className="composer-input">
            <textarea
              ref={input}
              rows={1}
              aria-label="Message"
              placeholder={`Message ${chat.kind === "group" ? "the group" : name.split(" ")[0]}`}
              value={text}
              maxLength={10000}
              onChange={(e) => {
                setText(e.target.value);
                if (Date.now() - lastTyping.current > 1000) {
                  sendTyping(true);
                  lastTyping.current = Date.now();
                }
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <IconButton
              label="Choose emoji"
              active={emoji}
              onClick={() => setEmoji((v) => !v)}
            >
              <Smile size={22} />
            </IconButton>
          </div>
          <button
            className="send-button"
            aria-label="Send message"
            disabled={(!text.trim() && !attachment) || uploading}
            onClick={submit}
          >
            <Send size={20} />
          </button>
        </div>
        <div className="composer-hint">
          Enter to send <span>·</span> Shift + Enter for a new line
        </div>
      </div>
    </section>
  );
}
