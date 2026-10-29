// Rifthold OAuth token proxy Worker
//
// Proxies Google OAuth token exchanges for the browser client, injecting
// CLIENT_SECRET from Cloudflare's encrypted secrets store so it never
// appears in client-side code.
//
// Handles:
//   POST /token  (authorization_code and refresh_token exchanges)
//
// Deploy: paste into a new Cloudflare Worker, then run:
//   wrangler secret put CLIENT_SECRET
// and enter the value from your Google Cloud OAuth credential JSON.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Only allow requests from the game's origin. Exact origin match, except the
// local dev hosts, which may use any port. The Electron build also sends
// Origin: http://localhost from its main process.
const ALLOWED_ORIGINS = [
    'https://junekingsbury.github.io',
];
const ALLOWED_DEV_HOSTS = ['localhost', '127.0.0.1'];

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    let url;
    try { url = new URL(origin); } catch { return false; }
    // An Origin header is scheme://host[:port] only; anything else is malformed.
    if (url.origin !== origin) return false;
    return url.protocol === 'http:' && ALLOWED_DEV_HOSTS.includes(url.hostname);
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';

        // CORS preflight
        if (request.method === 'OPTIONS') {
            if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/token') {
            if (!isAllowedOrigin(origin)) {
                return new Response('Forbidden', { status: 403 });
            }

            // Read the client body and inject the secret.
            const body = await request.text();
            const params = new URLSearchParams(body);
            params.set('client_secret', env.CLIENT_SECRET);

            const googleResp = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });

            const responseBody = await googleResp.text();
            return new Response(responseBody, {
                status: googleResp.status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders(origin),
                },
            });
        }

        return new Response('Not found', { status: 404 });
    },
};
