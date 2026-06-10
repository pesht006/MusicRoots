// MusicRoots — guest submissions Worker.
//
// Routes:
//   GET  /              → health check
//   POST /submit        → { name, token, type?: "artist"|"error", artist? }
//   GET  /admin?token=… → plain-text dump of a day's submissions (the "TXT file")
//
// Storage (Cloudflare KV, binding SUBMISSIONS):
//   count:<YYYY-MM-DD>            → number of accepted submissions that day
//   list:<YYYY-MM-DD>:artist      → JSON array of { name, ts }
//   list:<YYYY-MM-DD>:error       → JSON array of { name, ts, artist }

const TURNSTILE_VERIFY =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const KEEP_TTL = 60 * 60 * 24 * 45; // keep daily data ~45 days

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function verifyTurnstile(secret, token, ip) {
  // If no secret configured (e.g. local/demo), skip verification.
  if (!secret) return true;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token || "");
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch(TURNSTILE_VERIFY, { method: "POST", body: form });
    const j = await r.json();
    return j.success === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const baseHeaders = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: baseHeaders });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({ ok: true, service: "musicroots-submissions" }, 200, baseHeaders);
    }

    // ---- Submit ----
    if (url.pathname === "/submit" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Некорректный запрос" }, 400, baseHeaders);
      }

      const name = (body.name || "").toString().trim().replace(/\s+/g, " ");
      const type = body.type === "error" ? "error" : "artist";
      const minLen = type === "error" ? 5 : 2;
      if (name.length < minLen || name.length > 400) {
        return json({ error: "Заполните поле корректно" }, 400, baseHeaders);
      }

      const ip = request.headers.get("CF-Connecting-IP");
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET, body.token, ip);
      if (!ok) return json({ error: "Капча не пройдена" }, 403, baseHeaders);

      const day = todayUTC();
      const limit = parseInt(env.DAILY_LIMIT || "500", 10);
      const countKey = `count:${day}`;
      const count = parseInt((await env.SUBMISSIONS.get(countKey)) || "0", 10);
      if (count >= limit) {
        return json({ error: "Лимит заявок на сегодня исчерпан" }, 429, baseHeaders);
      }

      const listKey = `list:${day}:${type}`;
      const raw = await env.SUBMISSIONS.get(listKey);
      const list = raw ? JSON.parse(raw) : [];

      // Dedup artist names within the same day.
      if (type === "artist") {
        const norm = name.toLowerCase();
        if (list.some((e) => e.name.toLowerCase() === norm)) {
          return json({ ok: true, dedup: true }, 200, baseHeaders);
        }
      }

      const entry = { name, ts: new Date().toISOString() };
      if (type === "error" && body.artist) entry.artist = String(body.artist).slice(0, 120);
      list.push(entry);

      await env.SUBMISSIONS.put(listKey, JSON.stringify(list), { expirationTtl: KEEP_TTL });
      await env.SUBMISSIONS.put(countKey, String(count + 1), { expirationTtl: KEEP_TTL });

      return json({ ok: true, remaining: Math.max(0, limit - (count + 1)) }, 200, baseHeaders);
    }

    // ---- Admin dump (plain text) ----
    if (url.pathname === "/admin" && request.method === "GET") {
      const token = url.searchParams.get("token");
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response("forbidden", { status: 403 });
      }
      const day = url.searchParams.get("day") || todayUTC();
      const artists = JSON.parse((await env.SUBMISSIONS.get(`list:${day}:artist`)) || "[]");
      const errors = JSON.parse((await env.SUBMISSIONS.get(`list:${day}:error`)) || "[]");

      let out = `# MusicRoots — заявки за ${day} (UTC)\n\n`;
      out += `## Исполнители (${artists.length})\n`;
      out += artists.map((e) => e.name).join("\n");
      out += `\n\n## Сообщения об ошибках (${errors.length})\n`;
      out += errors
        .map((e) => `- ${e.artist ? "[" + e.artist + "] " : ""}${e.name}`)
        .join("\n");
      out += "\n";

      return new Response(out, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return json({ error: "not found" }, 404, baseHeaders);
  },
};
