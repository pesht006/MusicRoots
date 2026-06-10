import { db, initSchema } from "./db.js";
import { artists, influences } from "./seed-data.js";

initSchema();

const reset = db.transaction(() => {
  db.exec(`
    DELETE FROM sources;
    DELETE FROM influences;
    DELETE FROM contributions;
    DELETE FROM artists;
    DELETE FROM sqlite_sequence WHERE name IN
      ('sources','influences','contributions','artists');
  `);

  const insArtist = db.prepare(`
    INSERT INTO artists (slug, name, type, bio, active_from, active_to, country, tags, image_url, wiki)
    VALUES (@slug, @name, @type, @bio, @active_from, @active_to, @country, @tags, @image_url, @wiki)
  `);
  const idBySlug = new Map();
  for (const a of artists) {
    const info = insArtist.run({
      slug: a.slug,
      name: a.name,
      type: a.type,
      bio: a.bio ?? "",
      active_from: a.active_from ?? null,
      active_to: a.active_to ?? null,
      country: a.country ?? "",
      tags: Array.isArray(a.tags) ? a.tags.join(",") : a.tags ?? "",
      image_url: a.image ?? "",
      wiki: a.wiki ?? "",
    });
    idBySlug.set(a.slug, info.lastInsertRowid);
  }

  const insInf = db.prepare(`
    INSERT INTO influences (artist_id, influenced_by_id, description, status)
    VALUES (?, ?, ?, 'approved')
  `);
  const insSrc = db.prepare(`
    INSERT INTO sources (influence_id, type, citation, url, author, year)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const e of influences) {
    const aId = idBySlug.get(e.artist);
    const bId = idBySlug.get(e.influenced_by);
    if (!aId || !bId) {
      throw new Error(`Unknown artist in edge: ${e.artist} <- ${e.influenced_by}`);
    }
    const info = insInf.run(aId, bId, e.description ?? "");
    for (const s of e.sources ?? []) {
      insSrc.run(info.lastInsertRowid, s.type, s.citation, s.url ?? "", s.author ?? "", s.year ?? null);
    }
  }
});

reset();

const counts = {
  artists: db.prepare("SELECT COUNT(*) c FROM artists").get().c,
  influences: db.prepare("SELECT COUNT(*) c FROM influences").get().c,
  sources: db.prepare("SELECT COUNT(*) c FROM sources").get().c,
};
console.log("MusicRoots seeded:", counts);
