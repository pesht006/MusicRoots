// In-browser implementation of the MusicRoots API for the static (GitHub Pages)
// build. Mirrors server/src/graph.js + the contributions endpoints, using a
// bundled data snapshot and localStorage for the moderation queue.
import seed from "./data/seed.json";
import type {
  Artist, ArtistDetail, Confidence, Contribution, Graph, GraphEdge,
  GraphNode, InfluenceLink, Source, Stats,
} from "./api";

interface RawInfluence {
  id: number;
  artistId: number;
  influencedById: number;
  description: string;
  sources: Source[];
}

const artists: Artist[] = JSON.parse(JSON.stringify(seed.artists));
const influences: RawInfluence[] = JSON.parse(JSON.stringify(seed.influences));

const bySlug = new Map(artists.map((a) => [a.slug, a]));
const byId = new Map(artists.map((a) => [a.id, a]));
let nextInfluenceId = Math.max(0, ...influences.map((i) => i.id)) + 1;
let nextSourceId =
  Math.max(0, ...influences.flatMap((i) => i.sources.map((s) => s.id))) + 1;

const SOURCE_WEIGHT: Record<string, number> = {
  interview: 3, autobiography: 3, documentary: 2,
  encyclopedia: 2, official: 2, other: 1,
};
function confidence(sources: Source[]): Confidence {
  const score = sources.reduce((a, s) => a + (SOURCE_WEIGHT[s.type] || 1), 0);
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

// ---- contributions in localStorage ----
const LS_KEY = "musicroots_contributions";
function loadContribs(): Contribution[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveContribs(list: Contribution[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function applyContribution(c: Contribution) {
  const p = c.payload as Record<string, any>;
  if (c.kind === "new_influence") {
    const a = bySlug.get(p.artistSlug);
    const b = bySlug.get(p.influencedBySlug);
    if (!a || !b) return;
    let inf = influences.find((i) => i.artistId === a.id && i.influencedById === b.id);
    if (!inf) {
      inf = {
        id: nextInfluenceId++,
        artistId: a.id,
        influencedById: b.id,
        description: p.description || "",
        sources: [],
      };
      influences.push(inf);
    }
    if (p.source) inf.sources.push({ id: nextSourceId++, ...normalizeSource(p.source) });
  } else if (c.kind === "new_source") {
    const inf = influences.find((i) => i.id === Number(p.influenceId));
    if (inf && p.source) inf.sources.push({ id: nextSourceId++, ...normalizeSource(p.source) });
  }
}

function normalizeSource(s: any): Omit<Source, "id"> {
  return {
    type: s.type,
    citation: s.citation,
    url: s.url || "",
    author: s.author || "",
    year: s.year ?? null,
  };
}

// Re-apply previously approved contributions on load (base data is fresh each time).
for (const c of loadContribs()) {
  if (c.status === "approved") applyContribution(c);
}

function linkFrom(inf: RawInfluence, other: Artist): InfluenceLink {
  return {
    influenceId: inf.id,
    description: inf.description,
    confidence: confidence(inf.sources),
    sources: inf.sources,
    artist: other,
  };
}

function detail(slug: string): ArtistDetail | null {
  const a = bySlug.get(slug);
  if (!a) return null;
  const roots = influences
    .filter((i) => i.artistId === a.id)
    .map((i) => linkFrom(i, byId.get(i.influencedById)!));
  const heirs = influences
    .filter((i) => i.influencedById === a.id)
    .map((i) => linkFrom(i, byId.get(i.artistId)!));
  return { ...a, roots, heirs };
}

function subgraph(focusSlug: string, depth: number): Graph | null {
  const focus = bySlug.get(focusSlug);
  if (!focus) return null;
  const nodes = new Map<number, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const addNode = (a: Artist, level: number) => {
    const ex = nodes.get(a.id);
    if (!ex) nodes.set(a.id, { ...a, level });
    else if (Math.abs(level) < Math.abs(ex.level)) ex.level = level;
  };
  const addEdge = (fromId: number, toId: number, inf: RawInfluence) => {
    const key = `${fromId}->${toId}`;
    if (edges.has(key)) return;
    edges.set(key, {
      id: inf.id, from: fromId, to: toId, description: inf.description,
      confidence: confidence(inf.sources), sourceCount: inf.sources.length,
    });
  };

  addNode(focus, 0);

  let frontier = [focus.id];
  for (let d = 1; d <= depth; d++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const inf of influences.filter((i) => i.artistId === id)) {
        const root = byId.get(inf.influencedById)!;
        addNode(root, -d);
        addEdge(id, root.id, inf);
        next.push(root.id);
      }
    }
    frontier = next;
  }

  frontier = [focus.id];
  for (let d = 1; d <= depth; d++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const inf of influences.filter((i) => i.influencedById === id)) {
        const heir = byId.get(inf.artistId)!;
        addNode(heir, d);
        addEdge(heir.id, id, inf);
        next.push(heir.id);
      }
    }
    frontier = next;
  }

  return { focus, nodes: [...nodes.values()], edges: [...edges.values()] };
}

const wait = <T,>(v: T) => new Promise<T>((res) => setTimeout(() => res(v), 60));

export const staticApi = {
  stats: () =>
    wait<Stats>({
      artists: artists.length,
      influences: influences.length,
      sources: influences.reduce((a, i) => a + i.sources.length, 0),
      pending: loadContribs().filter((c) => c.status === "pending").length,
    }),

  artists: (search = "") => {
    const q = search.trim().toLowerCase();
    const res = artists
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return wait<Artist[]>(res);
  },

  artist: (slug: string) => {
    const d = detail(slug);
    if (!d) return Promise.reject(new Error("Artist not found"));
    return wait<ArtistDetail>(d);
  },

  graph: (focus: string, depth = 2) => {
    const g = subgraph(focus, Math.min(Math.max(depth, 1), 4));
    if (!g) return Promise.reject(new Error("Artist not found"));
    return wait<Graph>(g);
  },

  contributions: (status = "pending") =>
    wait<Contribution[]>(loadContribs().filter((c) => c.status === status)),

  submitContribution: (body: {
    kind: Contribution["kind"];
    payload: Record<string, unknown>;
    submitter?: string;
  }) => {
    if (body.kind === "new_influence") {
      const s = (body.payload as any).source;
      if (!s || !s.type || !s.citation)
        return Promise.reject(new Error("new_influence requires source.type and source.citation"));
    }
    const list = loadContribs();
    const id = Math.max(0, ...list.map((c) => c.id)) + 1;
    const c: Contribution = {
      id, kind: body.kind, payload: body.payload, submitter: body.submitter || "",
      status: "pending", moderatorNote: "", createdAt: new Date().toISOString(), reviewedAt: null,
    };
    list.unshift(c);
    saveContribs(list);
    return wait({ id, status: "pending" });
  },

  approve: (id: number, note = "") => {
    const list = loadContribs();
    const c = list.find((x) => x.id === id);
    if (!c) return Promise.reject(new Error("Not found"));
    c.status = "approved";
    c.moderatorNote = note;
    c.reviewedAt = new Date().toISOString();
    applyContribution(c);
    saveContribs(list);
    return wait({ id, status: "approved" });
  },

  reject: (id: number, note = "") => {
    const list = loadContribs();
    const c = list.find((x) => x.id === id);
    if (!c) return Promise.reject(new Error("Not found"));
    c.status = "rejected";
    c.moderatorNote = note;
    c.reviewedAt = new Date().toISOString();
    saveContribs(list);
    return wait({ id, status: "rejected" });
  },
};
