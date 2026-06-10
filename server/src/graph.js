import { db } from "./db.js";

export function rowToArtist(r) {
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    type: r.type,
    bio: r.bio,
    activeFrom: r.active_from,
    activeTo: r.active_to,
    country: r.country,
    tags: r.tags ? r.tags.split(",").filter(Boolean) : [],
    image: r.image_url || "",
    wiki: r.wiki || "",
  };
}

const getArtistBySlug = db.prepare("SELECT * FROM artists WHERE slug = ?");
const getArtistById = db.prepare("SELECT * FROM artists WHERE id = ?");

// Edges where this artist is the influenced one (its roots / ancestors).
const rootsOf = db.prepare(`
  SELECT i.id AS influence_id, i.description, a.* FROM influences i
  JOIN artists a ON a.id = i.influenced_by_id
  WHERE i.artist_id = ? AND i.status = 'approved'
`);

// Edges where this artist is the influencer (its descendants / heirs).
const heirsOf = db.prepare(`
  SELECT i.id AS influence_id, i.description, a.* FROM influences i
  JOIN artists a ON a.id = i.artist_id
  WHERE i.influenced_by_id = ? AND i.status = 'approved'
`);

const sourcesOf = db.prepare("SELECT * FROM sources WHERE influence_id = ?");

export function sourcesForInfluence(influenceId) {
  return sourcesOf.all(influenceId).map((s) => ({
    id: s.id,
    type: s.type,
    citation: s.citation,
    url: s.url,
    author: s.author,
    year: s.year,
  }));
}

// Confidence: weighted by number and type of sources.
const SOURCE_WEIGHT = {
  interview: 3, autobiography: 3, documentary: 2,
  encyclopedia: 2, official: 2, other: 1,
};
export function confidence(sources) {
  const score = sources.reduce((acc, s) => acc + (SOURCE_WEIGHT[s.type] || 1), 0);
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function getArtistDetail(slug) {
  const row = getArtistBySlug.get(slug);
  if (!row) return null;
  const artist = rowToArtist(row);

  const roots = rootsOf.all(row.id).map((r) => {
    const sources = sourcesForInfluence(r.influence_id);
    return {
      influenceId: r.influence_id,
      description: r.description,
      confidence: confidence(sources),
      sources,
      artist: rowToArtist(r),
    };
  });

  const heirs = heirsOf.all(row.id).map((r) => {
    const sources = sourcesForInfluence(r.influence_id);
    return {
      influenceId: r.influence_id,
      description: r.description,
      confidence: confidence(sources),
      sources,
      artist: rowToArtist(r),
    };
  });

  return { ...artist, roots, heirs };
}

// BFS subgraph around a focus artist: `depth` levels of roots (downstream)
// and `depth` levels of heirs (upstream). Returns nodes + directed edges
// (edge.from -> edge.to means "from draws influence from to").
export function getSubgraph(focusSlug, depth = 2) {
  const focus = getArtistBySlug.get(focusSlug);
  if (!focus) return null;

  const nodes = new Map();
  const edges = new Map();

  const addNode = (row, level) => {
    if (!nodes.has(row.id)) {
      nodes.set(row.id, { ...rowToArtist(row), level });
    } else {
      const existing = nodes.get(row.id);
      if (Math.abs(level) < Math.abs(existing.level)) existing.level = level;
    }
  };

  const addEdge = (fromId, toId, influenceId, description) => {
    const key = `${fromId}->${toId}`;
    if (edges.has(key)) return;
    const sources = sourcesForInfluence(influenceId);
    edges.set(key, {
      id: influenceId,
      from: fromId,
      to: toId,
      description,
      confidence: confidence(sources),
      sourceCount: sources.length,
    });
  };

  addNode(focus, 0);

  // Walk towards roots: focus -> root (negative levels, ancestors).
  let frontier = [focus.id];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const id of frontier) {
      for (const r of rootsOf.all(id)) {
        addNode(r, -d);
        addEdge(id, r.id, r.influence_id, r.description);
        next.push(r.id);
      }
    }
    frontier = next;
  }

  // Walk towards heirs: heir -> focus (positive levels, descendants).
  frontier = [focus.id];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const id of frontier) {
      for (const r of heirsOf.all(id)) {
        addNode(r, d);
        addEdge(r.id, id, r.influence_id, r.description);
        next.push(r.id);
      }
    }
    frontier = next;
  }

  return {
    focus: rowToArtist(focus),
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}

export { getArtistBySlug, getArtistById };
