import { useNavigate } from "react-router-dom";
import SearchBox from "../components/SearchBox";
import type { Stats } from "../api";

const DEMO = ["Metallica", "Motörhead", "Jimi Hendrix", "Muddy Waters", "Son House"];

export default function HomePage({ stats }: { stats: Stats | null }) {
  const nav = useNavigate();
  return (
    <div className="page">
      <div className="hero">
        <h1>
          Музыкальное <span className="grad">древо влияний</span>
        </h1>
        <p>
          Не энциклопедия, а карта творческой преемственности. Начните с любого артиста
          и проследите цепочку влияний сквозь эпохи и поколения — каждая связь
          подтверждена источником.
        </p>

        <SearchBox
          autoFocus
          placeholder="Введите имя артиста или группы…"
          onPick={(a) => nav(`/explore?focus=${a.slug}`)}
        />

        <div className="chain-demo">
          {DEMO.map((n, i) => (
            <span key={n} style={{ display: "contents" }}>
              <span className="node">{n}</span>
              {i < DEMO.length - 1 && <span className="arrow">→</span>}
            </span>
          ))}
        </div>

        <div className="row wrap" style={{ justifyContent: "center", marginTop: 28 }}>
          <button className="btn-primary" onClick={() => nav("/explore?focus=metallica")}>
            Открыть древо
          </button>
          <button className="btn-ghost" onClick={() => nav("/suggest")}>
            Предложить исполнителя
          </button>
        </div>

        {stats && (
          <div className="stat-row">
            <div className="stat">
              <div className="num">{stats.artists}</div>
              <div className="lbl">артистов и групп</div>
            </div>
            <div className="stat">
              <div className="num">{stats.influences}</div>
              <div className="lbl">подтверждённых связей</div>
            </div>
            <div className="stat">
              <div className="num">{stats.sources}</div>
              <div className="lbl">источников</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid cards-auto" style={{ marginTop: 30 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Древо в центре</h3>
          <p className="muted">
            Интерактивный граф: фокус на артисте, его корни влияния и наследники.
            Один клик — и древо перецентрируется на новом узле.
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Только с источником</h3>
          <p className="muted">
            Каждая связь подтверждена интервью, мемуарами, энциклопедией или
            документальным материалом. Без источника — нет связи.
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Сила сообщества</h3>
          <p className="muted">
            Предлагайте артистов для добавления и сообщайте об ошибках. Заявки
            проверяются вручную перед публикацией.
          </p>
        </div>
      </div>
    </div>
  );
}
