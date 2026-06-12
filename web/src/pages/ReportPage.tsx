import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Captcha from "../components/Captcha";
import { CAPTCHA_PROVIDER, SUBMISSIONS_ENABLED, submit } from "../config";

type State = "idle" | "sending" | "ok" | "error";

export default function ReportPage() {
  const [sp] = useSearchParams();
  const [artist, setArtist] = useState(sp.get("artist") || "");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  const needsCaptcha = CAPTCHA_PROVIDER !== "none";
  const canSend =
    SUBMISSIONS_ENABLED && message.trim().length >= 5 && (!needsCaptcha || token) && state !== "sending";

  const send = async () => {
    setState("sending");
    setMsg("");
    try {
      await submit({ name: message.trim(), type: "error", artist: artist.trim(), token });
      setState("ok");
      setMsg("Спасибо! Сообщение отправлено администратору.");
      setMessage("");
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    } finally {
      setToken("");
      setAttempt((a) => a + 1);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <h1>Нашли ошибку?</h1>
      <p className="muted">
        Заметили неточность в данных, неверную связь или сомнительный источник?
        Сообщите — администратор проверит и исправит.
      </p>

      {!SUBMISSIONS_ENABLED && (
        <div className="card" style={{ borderColor: "var(--medium)", marginBottom: 16 }}>
          <b>Приём сообщений ещё настраивается.</b>
          <p className="muted" style={{ marginBottom: 0 }}>
            Форма заработает, как только администратор подключит сервис приёма заявок.
          </p>
        </div>
      )}

      <div className="card">
        <label>Артист или связь (необязательно)</label>
        <input
          value={artist}
          placeholder="Например: Metallica или Metallica ← Motörhead"
          maxLength={120}
          disabled={!SUBMISSIONS_ENABLED}
          onChange={(e) => setArtist(e.target.value)}
        />

        <label>Что не так? *</label>
        <textarea
          rows={4}
          value={message}
          placeholder="Опишите ошибку: что неверно и, по возможности, ссылку на правильный источник."
          maxLength={400}
          disabled={!SUBMISSIONS_ENABLED}
          onChange={(e) => setMessage(e.target.value)}
        />

        {SUBMISSIONS_ENABLED && <Captcha key={attempt} onToken={setToken} />}

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn-primary" disabled={!canSend} onClick={send}>
            {state === "sending" ? "Отправка…" : "Отправить"}
          </button>
        </div>

        {msg && (
          <p style={{ marginBottom: 0, color: state === "error" ? "#c83333" : "var(--accent-2)" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
