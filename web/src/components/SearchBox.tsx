import { useEffect, useRef, useState } from "react";
import { api, years, type Artist } from "../api";

export default function SearchBox({
  placeholder = "Найти артиста или группу…",
  onPick,
  autoFocus = false,
}: {
  placeholder?: string;
  onPick: (artist: Artist) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Artist[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      api.artists(q).then((r) => active && setResults(r)).catch(() => {});
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="search" ref={boxRef}>
      <input
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((a) => (
            <div
              key={a.slug}
              className="item"
              onClick={() => {
                onPick(a);
                setOpen(false);
                setQ("");
              }}
            >
              <span>
                {a.name}{" "}
                <span className="pill type">{a.type === "band" ? "группа" : "артист"}</span>
              </span>
              <span className="muted">{years(a)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
