# Crawl PWA

An unofficial mobile-friendly PWA client for [Dungeon Crawl Stone Soup WebTiles](https://crawl.develz.org/).

You pick which public Crawl server to play on (CAO, CDO, CDI, etc.) and the PWA talks to that server's existing WebSocket endpoint. No player accounts or characters are stored here.

## Run locally

```bash
git clone https://github.com/eaudetcobello/webtiles-pwa.git crawl-pwa
cd crawl-pwa
npm run dev
# open http://localhost:3000
```

That starts `dev-server.mjs` (Node, zero dependencies). First visit shows a server chooser. Pick one, log in with your existing account on that server, play.

Useful URLs:

| URL | Effect |
|---|---|
| `http://localhost:3000/` | normal flow |
| `http://localhost:3000/?picker=1` | force the chooser to re-appear |
| `http://localhost:3000/?server=wss://host/socket` | skip the chooser; use this server |

## How it works

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
   browser          │   Cloudflare Pages (static + Pages Function)│       Crawl server
                    │                                             │       (e.g. crawl.dcss.io)
   ┌──────────┐     │    ┌──────────────┐    ┌───────────────┐    │     ┌─────────────────┐
   │  PWA UI  │─────┼───▶│ static files │    │ /gamedata/* fn│────┼────▶│ HTTPS /gamedata │
   │ (Crawl   │     │    │ (HTML/CSS/JS)│    │ (proxy)       │    │     │                 │
   │  client) │◀────┼─── └──────────────┘    └───────────────┘    │     │                 │
   │          │     │                                             │     │                 │
   │          │     └─────────────────────────────────────────────┘     │                 │
   │          │────────────────────────────────────────────────────────▶│ WSS /socket     │
   │          │◀────────────────────────────────────────────────────────│ (game protocol) │
   └──────────┘                                                         └─────────────────┘
```

Three flows:

1. **HTML / JS / CSS** are static files served by Cloudflare Pages (or `dev-server.mjs` locally).
2. **WebSocket** connects directly from the browser to the Crawl server the user chose. Login, lobby, chat, game protocol all happen here. This is a regular cross-origin WSS connection; no proxy in the middle.
3. **Game data** (`/gamedata/<commit-sha>/...` for tile sprites, per-version JS modules, CSS) is fetched through a proxy. The browser requests it from this origin, the proxy fetches from the chosen Crawl server, and streams it back.

### Why proxy game data at all

The WebTiles client constructs game-data URLs as relative paths (`/gamedata/<sha>/floor.png`), so the browser tries to fetch them from this origin. Without a proxy those requests would 404. Rewriting client URLs to absolute would be invasive and version-fragile; proxying is one config line per environment.

### How the proxy follows the user's server choice

On every visit the page derives an HTTP origin from the WebSocket URL (`wss://host/socket` becomes `https://host`) and writes it to a `crawl_origin` cookie scoped to this site. The proxy reads that cookie on every `/gamedata/*` request and fetches from the chosen origin. If the cookie is missing or invalid the proxy falls back to `crawl.dcss.io`.

| Environment | Proxy implementation |
|---|---|
| Local dev | `dev-server.mjs` reads `crawl_origin` cookie, proxies via `node:http`/`node:https` |
| Cloudflare Pages | `functions/gamedata/[[path]].js` reads the same cookie, proxies via `fetch` |

### Security on the production proxy

`functions/gamedata/[[path]].js` validates the cookie:

- HTTPS only (no plain HTTP)
- Strict hostname regex (must look like a DNS name)
- Rejects loopback, RFC1918, link-local, and `0.0.0.0/8`
- Strips Cloudflare's connecting-IP headers before forwarding
- Drops `Set-Cookie` from upstream so a third-party server can't plant cookies on this origin

The dev server is more permissive (accepts http and https, no host blocklist) so you can develop against a local Crawl instance or a personal droplet.

## Deploy

```bash
npm install
npx wrangler login           # one-time, OAuth in browser
npx wrangler pages project create crawl-pwa   # one-time
npm run deploy
```

Cloudflare gives you a `*.pages.dev` URL. Open it on a phone, Add to Home Screen, done.

## Layout

```
crawl-pwa/
├── index.html                       entry point + server chooser
├── service-worker.js                root-scoped SW for offline shell
├── dev-server.mjs                   local Node dev server
├── _headers, _redirects             Cloudflare Pages config
├── wrangler.jsonc                   Pages project config
├── functions/
│   └── gamedata/[[path]].js         dynamic /gamedata/* proxy
└── static/
    ├── pwa/                         mobile shell (touch keyboard, manifest, icons)
    ├── scripts/                     WebTiles client (jQuery + require.js + client.js)
    ├── fonts/                       DejaVu Sans
    └── style.css                    base WebTiles styles
```

## Caveats

- No affiliation with the DCSS team or any specific server operator. This client connects to public servers using their existing protocols.
- Game-data assets are content-hashed per Crawl commit, so proxy cache hits are safe and the Cloudflare edge caches them naturally.
- If you publicise this widely, talk to the server operators first; their resources are not free.
