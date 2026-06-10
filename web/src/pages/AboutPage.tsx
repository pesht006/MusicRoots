export default function AboutPage() {
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>О проекте</h1>
      <p className="muted">
        <b>MusicRoots</b> — это не музыкальная энциклопедия, а карта творческой
        преемственности. Цель — собрать крупнейшую базу <b>подтверждённых</b>
        музыкальных влияний, где можно начать с любого артиста и проследить цепочку
        связей сквозь эпохи и поколения.
      </p>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Как читать древо</h3>
        <p className="muted">
          Связь <b>A → B</b> означает «A испытал влияние B». Двигаясь по стрелкам, вы
          спускаетесь к корням музыки; двигаясь против — поднимаетесь к наследникам.
          Пример: <i>Metallica → Motörhead → Jimi Hendrix</i>.
        </p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Методология источников</h3>
        <p className="muted">Связь публикуется, только если подтверждена источником:</p>
        <ul className="muted">
          <li>интервью самих музыкантов;</li>
          <li>автобиографии и мемуары;</li>
          <li>музыкальные энциклопедии;</li>
          <li>документальные материалы;</li>
          <li>официальные публикации и другие авторитетные источники.</li>
        </ul>
        <p className="muted">
          Уровень доверия связи (<span className="pill high">high</span>{" "}
          <span className="pill medium">medium</span>{" "}
          <span className="pill low">low</span>) зависит от числа и типа источников.
        </p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Участие сообщества</h3>
        <p className="muted">
          Любой может без регистрации предложить исполнителя для добавления в древо
          (раздел «Предложить исполнителя») или сообщить о неточности («Нашли ошибку»).
          Заявки проверяются администратором вручную перед публикацией.
        </p>
      </div>
    </div>
  );
}
