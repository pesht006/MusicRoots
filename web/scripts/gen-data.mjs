// Generates a static snapshot of the seed data for the in-browser (GitHub Pages)
// build, so the site works without the Node/SQLite backend.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { artists, influences } from "../../server/src/seed-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "src", "data");
const outFile = join(outDir, "seed.json");

const idBySlug = new Map();
const outArtists = artists.map((a, i) => {
  const id = i + 1;
  idBySlug.set(a.slug, id);
  return {
    id,
    slug: a.slug,
    name: a.name,
    type: a.type,
    bio: a.bio ?? "",
    activeFrom: a.active_from ?? null,
    activeTo: a.active_to ?? null,
    country: a.country ?? "",
    tags: Array.isArray(a.tags) ? a.tags : a.tags ? String(a.tags).split(",") : [],
    image: a.image ?? "",
    wiki: a.wiki ?? "",
  };
});

let srcId = 0;
const outInfluences = influences.map((e, i) => ({
  id: i + 1,
  artistId: idBySlug.get(e.artist),
  influencedById: idBySlug.get(e.influenced_by),
  description: e.description ?? "",
  sources: (e.sources ?? []).map((s) => ({
    id: ++srcId,
    type: s.type,
    citation: s.citation,
    url: s.url ?? "",
    author: s.author ?? "",
    year: s.year ?? null,
  })),
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ artists: outArtists, influences: outInfluences }, null, 0)
);
console.log(
  `Wrote ${outFile}: ${outArtists.length} artists, ${outInfluences.length} influences.`
);
