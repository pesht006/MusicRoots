// Endpoint of the Cloudflare submissions Worker (no trailing slash) and the
// public captcha site key. Injected at build time; until configured the
// submission forms show a friendly "not yet wired" notice.
export const SUBMIT_URL = (import.meta.env.VITE_SUBMIT_URL || "").replace(/\/$/, "");

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY || "";
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || "";

// hCaptcha (visible image/"mosaic" challenge) takes precedence if configured.
export const CAPTCHA_PROVIDER: "hcaptcha" | "turnstile" | "none" =
  HCAPTCHA_SITEKEY ? "hcaptcha" : TURNSTILE_SITEKEY ? "turnstile" : "none";
export const CAPTCHA_SITEKEY = HCAPTCHA_SITEKEY || TURNSTILE_SITEKEY || "";

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
