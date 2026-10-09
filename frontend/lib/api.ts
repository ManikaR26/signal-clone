export const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "")
).replace(/\/$/, "");
export function sessionToken() {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("signal_token") || "";
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionToken()}`,
      ...(!form ? { "Content-Type": "application/json" } : {}),
    },
    body:
      body === undefined
        ? undefined
        : form
          ? (body as FormData)
          : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = "The server could not complete this request.";
    }
    if (res.status === 401 && path != "/auth/login") {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((x: { msg: string }) => x.msg).join(" ")
          : "Something went wrong. Please try again.",
    );
  }
  return res.json();
}
export async function fileBlob(id: string) {
  const r = await fetch(`${API}/api/attachments/${id}`, {
    headers: { Authorization: `Bearer ${sessionToken()}` },
  });
  if (!r.ok) throw new Error("Unable to download this attachment.");
  return r.blob();
}
