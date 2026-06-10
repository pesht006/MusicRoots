// Endpoint of the Cloudflare submissions Worker (no trailing slash) and the
// public Turnstile site key. Both are injected at build time; until they are
// configured the submission forms show a friendly "not yet wired" notice.
export const SUBMIT_URL = (import.meta.env.VITE_SUBMIT_URL || "").replace(/\/$/, "");
export const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || "";
export const SUBMISSIONS_ENABLED = Boolean(SUBMIT_URL);

export async function submit(payload: {
  name: string;
  type: "artist" | "error";
  artist?: string;
  token: string;
}): Promise<{ ok?: boolean; dedup?: boolean; remaining?: number; error?: string }> {
  const res = await fetch(`${SUBMIT_URL}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
