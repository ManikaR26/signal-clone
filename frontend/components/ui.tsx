"use client";
import { useEffect, useRef } from "react";
import { X, Users } from "lucide-react";
export function Avatar({
  name,
  color = "blue",
  size = 44,
  group = false,
}: {
  name: string;
  color?: string;
  size?: number;
  group?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${color.startsWith("data:") ? "blue" : color}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {color.startsWith("data:") ? (
        <img src={color} alt="" />
      ) : group ? (
        <Users size={size * 0.47} />
      ) : (
        name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
export function SignalMark({ size = 42 }: { size?: number }) {
  return (
    <span
      className="signal-mark"
      style={{ width: size, height: size }}
      aria-label="Signal logo"
      role="img"
    >
      <svg
        viewBox="0 0 48 48"
        width={size * 0.64}
        height={size * 0.64}
        aria-hidden="true"
      >
        <path
          d="M24 5C13.5 5 5 12.5 5 22c0 5.7 3 10.8 7.7 13.9L10.5 42l7.1-3.3c2 .8 4.1 1.3 6.4 1.3 10.5 0 19-7.5 19-18S34.5 5 24 5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`icon-button ${active ? "active" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h2>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
export function timeLabel(t: number) {
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function listTime(t: number) {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? timeLabel(t)
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
