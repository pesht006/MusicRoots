# AGENTS.md

## Cursor Cloud specific instructions

### Repository layout

- **`main`** currently contains only the project README (placeholder).
- The runnable **MusicRoots** monorepo (API + web UI) lives on branch **`cursor/music-influence-tree-4279`** until it is merged to `main`. Cloud agents should check out that branch (or any branch with `package.json` at the repo root) before installing or running services.

### Services

| Service | Port | Command |
| ------- | ---- | ------- |
| API (Express + SQLite) | 4000 | `npm run server` |
| Web (Vite + React) | 5173 | `npm run web` |
| Both together | 4000 + 5173 | `npm run dev` |

The Vite dev server proxies `/api` to port 4000 (`web/vite.config.ts`).

### First-time setup (human or agent)

```bash
npm run setup   # installs server + web deps and seeds SQLite (server/data.sqlite)
```

Re-seed only when you need a fresh database: `npm run seed`.

### Lint / test / build

There is no dedicated ESLint script. Use:

- **Tests:** `npm test` (Node test runner in `server/test/`)
- **Build:** `npm run build` (TypeScript + Vite production build in `web/`)

### Dev server notes

- `npm run dev` runs `scripts/dev.js`, which spawns API and web as sibling processes. Use a tmux session for long-running dev.
- SQLite file `server/data.sqlite` is gitignored; it is created by `npm run seed` (also run as part of `npm run setup`).
- `better-sqlite3` is a native addon; Node 18+ is required (Node 22 works in this environment).

### Hello-world verification

1. `curl http://localhost:4000/api/stats` → expect JSON with artist/influence counts.
2. Open `http://localhost:5173`, search for an artist (e.g. Metallica), open the influence tree, click a node, and visit an artist page.
