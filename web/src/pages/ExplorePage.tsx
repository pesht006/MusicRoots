import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import InfluenceGraph from "../components/InfluenceGraph";
import SearchBox from "../components/SearchBox";
import { api, years, type ArtistDetail, type Graph } from "../api";

const DEFAULT_FOCUS = "metallica";

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const focus = params.get("focus") || DEFAULT_FOCUS;
  const [depth, setDepth] = useState(2);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [trail, setTrail] = useState<{ slug: string; name: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([api.graph(focus, depth), api.artist(focus)])
      .then(([g, d]) => {
        if (!active) return;
        setGraph(g);
        setDetail(d);
        setTrail((prev) => {
          if (prev.length && prev[prev.length - 1].slug === focus) return prev;
          const existing = prev.findIndex((c) => c.slug === focus);
          if (existing >= 0) return prev.slice(0, existing + 1);
          return [...prev, { slug: focus, name: d.name }];
        });
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [focus, depth]);

  const select = useCallback(
    (slug: string) => setParams({ focus: slug }, { replace: false }),
    [setParams]
  );

  return (
    <div className="explore">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="breadcrumbs">
          <span className="muted">Путь:</span>
          {trail.length === 0 && <span className="crumb cur">{detail?.name || focus}</span>}
          {trail.map((c, i) => (
            <span key={c.slug + i} style={{ display: "contents" }}>
              <span
                className={`crumb${c.slug === focus ? " cur" : ""}`}
                onClick={() => select(c.slug)}
              >
                {c.name}
              </span>
              {i < trail.length - 1 && <span className="muted">›</span>}
            </span>
          ))}
        </div>

        <div className="graph-wrap" style={{ position: "relative", flex: 1 }}>
          <div className="controls">
            <div className="ctitle">Древо влияний</div>
            <SearchBox placeholder="Перейти к артисту…" onPick={(a) => select(a.slug)} />
            <label style={{ margin: "4px 0 0" }}>Глубина: {depth} уровня</label>
            <input
              type="range"
              min={1}
              max={4}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
            <div className="legend">
              <div className="li"><span className="sw" style={{ background: "#ff8a3d" }} /> корни влияния (предки)</div>
              <div className="li"><span className="sw" style={{ background: "#7c5cff" }} /> текущий артист</div>
              <div className="li"><span className="sw" style={{ background: "#4aa8ff" }} /> наследники</div>
              <div className="li" style={{ marginTop: 4 }}>стрелка → указывает на источник влияния</div>
              <div className="li muted">клик — перейти · двойной клик — открыть страницу</div>
            </div>
          </div>

          {error && <div className="empty">Не удалось загрузить древо: {error}</div>}
          {!error && graph && (
            <InfluenceGraph
              graph={graph}
              onSelectNode={select}
              onOpenArtist={(slug) => nav(`/artist/${slug}`)}
            />
          )}
          {!error && !graph && <div className="spin">Загрузка древа…</div>}
        </div>
      </div>

      {detail && (
        <aside className="side">
          <span className="pill type">{detail.type === "band" ? "группа" : "артист"}</span>{" "}
          {years(detail) && <span className="muted">{years(detail)}</span>}
          <h2>{detail.name}</h2>
          <p className="muted" style={{ fontSize: 14 }}>{detail.bio}</p>
          <button className="btn-sm" onClick={() => nav(`/artist/${detail.slug}`)}>
            Открыть полную страницу →
          </button>

          <div className="section-title" style={{ marginTop: 22 }}>
            Корни влияния ({detail.roots.length})
          </div>
          {detail.roots.length === 0 && <p className="muted">Источники пока не добавлены.</p>}
          {detail.roots.map((r) => (
            <div key={r.influenceId} className="link-item" onClick={() => select(r.artist.slug)}>
              <div className="ttl">
                <span>{r.artist.name}</span>
                <span className={`pill ${r.confidence}`}>{r.sources.length}</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{r.description}</div>
            </div>
          ))}

          <div className="section-title" style={{ marginTop: 18 }}>
            Повлиял на ({detail.heirs.length})
          </div>
          {detail.heirs.length === 0 && <p className="muted">Связи пока не добавлены.</p>}
          {detail.heirs.map((r) => (
            <div key={r.influenceId} className="link-item" onClick={() => select(r.artist.slug)}>
              <div className="ttl">
                <span>{r.artist.name}</span>
                <span className={`pill ${r.confidence}`}>{r.sources.length}</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{r.description}</div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
