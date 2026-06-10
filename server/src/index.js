import express from "express";
import cors from "cors";
import { db, initSchema } from "./db.js";
import {
  rowToArtist,
  getArtistDetail,
  getSubgraph,
  getArtistBySlug,
} from "./graph.js";

initSchema();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/stats", (_req, res) => {
  res.json({
    artists: db.prepare("SELECT COUNT(*) c FROM artists").get().c,
    influences: db.prepare("SELECT COUNT(*) c FROM influences WHERE status='approved'").get().c,
    sources: db.prepare("SELECT COUNT(*) c FROM sources").get().c,
    pending: db.prepare("SELECT COUNT(*) c FROM contributions WHERE status='pending'").get().c,
  });
});

// List / search artists.
app.get("/api/artists", (req, res) => {
  const q = (req.query.search || "").toString().trim();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  let rows;
  if (q) {
    rows = db
      .prepare("SELECT * FROM artists WHERE name LIKE ? ORDER BY name LIMIT ?")
      .all(`%${q}%`, limit);
  } else {
    rows = db.prepare("SELECT * FROM artists ORDER BY name LIMIT ?").all(limit);
  }
  res.json(rows.map(rowToArtist));
});

// Artist detail with roots, heirs and sources.
app.get("/api/artists/:slug", (req, res) => {
  const detail = getArtistDetail(req.params.slug);
  if (!detail) return res.status(404).json({ error: "Artist not found" });
  res.json(detail);
});

// Subgraph around a focus artist for the influence tree.
app.get("/api/graph", (req, res) => {
  const focus = (req.query.focus || "").toString().trim();
  const depth = Math.min(Math.max(parseInt(req.query.depth) || 2, 1), 4);
  if (!focus) return res.status(400).json({ error: "focus (slug) is required" });
  const graph = getSubgraph(focus, depth);
  if (!graph) return res.status(404).json({ error: "Artist not found" });
  res.json(graph);
});

// --- Community contributions & moderation ---

const VALID_KINDS = ["new_influence", "new_source", "error_report", "correction"];

app.post("/api/contributions", (req, res) => {
  const { kind, payload, submitter } = req.body || {};
  if (!VALID_KINDS.includes(kind)) {
    return res.status(400).json({ error: "Invalid kind" });
  }
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "payload object is required" });
  }
  // A proposed new influence must carry at least one source (hard invariant).
  if (kind === "new_influence") {
    const s = payload.source;
    if (!s || !s.type || !s.citation) {
      return res
        .status(400)
        .json({ error: "new_influence requires source.type and source.citation" });
    }
  }
  const info = db
    .prepare(
      "INSERT INTO contributions (kind, payload, submitter) VALUES (?, ?, ?)"
    )
    .run(kind, JSON.stringify(payload), (submitter || "").toString());
  res.status(201).json({ id: info.lastInsertRowid, status: "pending" });
});

app.get("/api/contributions", (req, res) => {
  const status = (req.query.status || "pending").toString();
  const rows = db
    .prepare("SELECT * FROM contributions WHERE status = ? ORDER BY created_at DESC")
    .all(status);
  res.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: JSON.parse(r.payload),
      submitter: r.submitter,
      status: r.status,
      moderatorNote: r.moderator_note,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }))
  );
});

// Apply an approved contribution to the live data.
function applyContribution(c) {
  const p = JSON.parse(c.payload);
  if (c.kind === "new_influence") {
    const a = getArtistBySlug.get(p.artistSlug);
    const b = getArtistBySlug.get(p.influencedBySlug);
    if (!a || !b) throw new Error("Referenced artist not found");
    const inf = db
      .prepare(
        `INSERT INTO influences (artist_id, influenced_by_id, description, status)
         VALUES (?, ?, ?, 'approved')
         ON CONFLICT(artist_id, influenced_by_id)
         DO UPDATE SET status='approved'`
      )
      .run(a.id, b.id, p.description || "");
    let influenceId = inf.lastInsertRowid;
    if (!influenceId) {
      influenceId = db
        .prepare("SELECT id FROM influences WHERE artist_id=? AND influenced_by_id=?")
        .get(a.id, b.id).id;
    }
    if (p.source) {
      db.prepare(
        `INSERT INTO sources (influence_id, type, citation, url, author, year)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(influenceId, p.source.type, p.source.citation, p.source.url || "",
            p.source.author || "", p.source.year || null);
    }
  } else if (c.kind === "new_source") {
    if (!p.influenceId) throw new Error("influenceId required");
    db.prepare(
      `INSERT INTO sources (influence_id, type, citation, url, author, year)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(p.influenceId, p.source.type, p.source.citation, p.source.url || "",
          p.source.author || "", p.source.year || null);
  }
  // error_report and correction are informational: a moderator acts on them
  // manually; approving simply closes the ticket.
}

app.post("/api/contributions/:id/approve", (req, res) => {
  const c = db.prepare("SELECT * FROM contributions WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Not found" });
  if (c.status !== "pending") return res.status(409).json({ error: "Already reviewed" });
  try {
    const tx = db.transaction(() => {
      applyContribution(c);
      db.prepare(
        "UPDATE contributions SET status='approved', moderator_note=?, reviewed_at=datetime('now') WHERE id=?"
      ).run((req.body?.note || "").toString(), c.id);
    });
    tx();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ id: c.id, status: "approved" });
});

app.post("/api/contributions/:id/reject", (req, res) => {
  const c = db.prepare("SELECT * FROM contributions WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Not found" });
  if (c.status !== "pending") return res.status(409).json({ error: "Already reviewed" });
  db.prepare(
    "UPDATE contributions SET status='rejected', moderator_note=?, reviewed_at=datetime('now') WHERE id=?"
  ).run((req.body?.note || "").toString(), c.id);
  res.json({ id: c.id, status: "rejected" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`MusicRoots API listening on http://localhost:${PORT}`);
  });
}

export { app };
