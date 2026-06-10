import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api, years, SOURCE_LABELS, CONFIDENCE_LABELS,
  type ArtistDetail, type InfluenceLink,
} from "../api";

function LinkCard({
  link, onGo,
}: {
  link: InfluenceLink;
  onGo: (slug: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link to={`/artist/${link.artist.slug}`} style={{ fontWeight: 800, fontSize: 17 }}>
          {link.artist.name}
        </Link>
        <span className={`pill ${link.confidence}`} title={CONFIDENCE_LABELS[link.confidence]}>
          {link.confidence}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 14, margin: "6px 0" }}>{link.description}</div>
      {link.sources.map((s) => (
        <div key={s.id} className="source-line">
          <b>{SOURCE_LABELS[s.type]}</b>
          {s.author ? ` · ${s.author}` : ""}{s.year ? ` (${s.year})` : ""}: {s.citation}
          {s.url && (
            <>
              {" "}
              <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--heir)" }}>
                ссылка
              </a>
            </>
          )}
        </div>
      ))}
      <button className="btn-sm" style={{ marginTop: 10 }} onClick={() => onGo(link.artist.slug)}>
        В древе →
      </button>
    </div>
  );
}

export default function ArtistPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<ArtistDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setA(null);
    setError("");
    api.artist(slug).then(setA).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="page"><div className="empty">{error}</div></div>;
  if (!a) return <div className="page"><div className="spin">Загрузка…</div></div>;

  return (
    <div className="page">
      <div className="artist-head">
        <div className="avatar">{a.name[0]}</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="pill type">{a.type === "band" ? "группа" : "артист"}</span>
            {years(a) && <span className="muted">{years(a)}</span>}
            {a.country && <span className="muted">· {a.country}</span>}
          </div>
          <h1 style={{ margin: "8px 0 6px" }}>{a.name}</h1>
          <p className="muted" style={{ maxWidth: 680 }}>{a.bio}</p>
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            {a.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn-primary" onClick={() => nav(`/explore?focus=${a.slug}`)}>
              Открыть в древе
            </button>
            <Link className="btn btn-ghost" to={`/contribute?artist=${a.slug}`}>
              Предложить связь
            </Link>
          </div>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="section-title">
            Корни влияния — кто повлиял ({a.roots.length})
          </div>
          {a.roots.length === 0 && <p className="muted">Подтверждённых источников влияния пока нет.</p>}
          {a.roots.map((l) => (
            <LinkCard key={l.influenceId} link={l} onGo={(s) => nav(`/explore?focus=${s}`)} />
          ))}
        </div>
        <div>
          <div className="section-title">
            Наследники — на кого повлиял ({a.heirs.length})
          </div>
          {a.heirs.length === 0 && <p className="muted">Связей с наследниками пока нет.</p>}
          {a.heirs.map((l) => (
            <LinkCard key={l.influenceId} link={l} onGo={(s) => nav(`/explore?focus=${s}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}
