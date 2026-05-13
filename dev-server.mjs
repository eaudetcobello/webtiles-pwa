import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ORIGIN = process.env.DEFAULT_ORIGIN || "https://crawl.dcss.io";
const PROXY_PREFIXES = ["/gamedata/"];

// Dev allows both https and http (so local Crawl servers / droplets work).
// Production (the Pages Function) restricts to https.
const ORIGIN_RE = /^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?$/i;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".mjs":  "application/javascript; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".svg":  "image/svg+xml",
    ".webp": "image/webp",
    ".ico":  "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf":  "font/ttf",
};

function parseCookies(header) {
    const out = {};
    for (const part of (header || "").split(/;\s*/)) {
        if (!part) continue;
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    return out;
}

function pickOrigin(req) {
    const raw = decodeURIComponent(parseCookies(req.headers.cookie).crawl_origin || "");
    if (ORIGIN_RE.test(raw)) {
        try { return new URL(raw); } catch { /* fall through */ }
    }
    return new URL(DEFAULT_ORIGIN);
}

function proxy(req, res) {
    const target = pickOrigin(req);
    const lib = target.protocol === "https:" ? https : http;
    const forwarded = { ...req.headers, host: target.host };
    delete forwarded["accept-encoding"];
    delete forwarded["cookie"]; // upstream doesn't need our local cookies

    const upstream = lib.request({
        host: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: req.url,
        headers: forwarded,
    }, up => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
    });
    upstream.on("error", err => {
        console.error(`proxy error → ${target.origin}${req.url}:`, err.message);
        if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("proxy error: " + err.message);
    });
    req.pipe(upstream);
}

async function serveStatic(req, res) {
    let urlPath = req.url.split("?")[0];
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const safe = path.posix.normalize(urlPath);
    if (safe.startsWith("..")) { res.writeHead(403); return res.end("forbidden"); }
    const full = path.join(ROOT, safe);
    if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
    try {
        const stat = await fs.promises.stat(full);
        if (stat.isDirectory()) { res.writeHead(404); return res.end("not found"); }
        const ext = path.extname(full).toLowerCase();
        res.writeHead(200, {
            "Content-Type": MIME[ext] || "application/octet-stream",
            "Cache-Control": "no-store",
        });
        fs.createReadStream(full).pipe(res);
    } catch {
        res.writeHead(404); res.end("not found");
    }
}

http.createServer((req, res) => {
    if (PROXY_PREFIXES.some(p => req.url.startsWith(p))) return proxy(req, res);
    serveStatic(req, res);
}).listen(PORT, () => {
    console.log(`dev server: http://localhost:${PORT}`);
    console.log(`  static  : ${ROOT}`);
    console.log(`  proxy   : ${PROXY_PREFIXES.join(", ")} → crawl_origin cookie (default ${DEFAULT_ORIGIN})`);
});
