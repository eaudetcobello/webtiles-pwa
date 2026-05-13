// Cloudflare Pages Function: proxy /gamedata/* to whichever Crawl server
// the client chose. The chosen origin is read from the `crawl_origin`
// cookie set by index.html when ?server=... is provided.
//
// Validates the cookie strictly to prevent SSRF: HTTPS only, no
// private/loopback ranges, must be a real-looking hostname.

const DEFAULT_ORIGIN = "https://crawl.dcss.io";
const ORIGIN_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?$/i;
const FORBIDDEN_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|0\.|169\.254\.)/i;

export async function onRequest(context) {
    const { request, params } = context;

    const cookies = parseCookies(request.headers.get("Cookie") || "");
    const raw = decodeURIComponent(cookies.crawl_origin || "");
    const origin = isAllowed(raw) ? raw : DEFAULT_ORIGIN;

    const subpath = Array.isArray(params.path) ? params.path.join("/") : "";
    const url = new URL(request.url);
    const target = origin + "/gamedata/" + subpath + url.search;

    const headers = new Headers(request.headers);
    ["host", "x-forwarded-host", "x-forwarded-proto", "cf-connecting-ip",
     "cf-ray", "cf-visitor", "cf-ipcountry", "cookie"].forEach(h => headers.delete(h));

    const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "follow",
    });

    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete("set-cookie");
    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
    });
}

function parseCookies(header) {
    const out = {};
    for (const part of header.split(/;\s*/)) {
        if (!part) continue;
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    return out;
}

function isAllowed(origin) {
    if (!ORIGIN_RE.test(origin)) return false;
    try {
        const host = new URL(origin).hostname;
        return !FORBIDDEN_HOST.test(host);
    } catch {
        return false;
    }
}
