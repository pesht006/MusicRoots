import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, type Stats } from "./api";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import ArtistPage from "./pages/ArtistPage";
import ContributePage from "./pages/ContributePage";
import ModerationPage from "./pages/ModerationPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <>
      <nav className="nav">
        <NavLink to="/" className="brand">
          <span className="dot" /> MusicRoots
        </NavLink>
        <div className="links">
          <NavLink to="/explore">Древо</NavLink>
          <NavLink to="/contribute">Участвовать</NavLink>
          <NavLink to="/moderation">Модерация</NavLink>
          <NavLink to="/about">О проекте</NavLink>
        </div>
        <div className="spacer" />
        {stats && (
          <span className="badge">
            {stats.artists} артистов · {stats.influences} связей
          </span>
        )}
      </nav>

      <Routes>
        <Route path="/" element={<HomePage stats={stats} />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/artist/:slug" element={<ArtistPage />} />
        <Route path="/contribute" element={<ContributePage />} />
        <Route path="/moderation" element={<ModerationPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </>
  );
}
