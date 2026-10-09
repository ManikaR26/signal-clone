"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, API, sessionToken } from "./api";
import { User, Conversation, Message, Attachment } from "./types";
export function useMessenger(user: User, onExpired: () => void) {
  const [chats, setChats] = useState<Conversation[]>([]),
    [contacts, setContacts] = useState<User[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [connected, setConnected] = useState(false),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [toast, setToast] = useState(""),
    [typing, setTyping] = useState<
      Record<number, { name: string; until: number }>
    >({}),
    [hasMore, setHasMore] = useState(false);
  const selectedRef = useRef(selected),
    socket = useRef<WebSocket | null>(null),
    refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    loadVersion = useRef(0);
  selectedRef.current = selected;
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const refresh = useCallback(async () => {
    const [cs, co] = await Promise.all([
      api<Conversation[]>("/conversations"),
      api<User[]>("/contacts"),
    ]);
    setChats(cs);
    setContacts(co);
    if (selectedRef.current && !cs.some((c) => c.id === selectedRef.current)) {
      setSelected(null);
      setMessages([]);
    }
  }, []);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(
      () => void refresh().catch((e) => notify(e.message)),
      100,
    );
  }, [refresh, notify]);
  const acknowledge = useCallback(
    async (ms: Message[], read = false) => {
      const ids = ms
        .filter(
          (m) =>
            m.sender_id !== user.id &&
            m.id > 0 &&
            m.receipts.some(
              (r) =>
                r.user_id === user.id && !(read ? r.read_at : r.delivered_at),
            ),
        )
        .map((m) => m.id);
      if (ids.length)
        await api("/receipts", "POST", {
          message_ids: ids,
          status: read ? "read" : "delivered",
        });
    },
    [user.id],
  );
  const load = useCallback(
    async (cid: number) => {
      const version = ++loadVersion.current;
      setLoading(true);
      setLoadError("");
      try {
        const ms = await api<Message[]>(`/conversations/${cid}/messages`);
        if (version === loadVersion.current && cid === selectedRef.current) {
          setMessages(ms);
          setHasMore(ms.length === 100);
          void acknowledge(ms, document.visibilityState === "visible").catch(
            () => {},
          );
        }
      } catch (e) {
        const message = (e as Error).message;
        setLoadError(message);
        notify(message);
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    },
    [acknowledge, notify],
  );
  const retryMessages = useCallback(
    () => (selected ? load(selected) : Promise.resolve()),
    [load, selected],
  );
  useEffect(() => {
    void refresh().catch((e) => notify(e.message));
  }, [refresh, notify]);
  useEffect(() => {
    setMessages([]);
    setTyping({});
    setHasMore(false);
    setLoadError("");
    if (selected) void load(selected);
    else ++loadVersion.current;
  }, [selected, load]);
  useEffect(() => {
    let disposed = false,
      retry: ReturnType<typeof setTimeout>,
      heartbeat: ReturnType<typeof setInterval>;
    let attempts = 0;
    function connect() {
      if (disposed) return;
      const base = API || window.location.origin;
      const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws`);
      socket.current = ws;
      ws.onopen = () =>
        ws.send(JSON.stringify({ type: "auth", token: sessionToken() }));
      ws.onmessage = (event) => {
        let e;
        try {
          e = JSON.parse(event.data);
        } catch {
          return;
        }
        if (e.type === "connected") {
          // Catch up offline deliveries in bounded batches after every reconnect.
          void (async () => {
            let count = 500;
            while (!disposed && count === 500) {
              const batch = await api<Message[]>("/pending-deliveries");
              count = batch.length;
              await acknowledge(batch);
            }
          })().catch(() => {});
          setConnected(true);
          attempts = 0;
          scheduleRefresh();
          if (selectedRef.current) void load(selectedRef.current);
          heartbeat = setInterval(() => {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
          }, 25000);
        }
        if (e.type === "message") {
          const m = e.message as Message;
          void acknowledge(
            [m],
            m.conversation_id === selectedRef.current &&
              document.visibilityState === "visible",
          ).catch(() => {});
          if (m.conversation_id === selectedRef.current) {
            setMessages((old) =>
              [
                ...old.filter(
                  (x) => x.client_id !== m.client_id && x.id !== m.id,
                ),
                m,
              ].sort((a, b) => a.created_at - b.created_at),
            );
            setTyping((old) => {
              const n = { ...old };
              delete n[m.sender_id];
              return n;
            });
          } else if (
            m.sender_id !== user.id &&
            localStorage.getItem("signal_notifications") !== "off"
          ) {
            notify(
              m.body ? `New message: ${m.body.slice(0, 70)}` : "New attachment",
            );
          }
          scheduleRefresh();
        }
        if (e.type === "receipts") {
          setMessages((old) =>
            old.map(
              (m) => (e.messages as Message[]).find((n) => n.id === m.id) || m,
            ),
          );
          scheduleRefresh();
        }
        if (e.type === "refresh") scheduleRefresh();
        if (e.type === "expired") {
          setMessages((old) => old.filter((m) => m.id !== e.message_id));
          scheduleRefresh();
        }
        if (e.type === "presence") {
          setChats((old) =>
            old.map((c) => ({
              ...c,
              members: c.members.map((m) =>
                m.id === e.user_id
                  ? { ...m, online: e.online, last_seen: e.last_seen }
                  : m,
              ),
            })),
          );
        }
        if (e.type === "typing" && e.conversation_id === selectedRef.current) {
          setTyping((old) => ({
            ...old,
            [e.user_id]: {
              name: e.display_name,
              until: e.active ? Date.now() + 4000 : 0,
            },
          }));
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        clearInterval(heartbeat);
        if (disposed) return;
        if (event.code === 1008) {
          onExpired();
          return;
        }
        retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** attempts++));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    const tick = setInterval(() => {
      setTyping((old) =>
        Object.fromEntries(
          Object.entries(old).filter(([, v]) => v.until > Date.now()),
        ),
      );
      setMessages((old) =>
        old.filter((m) => !m.expires_at || m.expires_at > Date.now()),
      );
    }, 1000);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      clearInterval(tick);
      socket.current?.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [user.id, acknowledge, load, notify, onExpired, scheduleRefresh]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible" && selectedRef.current)
        void load(selectedRef.current);
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [load]);
  function sendTyping(active: boolean) {
    if (socket.current?.readyState === 1 && selected)
      socket.current.send(
        JSON.stringify({ type: "typing", conversation_id: selected, active }),
      );
  }
  async function send(
    body: string,
    attachment?: Attachment | null,
    reply?: Message | null,
    retry?: Message,
  ) {
    const cid = selected;
    if (!cid) return;
    const clientId = retry?.client_id || crypto.randomUUID();
    const local: Message = retry
      ? { ...retry, status: "sending" }
      : {
          id: -Date.now(),
          conversation_id: cid,
          sender_id: user.id,
          body,
          client_id: clientId,
          created_at: Date.now(),
          status: "sending",
          receipts: [],
          reactions: [],
          attachment,
          attachment_id: attachment?.id,
          reply_to: reply?.id,
          reply: reply
            ? {
                id: reply.id,
                body: reply.body,
                display_name:
                  chats
                    .find((c) => c.id === cid)
                    ?.members.find((m) => m.id === reply.sender_id)
                    ?.display_name || "Message",
              }
            : null,
        };
    setMessages((old) => [
      ...old.filter((m) => m.client_id !== clientId),
      local,
    ]);
    sendTyping(false);
    try {
      const result = await api<Message>(
        `/conversations/${cid}/messages`,
        "POST",
        {
          body: local.body,
          client_id: clientId,
          attachment_id: local.attachment_id,
          reply_to: local.reply_to,
        },
      );
      if (selectedRef.current === cid)
        setMessages((old) =>
          [
            ...old.filter(
              (m) => m.client_id !== clientId && m.id !== result.id,
            ),
            old.find((m) => m.id === result.id) || result,
          ].sort((a, b) => a.created_at - b.created_at),
        );
      scheduleRefresh();
    } catch (e) {
      if (selectedRef.current === cid)
        setMessages((old) =>
          old.map((m) =>
            m.client_id === clientId ? { ...m, status: "failed" } : m,
          ),
        );
      notify((e as Error).message);
    }
  }
  async function loadOlder() {
    if (!selected || !messages.length) return;
    try {
      const ms = await api<Message[]>(
        `/conversations/${selected}/messages?before=${messages[0].id}`,
      );
      setMessages((old) => [...ms, ...old]);
      setHasMore(ms.length === 100);
      void acknowledge(ms, true).catch(() => {});
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return {
    chats,
    contacts,
    selected,
    setSelected,
    messages,
    connected,
    loading,
    loadError,
    toast,
    notify,
    typing,
    refresh,
    send,
    sendTyping,
    hasMore,
    loadOlder,
    retryMessages,
  };
}
