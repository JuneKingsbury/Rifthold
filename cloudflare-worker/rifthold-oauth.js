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

// Only allow requests from the game's origin.
const ALLOWED_ORIGINS = [
    'https://junekingsbury.github.io',
    'http://localhost',        // local dev
    'http://127.0.0.1',       // local dev
];

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function isAllowedOrigin(origin) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o));
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
