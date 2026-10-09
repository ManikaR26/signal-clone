"use client";
import { useEffect, useState, useCallback } from "react";
import { api, sessionToken } from "@/lib/api";
import { User } from "@/lib/types";
import Auth from "@/components/Auth";
import Messenger from "@/components/Messenger";
import { SignalMark } from "@/components/ui";
export default function Page() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const expired = useCallback(() => {
    localStorage.removeItem("signal_token");
    setUser(null);
  }, []);
  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      if (sessionToken()) setUser(await api<User>("/auth/me"));
    } catch (e) {
      if (sessionToken()) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [load, expired]);
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      expired();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <main className="loading-screen">
        <SignalMark size={62} />
        <p>Opening Signal…</p>
      </main>
    );
  if (error && !user)
    return (
      <main className="loading-screen">
        <SignalMark size={62} />
        <h2>Couldn’t connect</h2>
        <p>{error}</p>
        <button className="primary" onClick={() => void load()}>
          Try again
        </button>
        <button
          className="text-button"
          onClick={() => {
            expired();
            setError("");
          }}
        >
          Return to sign in
        </button>
      </main>
    );
  return user ? (
    <Messenger
      user={user}
      onUser={setUser}
      onLogout={() => void logout()}
      onExpired={expired}
    />
  ) : (
    <Auth onLogin={setUser} />
  );
}
