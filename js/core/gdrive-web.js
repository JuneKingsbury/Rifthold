// Google Drive integration for the browser (non-Electron) context.
// Uses OAuth2 PKCE. Token exchanges go through a Cloudflare Worker proxy so
// the client_secret never appears in client-side code.
//
// getGdriveAPI() returns the right implementation for the current context:
//   Electron  => window.electronAPI.gdrive (IPC bridge)
//   Browser   => this module
//   Capacitor => this module (enabled() returns false, all ops no-op)
export function getGdriveAPI() {
    return window.electronAPI?.gdrive || webGdriveAPI;
}

// Defined at bottom of file after all functions are declared.
let webGdriveAPI;

const CLIENT_ID = '169773847895-lf82014dhkmiuqai9vdcv54r46q96nag.apps.googleusercontent.com';
// Token exchanges are proxied through this Worker, which injects CLIENT_SECRET
// server-side. Replace with your own Worker URL after deploying.
const TOKEN_PROXY = 'https://rifthold-oauth.jurbanics.workers.dev/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'gdrive_tokens';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

// PKCE helpers
function _randomBase64Url(bytes) {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _pkceChallenge() {
    const verifier = _randomBase64Url(32);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { verifier, challenge };
}

function _loadTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; }
}

function _saveTokens(t) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

async function _refreshTokens(tokens) {
    // PKCE tokens don't support refresh_token on public clients unless granted
    // offline access. If refresh fails, clear tokens so the user re-auths.
    const resp = await fetch(TOKEN_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            refresh_token: tokens.refresh_token,
            grant_type: 'refresh_token',
        }),
    });
    if (!resp.ok) { localStorage.removeItem(TOKEN_KEY); throw new Error('Refresh failed'); }
    const data = await resp.json();
    const updated = { ...tokens, access_token: data.access_token, expiry_date: Date.now() + (data.expires_in - 60) * 1000 };
    _saveTokens(updated);
    return updated;
}

async function _getAccessToken() {
    let tokens = _loadTokens();
    if (!tokens) throw new Error('Not authenticated');
    if (Date.now() >= tokens.expiry_date) tokens = await _refreshTokens(tokens);
    return tokens.access_token;
}

async function _driveRequest(method, url, opts = {}) {
    const token = await _getAccessToken();
    return fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, ...opts.headers }, body: opts.body });
}

// Resolves to the file ID, or null only when Drive reports no such file.
// HTTP errors throw, so a failed lookup never reads as "not found" (which
// would make cloudWrite create a duplicate file).
async function _findFileId(filename) {
    const escaped = String(filename).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(`name='${escaped}' and trashed=false`);
    const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    if (!resp.ok) throw new Error(`File lookup failed: ${resp.status}`);
    const data = await resp.json();
    return data.files?.[0]?.id || null;
}

// Per-filename queue so overlapping writes/deletes of one file run in order
// instead of racing the lookup-then-create step.
const _fileQueues = new Map();

function _enqueue(filename, task) {
    const prev = _fileQueues.get(filename) || Promise.resolve();
    const next = prev.then(task, task);
    _fileQueues.set(filename, next);
    next.finally(() => { if (_fileQueues.get(filename) === next) _fileQueues.delete(filename); });
    return next;
}

export async function cloudRead(filename) {
    try {
        const fileId = await _findFileId(filename);
        if (!fileId) return null;
        const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        return resp.ok ? resp.text() : null;
    } catch { return null; }
}

export function cloudWrite(filename, data) {
    return _enqueue(filename, () => _cloudWrite(filename, data));
}

async function _cloudWrite(filename, data) {
    try {
        const token = await _getAccessToken();
        const fileId = await _findFileId(filename);
        const metadata = fileId ? { name: filename } : { name: filename, parents: ['appDataFolder'] };
        const boundary = 'rifthold_gdrive_boundary';
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        const resp = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
            body,
        });
        if (!resp.ok) console.error('[GDrive web] cloudWrite error:', resp.status);
    } catch (e) {
        console.error('[GDrive web] cloudWrite error:', e.message);
    }
}

export function cloudDelete(filename) {
    return _enqueue(filename, async () => {
        try {
            const fileId = await _findFileId(filename);
            if (fileId) await _driveRequest('DELETE', `https://www.googleapis.com/drive/v3/files/${fileId}`);
        } catch (e) {
            console.error('[GDrive web] cloudDelete error:', e.message);
        }
    });
}

export async function cloudList() {
    try {
        const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(name)&pageSize=100`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.files || []).map(f => f.name);
    } catch { return []; }
}

export function enabled() {
    const tokens = _loadTokens();
    return Promise.resolve(!!(tokens && tokens.refresh_token));
}

// Popup PKCE flow with a `state` check. Always settles: on success, on an
// error/denial, when the popup is blocked or closed, or after AUTH_TIMEOUT_MS.
export async function beginAuth() {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Google sign-in needs a secure (https) page');
    }
    const { verifier, challenge } = await _pkceChallenge();
    const state = _randomBase64Url(16);
    const redirectUri = new URL('oauth-callback.html', location.href).href;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPE);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    const popup = window.open(authUrl.toString(), 'gdrive_auth', 'width=520,height=620,menubar=no,toolbar=no,location=yes');
    if (!popup) throw new Error('Popup blocked. Allow popups for this site and try again.');

    const qs = await new Promise((resolve, reject) => {
        let ch = null;
        let finished = false;
        function finish(err, value) {
            if (finished) return;
            finished = true;
            if (ch) ch.close();
            clearInterval(pollTimer);
            clearTimeout(timeoutTimer);
            window.removeEventListener('message', onMessage);
            if (err) reject(err); else resolve(value);
        }
        // Messages whose state doesn't match are ignored (stale tab or forged
        // callback), so the flow keeps waiting for the real one.
        function onResult(raw) {
            if (typeof raw !== 'string') return;
            const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
            if (params.get('state') !== state) return;
            finish(null, params);
        }
        function onMessage(e) {
            if (e.origin !== location.origin || !e.data?.riftholdGdriveAuth) return;
            onResult(e.data.riftholdGdriveAuth);
        }

        try {
            ch = new BroadcastChannel('rifthold_gdrive_auth');
            ch.addEventListener('message', e => onResult(e.data));
        } catch { /* BroadcastChannel unavailable; postMessage fallback below */ }
        // Also handle same-origin postMessage fallback from the callback page
        window.addEventListener('message', onMessage);

        // Detect popup closed without completing auth
        const pollTimer = setInterval(() => {
            if (popup.closed) finish(new Error('Popup closed'));
        }, 500);
        const timeoutTimer = setTimeout(() => finish(new Error('Google sign-in timed out')), AUTH_TIMEOUT_MS);
    });

    const code = qs.get('code');
    if (!code) throw new Error(qs.get('error') || 'No auth code');
    const resp = await fetch(TOKEN_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier,
        }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) throw new Error(data.error || 'Token exchange failed');
    _saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        expiry_date: Date.now() + (data.expires_in - 60) * 1000,
    });
    return true;
}

export async function revoke() {
    try {
        const tokens = _loadTokens();
        if (tokens?.access_token) {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, { method: 'POST' }).catch(() => {});
        }
    } finally {
        localStorage.removeItem(TOKEN_KEY);
    }
}

webGdriveAPI = { cloudRead, cloudWrite, cloudDelete, cloudList, enabled, beginAuth, revoke };
