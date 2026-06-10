import { test } from "node:test";
import assert from "node:assert/strict";
import { artists, influences } from "../src/seed-data.js";

const VALID_SOURCE_TYPES = new Set([
  "interview", "autobiography", "encyclopedia",
  "documentary", "official", "other",
]);

test("artist slugs are unique", () => {
  const slugs = artists.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("artist type is valid", () => {
  for (const a of artists) {
    assert.ok(a.type === "artist" || a.type === "band", `bad type for ${a.slug}`);
  }
});

test("every influence references existing artists", () => {
  const known = new Set(artists.map((a) => a.slug));
  for (const e of influences) {
    assert.ok(known.has(e.artist), `unknown artist: ${e.artist}`);
    assert.ok(known.has(e.influenced_by), `unknown influence: ${e.influenced_by}`);
    assert.notEqual(e.artist, e.influenced_by, `self-loop on ${e.artist}`);
  }
});

test("every influence carries at least one valid source", () => {
  for (const e of influences) {
    assert.ok(Array.isArray(e.sources) && e.sources.length > 0,
      `no source for ${e.artist} <- ${e.influenced_by}`);
    for (const s of e.sources) {
      assert.ok(VALID_SOURCE_TYPES.has(s.type), `bad source type: ${s.type}`);
      assert.ok(s.citation && s.citation.length > 0, "empty citation");
    }
  }
});

test("influence edges are unique", () => {
  const keys = influences.map((e) => `${e.artist}<-${e.influenced_by}`);
  assert.equal(new Set(keys).size, keys.length);
});
