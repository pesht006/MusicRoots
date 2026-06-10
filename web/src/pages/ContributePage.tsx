import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBox from "../components/SearchBox";
import { api, IS_STATIC, SOURCE_LABELS, type Contribution, type SourceType } from "../api";

type Kind = Contribution["kind"];

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "new_influence", label: "Новая связь", hint: "Артист A испытал влияние артиста B (нужен источник)" },
  { id: "new_source", label: "Новый источник", hint: "Добавить подтверждение к существующей связи" },
  { id: "error_report", label: "Сообщить об ошибке", hint: "Что-то в данных неверно" },
  { id: "correction", label: "Исправление", hint: "Предложить правку существующих данных" },
];

const SOURCE_TYPES = Object.keys(SOURCE_LABELS) as SourceType[];

export default function ContributePage() {
  const [sp] = useSearchParams();
  const [kind, setKind] = useState<Kind>("new_influence");
  const [submitter, setSubmitter] = useState("");
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  // new_influence
  const [target, setTarget] = useState<{ slug: string; name: string } | null>(
    sp.get("artist") ? { slug: sp.get("artist")!, name: sp.get("artist")! } : null
  );
  const [source, setSourceArtist] = useState<{ slug: string; name: string } | null>(null);
  const [description, setDescription] = useState("");

  // source fields
  const [sType, setSType] = useState<SourceType>("interview");
  const [citation, setCitation] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [url, setUrl] = useState("");

  // new_source / report
  const [influenceId, setInfluenceId] = useState("");
  const [message, setMessage] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3200);
  };

  const submit = async () => {
    setErr("");
    let payload: Record<string, unknown> = {};
    try {
      if (kind === "new_influence") {
        if (!target || !source) throw new Error("Выберите оба артиста");
        if (!citation) throw new Error("Источник обязателен для новой связи");
        payload = {
          artistSlug: target.slug,
          influencedBySlug: source.slug,
          description,
          source: { type: sType, citation, author, year: year ? Number(year) : null, url },
        };
      } else if (kind === "new_source") {
        if (!influenceId) throw new Error("Укажите ID связи");
        if (!citation) throw new Error("Заполните источник");
        payload = {
          influenceId: Number(influenceId),
          source: { type: sType, citation, author, year: year ? Number(year) : null, url },
        };
      } else {
        if (!message) throw new Error("Опишите проблему");
        payload = { artistSlug: target?.slug || "", message };
      }
      await api.submitContribution({ kind, payload, submitter });
      flash("Спасибо! Предложение отправлено на модерацию.");
      setDescription(""); setCitation(""); setAuthor(""); setYear(""); setUrl("");
      setMessage(""); setInfluenceId("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const sourceForm = (
    <>
      <label>Тип источника</label>
      <select value={sType} onChange={(e) => setSType(e.target.value as SourceType)}>
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t}>{SOURCE_LABELS[t]}</option>
        ))}
      </select>
      <label>Цитата / описание источника *</label>
      <textarea
        rows={3}
        value={citation}
        placeholder="Напр.: В интервью Rolling Stone (1994) Кобейн сказал…"
        onChange={(e) => setCitation(e.target.value)}
      />
      <div className="row" style={{ gap: 12 }}>
        <div style={{ flex: 2 }}>
          <label>Автор / издание</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Год</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <label>Ссылка (если есть)</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
    </>
  );

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1>Участвовать</h1>
      <p className="muted">
        Все предложения проходят модерацию перед публикацией. Любая новая связь должна
        опираться на достоверный источник.
      </p>
      {IS_STATIC && (
        <p className="muted" style={{ fontSize: 13, color: "var(--accent-2)" }}>
          Демо-режим: заявки сохраняются локально в вашем браузере. Откройте раздел
          «Модерация», чтобы одобрить их и увидеть изменения в древе.
        </p>
      )}

      <div className="row wrap" style={{ gap: 8, margin: "18px 0" }}>
        {KINDS.map((k) => (
          <button
            key={k.id}
            className={kind === k.id ? "btn-primary" : ""}
            onClick={() => { setKind(k.id); setErr(""); }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{KINDS.find((k) => k.id === kind)!.hint}</p>

        {kind === "new_influence" && (
          <>
            <label>Кто испытал влияние (артист A) *</label>
            {target ? (
              <div className="row">
                <span className="pill type">{target.name}</span>
                <button className="btn-sm btn-ghost" onClick={() => setTarget(null)}>изменить</button>
              </div>
            ) : (
              <SearchBox placeholder="Выберите артиста A…" onPick={(a) => setTarget(a)} />
            )}

            <label>Источник влияния (артист B) *</label>
            {source ? (
              <div className="row">
                <span className="pill type">{source.name}</span>
                <button className="btn-sm btn-ghost" onClick={() => setSourceArtist(null)}>изменить</button>
              </div>
            ) : (
              <SearchBox placeholder="Выберите артиста B…" onPick={(a) => setSourceArtist(a)} />
            )}

            <label>В чём выразилось влияние</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            {sourceForm}
          </>
        )}

        {kind === "new_source" && (
          <>
            <label>ID связи (influenceId) *</label>
            <input
              value={influenceId}
              onChange={(e) => setInfluenceId(e.target.value)}
              placeholder="напр. 14 — виден в подсказке на ребре"
              inputMode="numeric"
            />
            {sourceForm}
          </>
        )}

        {(kind === "error_report" || kind === "correction") && (
          <>
            <label>Связанный артист (необязательно)</label>
            {target ? (
              <div className="row">
                <span className="pill type">{target.name}</span>
                <button className="btn-sm btn-ghost" onClick={() => setTarget(null)}>убрать</button>
              </div>
            ) : (
              <SearchBox placeholder="Найти артиста…" onPick={(a) => setTarget(a)} />
            )}
            <label>Описание {kind === "correction" ? "исправления" : "ошибки"} *</label>
            <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </>
        )}

        <label>Ваше имя / контакт (необязательно)</label>
        <input value={submitter} onChange={(e) => setSubmitter(e.target.value)} />

        {err && <p style={{ color: "#ff8a8a" }}>{err}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={submit}>Отправить на модерацию</button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
