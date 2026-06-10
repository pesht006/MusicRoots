import { useEffect, useState } from "react";
import { api, type Contribution } from "../api";

const KIND_LABEL: Record<Contribution["kind"], string> = {
  new_influence: "Новая связь",
  new_source: "Новый источник",
  error_report: "Сообщение об ошибке",
  correction: "Исправление",
};

export default function ModerationPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = (status = tab) => {
    setLoading(true);
    api.contributions(status).then((r) => {
      setItems(r);
      setLoading(false);
    });
  };

  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const act = async (id: number, action: "approve" | "reject") => {
    const note = action === "reject"
      ? window.prompt("Комментарий модератора (необязательно):") || ""
      : "";
    setBusy(id);
    try {
      if (action === "approve") await api.approve(id, note);
      else await api.reject(id, note);
      load(tab);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <h1>Модерация</h1>
      <p className="muted">
        Очередь пользовательских предложений. Одобренные изменения сразу появляются в древе.
      </p>

      <div className="row" style={{ gap: 8, margin: "16px 0" }}>
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} className={tab === s ? "btn-primary" : ""} onClick={() => setTab(s)}>
            {s === "pending" ? "На рассмотрении" : s === "approved" ? "Одобрено" : "Отклонено"}
          </button>
        ))}
      </div>

      {loading && <div className="spin">Загрузка…</div>}
      {!loading && items.length === 0 && <div className="empty">Пусто.</div>}

      <div className="contrib">
        {items.map((c) => {
          const p = c.payload as Record<string, string>;
          return (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <span className="pill type">{KIND_LABEL[c.kind]}</span>{" "}
                  <span className="muted" style={{ fontSize: 12 }}>#{c.id} · {c.createdAt}</span>
                </div>
                {c.submitter && <span className="muted">от {c.submitter}</span>}
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                {c.kind === "new_influence" && (
                  <>
                    <div className="kv"><b>Связь:</b> {p.artistSlug} ← {p.influencedBySlug}</div>
                    {p.description && <div className="kv"><b>Описание:</b> {p.description}</div>}
                  </>
                )}
                {c.kind === "new_source" && (
                  <div className="kv"><b>Связь ID:</b> {p.influenceId}</div>
                )}
                {(c.kind === "error_report" || c.kind === "correction") && (
                  <>
                    {p.artistSlug && <div className="kv"><b>Артист:</b> {p.artistSlug}</div>}
                    <div className="kv"><b>Текст:</b> {p.message}</div>
                  </>
                )}
                {p.source && typeof p.source === "object" && (
                  <div className="kv">
                    <b>Источник:</b> {(p.source as Record<string, string>).type} — {(p.source as Record<string, string>).citation}
                  </div>
                )}
              </div>

              {c.moderatorNote && (
                <div className="kv" style={{ marginTop: 8 }}><b>Заметка:</b> {c.moderatorNote}</div>
              )}

              {c.status === "pending" && (
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn-ok btn-sm" disabled={busy === c.id} onClick={() => act(c.id, "approve")}>
                    Одобрить
                  </button>
                  <button className="btn-no btn-sm" disabled={busy === c.id} onClick={() => act(c.id, "reject")}>
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
