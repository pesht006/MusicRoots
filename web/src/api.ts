import { staticApi } from "./staticApi";

export type ArtistType = "artist" | "band";
export type Confidence = "high" | "medium";
export type SourceType =
  | "interview" | "autobiography" | "encyclopedia"
  | "documentary" | "official" | "other";

export interface Artist {
  id: number;
  slug: string;
  name: string;
  type: ArtistType;
  bio: string;
  activeFrom: number | null;
  activeTo: number | null;
  country: string;
  tags: string[];
  image: string;
  wiki: string;
}

export interface Source {
  id: number;
  type: SourceType;
  citation: string;
  url: string;
  author: string;
  year: number | null;
}

export interface InfluenceLink {
  influenceId: number;
  description: string;
  confidence: Confidence;
  sources: Source[];
  artist: Artist;
}

export interface ArtistDetail extends Artist {
  roots: InfluenceLink[];
  heirs: InfluenceLink[];
}

export interface GraphNode extends Artist {
  level: number;
}

export interface GraphEdge {
  id: number;
  from: number;
  to: number;
  description: string;
  confidence: Confidence;
  sourceCount: number;
}

export interface Graph {
  focus: Artist;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Stats {
  artists: number;
  influences: number;
  sources: number;
  pending: number;
}

export interface Contribution {
  id: number;
  kind: "new_influence" | "new_source" | "error_report" | "correction";
  payload: Record<string, unknown>;
  submitter: string;
  status: "pending" | "approved" | "rejected";
  moderatorNote: string;
  createdAt: string;
  reviewedAt: string | null;
}

const API = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const httpApi = {
  stats: () => req<Stats>("/stats"),
  artists: (search = "") =>
    req<Artist[]>(`/artists?search=${encodeURIComponent(search)}`),
  artist: (slug: string) => req<ArtistDetail>(`/artists/${slug}`),
  graph: (focus: string, depth = 2) =>
    req<Graph>(`/graph?focus=${encodeURIComponent(focus)}&depth=${depth}`),
  contributions: (status = "pending") =>
    req<Contribution[]>(`/contributions?status=${status}`),
  submitContribution: (body: {
    kind: Contribution["kind"];
    payload: Record<string, unknown>;
    submitter?: string;
  }) =>
    req<{ id: number; status: string }>("/contributions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  approve: (id: number, note = "") =>
    req(`/contributions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  reject: (id: number, note = "") =>
    req(`/contributions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};

export type Api = typeof httpApi;

// Static (in-browser) mode is used for the GitHub Pages build, where there is
// no backend. Local dev uses the live HTTP API + Express/SQLite server.
const useStatic = import.meta.env.VITE_STATIC === "true";

export const api: Api = useStatic ? (staticApi as Api) : httpApi;
export const IS_STATIC = useStatic;

export const SOURCE_LABELS: Record<SourceType, string> = {
  interview: "Интервью",
  autobiography: "Автобиография / мемуары",
  encyclopedia: "Энциклопедия",
  documentary: "Документальный материал",
  official: "Официальная публикация",
  other: "Другой авторитетный источник",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Высокий уровень доверия",
  medium: "Средний уровень доверия",
};

export function years(a: Pick<Artist, "activeFrom" | "activeTo">): string {
  if (!a.activeFrom && !a.activeTo) return "";
  const to = a.activeTo ? String(a.activeTo) : "наст. вр.";
  return `${a.activeFrom ?? "?"}–${to}`;
}
