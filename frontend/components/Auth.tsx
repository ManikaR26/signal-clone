"use client";
import { useState } from "react";
import { ArrowLeft, LockKeyhole, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Avatar, SignalMark } from "./ui";
export default function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [step, setStep] = useState(0),
    [username, setUsername] = useState(""),
    [display, setDisplay] = useState(""),
    [otp, setOtp] = useState(""),
    [avatar, setAvatar] = useState("blue"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(name = username, code = otp) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string; user: User }>(
        "/auth/login",
        "POST",
        { username: name, otp: code, display_name: display, avatar },
      );
      localStorage.setItem("signal_token", result.token);
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <div className="auth-brand">
        <SignalMark size={35} />
        <b>Signal</b>
        <span>Messenger</span>
      </div>
      <div className="auth-card">
        <SignalMark size={72} />
        <h1>
          Your conversations.
          <br />
          Your people.
        </h1>
        <p className="auth-subtitle">A little closer, wherever you are.</p>
        {step === 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(1);
              setError("");
            }}
          >
            <label>
              Username or phone number
              <input
                autoFocus
                autoComplete="username"
                required
                minLength={3}
                maxLength={40}
                placeholder="e.g. alex or +919876543210"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[A-Za-z0-9_+.\-]{3,40}"
              />
            </label>
            <label>
              Display name <span className="muted">· for new accounts</span>
              <input
                autoComplete="name"
                placeholder="How people will see you"
                maxLength={60}
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
              />
            </label>
            <p className="helper">
              Use any username or phone number. A display name is required only
              when creating a new account.
            </p>
            <div className="avatar-picker">
              <Avatar
                name={display || username || "You"}
                color={avatar}
                size={42}
              />
              {["blue", "rose", "green", "purple", "amber", "teal"].map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`Choose ${c} avatar`}
                  aria-pressed={avatar === c}
                  onClick={() => setAvatar(c)}
                  className={`color-dot avatar-${c} ${avatar === c ? "selected" : ""}`}
                />
              ))}
            </div>
            <button className="primary" type="submit">
              Continue <ChevronRight size={18} />
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <button
              type="button"
              className="text-button back-auth"
              onClick={() => setStep(0)}
            >
              <ArrowLeft size={16} /> {username}
            </button>
            <label>
              Enter verification code
              <input
                autoFocus
                autoComplete="one-time-code"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="otp-input"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </label>
            <p className="helper">
              Demo code: <b>123456</b>. No SMS will be sent.
            </p>
            <button disabled={busy} className="primary" type="submit">
              {busy ? "Signing in…" : "Open Signal"}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="demo-divider">
          <span>or explore a demo account</span>
        </div>
        <div className="demo-users">
          {[
            { username: "alex", name: "Alex Morgan", color: "blue" },
            { username: "maya", name: "Maya Chen", color: "rose" },
            { username: "jordan", name: "Jordan Lee", color: "green" },
          ].map((u) => (
            <button
              type="button"
              disabled={busy}
              key={u.username}
              onClick={() => void login(u.username, "123456")}
            >
              <Avatar name={u.name} color={u.color} size={38} />
              <span>{u.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        <p className="demo-hint">
          Open a second browser or private window to chat between accounts.
        </p>
      </div>
      <footer className="auth-footer">
        <LockKeyhole size={14} />
        <span>
          Independent assignment demo · Mock verification · No end-to-end
          encryption
        </span>
      </footer>
    </main>
  );
}
