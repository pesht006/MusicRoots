import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import InfluenceGraph from "../components/InfluenceGraph";
import SearchBox from "../components/SearchBox";
import Avatar from "../components/Avatar";
import { api, years, type ArtistDetail, type Graph, type InfluenceLink } from "../api";

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
  const [controlsOpen, setControlsOpen] = useState(true);

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

  const linkRow = (r: InfluenceLink) => {
    const srcUrl = r.sources.find((s) => s.url)?.url;
    return (
      <div key={r.influenceId} className="link-item" onClick={() => select(r.artist.slug)}>
        <div className="ttl">
          <span className="who">
            <Avatar name={r.artist.name} image={r.artist.image} size={30} rounded={8} />
            {r.artist.name}
          </span>
          <span className={`pill ${r.confidence}`}>{r.sources.length}</span>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.description}</div>
        <div className="row wrap" style={{ gap: 10, marginTop: 6 }}>
          {srcUrl && (
            <a className="ext" href={srcUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              источник ↗
            </a>
          )}
          {r.artist.wiki && (
            <a className="ext" href={r.artist.wiki} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              Wikipedia ↗
            </a>
          )}
        </div>
      </div>
    );
  };

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
            <div className="ctitle-row">
              <span className="ctitle">Древо влияний</span>
              <button
                className="controls-toggle"
                onClick={() => setControlsOpen((o) => !o)}
                aria-label={controlsOpen ? "Скрыть панель" : "Показать панель"}
              >
                {controlsOpen ? "▲" : "▼"}
              </button>
            </div>
            {controlsOpen && (
              <>
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
                <div className="legend" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>ДОСТОВЕРНОСТЬ СВЯЗИ</div>
                  <div className="li"><span className="sw" style={{ background: "#0a9d7d", borderRadius: 2 }} /> высокая (high)</div>
                  <div className="li"><span className="sw" style={{ background: "#c08400", borderRadius: 2 }} /> средняя (medium)</div>
                  <div className="li" style={{ opacity: 0.5 }}><span className="sw" style={{ background: "#9aa3b5", borderRadius: 2, border: "1px dashed #9aa3b5" }} /> слабая — не отображается</div>
                </div>
              </>
            )}
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
          <div className="side-head">
            <Avatar name={detail.name} image={detail.image} size={64} rounded={14} />
            <div style={{ minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="pill type">{detail.type === "band" ? "группа" : "артист"}</span>
                {years(detail) && <span className="muted">{years(detail)}</span>}
              </div>
              <h2>{detail.name}</h2>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>{detail.bio}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn-sm" onClick={() => nav(`/artist/${detail.slug}`)}>
              Открыть полную страницу →
            </button>
            {detail.wiki && (
              <a className="ext" href={detail.wiki} target="_blank" rel="noreferrer">
                Wikipedia ↗
              </a>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 22 }}>
            Корни влияния ({detail.roots.length})
          </div>
          {detail.roots.length === 0 && <p className="muted">Источники пока не добавлены.</p>}
          {detail.roots.map(linkRow)}

          <div className="section-title" style={{ marginTop: 18 }}>
            Повлиял на ({detail.heirs.length})
          </div>
          {detail.heirs.length === 0 && <p className="muted">Связи пока не добавлены.</p>}
          {detail.heirs.map(linkRow)}
        </aside>
      )}
    </div>
  );
}
