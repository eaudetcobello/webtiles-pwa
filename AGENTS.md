# Repository Guidelines

## Project Structure & Module Organization

This repository is a static PWA for Dungeon Crawl Stone Soup WebTiles with a small proxy layer for game data.

- `index.html` is the entry point and server chooser.
- `service-worker.js` provides the root-scoped offline shell.
- `dev-server.mjs` serves local static files and proxies `/gamedata/*`.
- `functions/gamedata/[[path]].js` is the Cloudflare Pages Function for production game-data proxying.
- `static/pwa/` contains mobile shell code, touch controls, manifest, and icons.
- `static/scripts/` contains the WebTiles client and vendored browser libraries.
- `static/fonts/`, `static/style.css`, `_headers`, `_redirects`, and `wrangler.jsonc` support assets and deployment.

## Build, Test, and Development Commands

- `npm install`: install the locked development dependency set.
- `npm run dev`: start `dev-server.mjs` on `http://localhost:3000`.
- `PORT=3001 npm run dev`: run the local server on another port.
- `npm run deploy:preview`: deploy the current directory to the Cloudflare Pages `preview` branch.
- `npm run deploy`: deploy to the configured Cloudflare Pages project.

Use npm for this project because `package-lock.json` is committed.

## Coding Style & Naming Conventions

Use modern JavaScript with ESM imports. Match the existing style: 4-space indentation in JavaScript, semicolons, double quotes for strings, and `const`/`let` instead of `var`. Keep browser-facing file names descriptive and lowercase, as in `mobile-pwa-controls.js`.

Avoid broad rewrites in `static/scripts/contrib/`; those files are vendored. Keep comments short and focused on why a non-obvious choice exists.

## Testing Guidelines

No automated test framework is configured yet. For changes, manually verify:

- `npm run dev` starts cleanly.
- `http://localhost:3000/` loads the chooser and mobile shell.
- `http://localhost:3000/?picker=1` forces the chooser.
- `/gamedata/*` requests proxy through the selected `crawl_origin` cookie.
- Service worker or manifest changes still allow installability on mobile.

## Commit & Pull Request Guidelines

Pull requests should include a short purpose statement, manual verification steps, linked issues when relevant, and screenshots or screen recordings for visible UI changes. Call out proxy, security, service worker, or deployment behavior explicitly when touched.

## Security & Configuration Tips

Production proxy restrictions live in `functions/gamedata/[[path]].js`; keep SSRF protections, HTTPS enforcement, and header stripping intact. The local dev server is intentionally more permissive for development against local or personal Crawl servers.
