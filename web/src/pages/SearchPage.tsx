import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBox from "../components/SearchBox";
import Avatar from "../components/Avatar";
import { years, type Artist } from "../api";

export default function SearchPage() {
  const nav = useNavigate();
  const [picked, setPicked] = useState<Artist | null>(null);

  return (
    <div className="page">
      <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>Поиск</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
        Найдите артиста или группу, чтобы открыть их страницу или древо влияний.
      </p>
      <SearchBox
        placeholder="Найти артиста или группу…"
        autoFocus
        onPick={(a) => {
          setPicked(a);
        }}
      />
      {picked && (
        <div className="card" style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={picked.name} image={picked.image} size={56} rounded={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 6, marginBottom: 4 }}>
              <span className="pill type">{picked.type === "band" ? "группа" : "артист"}</span>
              {years(picked) && <span className="muted" style={{ fontSize: 13 }}>{years(picked)}</span>}
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{picked.name}</div>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn-sm" onClick={() => nav(`/artist/${picked.slug}`)}>
              Страница артиста →
            </button>
            <button className="btn-sm" onClick={() => nav(`/explore?focus=${picked.slug}`)}>
              Древо влияний →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
