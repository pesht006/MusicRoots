import { useState } from "react";
import Turnstile from "../components/Turnstile";
import { SUBMISSIONS_ENABLED, TURNSTILE_SITEKEY, submit } from "../config";

type State = "idle" | "sending" | "ok" | "dedup" | "error";

export default function SuggestPage() {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  const needsCaptcha = Boolean(TURNSTILE_SITEKEY);
  const canSend =
    SUBMISSIONS_ENABLED && name.trim().length >= 2 && (!needsCaptcha || token) && state !== "sending";

  const send = async () => {
    setState("sending");
    setMsg("");
    try {
      const r = await submit({ name: name.trim(), type: "artist", token });
      if (r.dedup) {
        setState("dedup");
        setMsg("Этот исполнитель уже в сегодняшнем списке — спасибо!");
      } else {
        setState("ok");
        setMsg("Готово! Заявка принята и попадёт к администратору.");
        setName("");
      }
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <h1>Предложить исполнителя</h1>
      <p className="muted">
        Не нашли любимого артиста или группу в древе? Предложите — администратор
        рассмотрит заявку и добавит их вместе с подтверждёнными влияниями и источниками.
      </p>

      {!SUBMISSIONS_ENABLED && (
        <div className="card" style={{ borderColor: "var(--medium)", marginBottom: 16 }}>
          <b>Приём заявок ещё настраивается.</b>
          <p className="muted" style={{ marginBottom: 0 }}>
            Форма заработает, как только администратор подключит сервис приёма заявок.
          </p>
        </div>
      )}

      <div className="card">
        <label>Имя исполнителя или группы</label>
        <input
          value={name}
          placeholder="Например: Kate Bush"
          maxLength={120}
          disabled={!SUBMISSIONS_ENABLED}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) send();
          }}
        />

        {SUBMISSIONS_ENABLED && (
          <Turnstile sitekey={TURNSTILE_SITEKEY} onToken={setToken} />
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn-primary" disabled={!canSend} onClick={send}>
            {state === "sending" ? "Отправка…" : "Отправить заявку"}
          </button>
        </div>

        {msg && (
          <p
            style={{
              marginBottom: 0,
              color: state === "error" ? "#c83333" : "var(--accent-2)",
            }}
          >
            {msg}
          </p>
        )}
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
        Достаточно имени. Можно без регистрации. Заявки проверяются вручную, поэтому
        добавление занимает время — спасибо за вклад!
      </p>
    </div>
  );
}
