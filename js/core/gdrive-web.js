// Google Drive integration for the browser (non-Electron) context.
// Uses OAuth2 PKCE so no client_secret is needed in browser JS.
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
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'gdrive_tokens';

// PKCE helpers
async function _pkceChallenge() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
    const resp = await fetch('https://oauth2.googleapis.com/token', {
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

async function _findFileId(filename) {
    const q = encodeURIComponent(`name='${filename}' and trashed=false`);
    const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.files?.[0]?.id || null;
}

export async function cloudRead(filename) {
    try {
        const fileId = await _findFileId(filename);
        if (!fileId) return null;
        const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        return resp.ok ? resp.text() : null;
    } catch { return null; }
}

export async function cloudWrite(filename, data) {
    try {
        const token = await _getAccessToken();
        const fileId = await _findFileId(filename);
        const metadata = fileId ? { name: filename } : { name: filename, parents: ['appDataFolder'] };
        const boundary = 'rifthold_gdrive_boundary';
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
            body,
        });
    } catch (e) {
        console.error('[GDrive web] cloudWrite error:', e.message);
    }
}

export async function cloudDelete(filename) {
    try {
        const fileId = await _findFileId(filename);
        if (fileId) await _driveRequest('DELETE', `https://www.googleapis.com/drive/v3/files/${fileId}`);
    } catch (e) {
        console.error('[GDrive web] cloudDelete error:', e.message);
    }
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

export function beginAuth() {
    return new Promise(async (resolve, reject) => {
        const { verifier, challenge } = await _pkceChallenge();
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

        const popup = window.open(authUrl.toString(), 'gdrive_auth', 'width=520,height=620,menubar=no,toolbar=no,location=yes');

        let resolved = false;
        function done(qs) {
            if (resolved) return;
            resolved = true;
            ch.close();
            clearInterval(pollTimer);
            const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
            const code = params.get('code');
            if (!code) { reject(new Error('No auth code')); return; }
            fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: CLIENT_ID,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                    code_verifier: verifier,
                }),
            })
            .then(r => r.json())
            .then(data => {
                if (!data.access_token) throw new Error(data.error || 'Token exchange failed');
                _saveTokens({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token || null,
                    expiry_date: Date.now() + (data.expires_in - 60) * 1000,
                });
                resolve(true);
            })
            .catch(reject);
        }

        const ch = new BroadcastChannel('rifthold_gdrive_auth');
        ch.addEventListener('message', e => done(e.data));

        // Also handle same-origin postMessage fallback from the callback page
        function onMessage(e) {
            if (e.origin !== location.origin || !e.data?.riftholdGdriveAuth) return;
            window.removeEventListener('message', onMessage);
            done(e.data.riftholdGdriveAuth);
        }
        window.addEventListener('message', onMessage);

        // Detect popup closed without completing auth
        const pollTimer = setInterval(() => {
            if (!resolved && popup && popup.closed) {
                resolved = true;
                ch.close();
                clearInterval(pollTimer);
                window.removeEventListener('message', onMessage);
                reject(new Error('Popup closed'));
            }
        }, 500);
    });
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
