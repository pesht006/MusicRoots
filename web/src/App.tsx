import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, type Stats } from "./api";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import ArtistPage from "./pages/ArtistPage";
import SuggestPage from "./pages/SuggestPage";
import ReportPage from "./pages/ReportPage";
import AboutPage from "./pages/AboutPage";
import SearchPage from "./pages/SearchPage";

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
          <NavLink to="/search">Поиск</NavLink>
          <NavLink to="/suggest">Предложить исполнителя</NavLink>
          <NavLink to="/report">Нашли ошибку</NavLink>
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
        <Route path="/suggest" element={<SuggestPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </>
  );
}
