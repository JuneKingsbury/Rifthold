const { app, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Load OAuth2 credentials. The credential file is .gitignore'd; if absent,
// all exports return disabled/no-op so the game starts normally without Drive.
let CREDS = null;
try {
    CREDS = require('./client_secret_169773847895-lf82014dhkmiuqai9vdcv54r46q96nag.apps.googleusercontent.com.json').web;
} catch {
    console.warn('[GDrive] Credential file not found; Google Drive sync disabled.');
}

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
    const resp = await fetch(CREDS.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CREDS.client_id,
            client_secret: CREDS.client_secret,
            refresh_token: tokens.refresh_token,
            grant_type: 'refresh_token',
        }),
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

async function _findFileId(filename) {
    const q = encodeURIComponent(`name='${filename}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`;
    const resp = await _driveRequest('GET', url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.files?.[0]?.id || null;
}

async function cloudRead(filename) {
    if (!CREDS) return null;
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

async function cloudWrite(filename, data) {
    if (!CREDS) return;
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

async function cloudDelete(filename) {
    if (!CREDS) return;
    try {
        const fileId = await _findFileId(filename);
        if (!fileId) return;
        await _driveRequest('DELETE', `https://www.googleapis.com/drive/v3/files/${fileId}`);
    } catch (e) {
        console.error('[GDrive] cloudDelete error:', e.message);
    }
}

async function cloudList() {
    if (!CREDS) return [];
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
    if (!CREDS) return false;
    const tokens = _loadTokens();
    return !!(tokens && tokens.refresh_token);
}

function beginAuth() {
    return new Promise((resolve, reject) => {
        if (!CREDS) return reject(new Error('GDrive credentials not available'));
        const server = http.createServer();
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const redirectUri = `http://localhost:${port}`;
            const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
            authUrl.searchParams.set('client_id', CREDS.client_id);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.appdata');
            authUrl.searchParams.set('access_type', 'offline');
            authUrl.searchParams.set('prompt', 'consent');
            shell.openExternal(authUrl.toString());
            server.on('request', async (req, res) => {
                const reqUrl = new URL(req.url, `http://localhost:${port}`);
                const code = reqUrl.searchParams.get('code');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#ccc;"><h2>Rifthold: Google Drive connected!</h2><p>You can close this tab and return to the game.</p></body></html>');
                server.close();
                if (!code) return reject(new Error('No auth code received'));
                try {
                    const tokenResp = await fetch(CREDS.token_uri, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            code,
                            client_id: CREDS.client_id,
                            client_secret: CREDS.client_secret,
                            redirect_uri: redirectUri,
                            grant_type: 'authorization_code',
                        }),
                    });
                    if (!tokenResp.ok) throw new Error(`Token exchange failed: ${tokenResp.status}`);
                    const tokenData = await tokenResp.json();
                    _saveTokens({
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        expiry_date: Date.now() + (tokenData.expires_in - 60) * 1000,
                    });
                    resolve(true);
                } catch (e) {
                    reject(e);
                }
            });
        });
        server.on('error', reject);
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
