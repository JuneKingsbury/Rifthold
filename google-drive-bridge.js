const { app, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

const crypto = require('crypto');

// Public OAuth client ID. Token exchanges go through the same Cloudflare Worker
// the browser build uses (see js/core/gdrive-web.js), which injects the client
// secret server-side, so no secret ships with the app.
const CLIENT_ID = '169773847895-lf82014dhkmiuqai9vdcv54r46q96nag.apps.googleusercontent.com';
const TOKEN_PROXY = 'https://rifthold-oauth.jurbanics.workers.dev/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
// The Worker only answers allowlisted Origins; Node's fetch sends none, so
// identify as the loopback redirect origin this flow already uses.
const LOOPBACK_ORIGIN = 'http://localhost';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function _tokensPath() {
    return path.join(app.getPath('userData'), 'gdrive-tokens.json');
}

function _loadTokens() {
    try {
        return JSON.parse(fs.readFileSync(_tokensPath(), 'utf8'));
    } catch {
        return null;
    }
}

function _saveTokens(tokens) {
    fs.writeFileSync(_tokensPath(), JSON.stringify(tokens), 'utf8');
}

async function _refreshTokens(tokens) {
    const resp = await _tokenRequest(LOOPBACK_ORIGIN, {
        client_id: CLIENT_ID,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
    });
    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);
    const data = await resp.json();
    const updated = {
        ...tokens,
        access_token: data.access_token,
        expiry_date: Date.now() + (data.expires_in - 60) * 1000,
    };
    _saveTokens(updated);
    return updated;
}

function _tokenRequest(origin, params) {
    return fetch(TOKEN_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': origin },
        body: new URLSearchParams(params),
    });
}

async function _getAccessToken() {
    let tokens = _loadTokens();
    if (!tokens) throw new Error('Not authenticated with Google Drive');
    if (Date.now() >= tokens.expiry_date) {
        tokens = await _refreshTokens(tokens);
    }
    return tokens.access_token;
}

async function _driveRequest(method, url, opts = {}) {
    const token = await _getAccessToken();
    const headers = { 'Authorization': `Bearer ${token}`, ...opts.headers };
    return fetch(url, { method, headers, body: opts.body });
}

// Resolves to the file ID, or null only when Drive reports no such file.
// HTTP errors throw, so callers never mistake a failed lookup for "not found"
// (which would make cloudWrite create a duplicate file).
async function _findFileId(filename) {
    const escaped = String(filename).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(`name='${escaped}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`;
    const resp = await _driveRequest('GET', url);
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

async function cloudRead(filename) {
    try {
        const fileId = await _findFileId(filename);
        if (!fileId) return null;
        const resp = await _driveRequest('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        if (!resp.ok) return null;
        return resp.text();
    } catch (e) {
        console.error('[GDrive] cloudRead error:', e.message);
        return null;
    }
}

function cloudWrite(filename, data) {
    return _enqueue(filename, () => _cloudWrite(filename, data));
}

async function _cloudWrite(filename, data) {
    try {
        const token = await _getAccessToken();
        const fileId = await _findFileId(filename);
        const metadata = fileId ? { name: filename } : { name: filename, parents: ['appDataFolder'] };
        const boundary = 'rifthold_gdrive_boundary';
        const body = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(metadata),
            `--${boundary}`,
            'Content-Type: application/json',
            '',
            data,
            `--${boundary}--`,
        ].join('\r\n');
        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        const resp = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary="${boundary}"`,
            },
            body,
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            console.error('[GDrive] cloudWrite error:', resp.status, text);
        }
    } catch (e) {
        console.error('[GDrive] cloudWrite error:', e.message);
    }
}

function cloudDelete(filename) {
    return _enqueue(filename, async () => {
        try {
            const fileId = await _findFileId(filename);
            if (!fileId) return;
            const resp = await _driveRequest('DELETE', `https://www.googleapis.com/drive/v3/files/${fileId}`);
            if (!resp.ok) console.error('[GDrive] cloudDelete error:', resp.status);
        } catch (e) {
            console.error('[GDrive] cloudDelete error:', e.message);
        }
    });
}

async function cloudList() {
    try {
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(name)&pageSize=100`;
        const resp = await _driveRequest('GET', url);
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.files || []).map(f => f.name);
    } catch (e) {
        console.error('[GDrive] cloudList error:', e.message);
        return [];
    }
}

function cloudEnabled() {
    const tokens = _loadTokens();
    return !!(tokens && tokens.refresh_token);
}

function _base64Url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _authPage(message) {
    return `<html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#ccc;"><h2>Rifthold: ${message}</h2><p>You can close this tab and return to the game.</p></body></html>`;
}

// Loopback OAuth flow with PKCE and a `state` check. Always settles: on
// success, on an error/denial from Google, or after AUTH_TIMEOUT_MS if the
// user abandons the browser tab.
function beginAuth() {
    return new Promise((resolve, reject) => {
        const verifier = _base64Url(crypto.randomBytes(32));
        const challenge = _base64Url(crypto.createHash('sha256').update(verifier).digest());
        const state = _base64Url(crypto.randomBytes(16));
        const server = http.createServer();
        let settled = false;
        // Set before the token exchange awaits, so a repeat callback (reload,
        // double redirect) can't re-exchange the single-use code and fail the
        // sign-in that is already succeeding.
        let exchanging = false;
        const finish = (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            server.close();
            if (err) reject(err); else resolve(true);
        };
        const timer = setTimeout(() => finish(new Error('Google sign-in timed out')), AUTH_TIMEOUT_MS);
        server.on('error', finish);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const redirectUri = `http://localhost:${port}`;
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
            shell.openExternal(authUrl.toString()).catch(finish);
            server.on('request', async (req, res) => {
                const reqUrl = new URL(req.url, redirectUri);
                // Ignore stray requests (favicon, forged callbacks) and keep waiting.
                if (reqUrl.pathname !== '/' || reqUrl.searchParams.get('state') !== state) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                if (settled || exchanging) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(_authPage(settled ? 'sign-in already finished' : 'already signing in'));
                    return;
                }
                const code = reqUrl.searchParams.get('code');
                if (!code) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(_authPage('Google Drive was not connected'));
                    return finish(new Error(reqUrl.searchParams.get('error') || 'No auth code received'));
                }
                exchanging = true;
                try {
                    const tokenResp = await _tokenRequest(LOOPBACK_ORIGIN, {
                        code,
                        client_id: CLIENT_ID,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                        code_verifier: verifier,
                    });
                    if (!tokenResp.ok) throw new Error(`Token exchange failed: ${tokenResp.status}`);
                    const tokenData = await tokenResp.json();
                    _saveTokens({
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expiry_date: Date.now() + (tokenData.expires_in - 60) * 1000,
                    });
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(_authPage('Google Drive connected!'));
                    finish();
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(_authPage('Google Drive connection failed'));
                    finish(e);
                }
            });
        });
    });
}

async function revokeAuth() {
    try {
        const tokens = _loadTokens();
        if (tokens && tokens.access_token) {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, { method: 'POST' }).catch(() => {});
        }
    } finally {
        try { fs.unlinkSync(_tokensPath()); } catch {}
    }
}

module.exports = { cloudEnabled, cloudRead, cloudWrite, cloudDelete, cloudList, beginAuth, revokeAuth };
