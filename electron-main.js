const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const steamBridge = require('./steam-bridge');
const gdriveBridge = require('./google-drive-bridge');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true
  }
}]);

let mainWindow;

const APP_ORIGIN = 'app://game';

function isAppUrl(url) {
  try { return new URL(url).origin === APP_ORIGIN; } catch { return false; }
}

// External links go to the system browser; nothing but the app's own origin
// may load inside an app window (remote pages would get window.electronAPI).
function openExternalIfWeb(url) {
  try {
    const { protocol: scheme } = new URL(url);
    if (scheme === 'https:' || scheme === 'http:') shell.openExternal(url);
  } catch { /* malformed URL, ignore */ }
}

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternalIfWeb(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow' };
    openExternalIfWeb(url);
    return { action: 'deny' };
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 200,
    minHeight: 200,
    title: 'Rifthold',
    icon: path.join(__dirname, 'icons', 'RiftholdIcon2.png'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL(APP_ORIGIN + '/index.html');

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-changed', false);
  });
}

ipcMain.handle('set-fullscreen', (event, enabled) => {
  if (mainWindow) mainWindow.setFullScreen(enabled);
});

ipcMain.handle('is-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('quit', () => {
  app.quit();
});

ipcMain.handle('steam:available', () => steamBridge.steamAvailable);
ipcMain.handle('steam:player-info', () => steamBridge.getPlayerInfo());
ipcMain.handle('steam:get-achievements', () => steamBridge.getAchievements());
ipcMain.handle('steam:activate-achievement', (_, name) => steamBridge.activateAchievement(name));
ipcMain.handle('steam:clear-achievement', (_, name) => steamBridge.clearAchievement(name));
ipcMain.handle('steam:get-stat-int', (_, name) => steamBridge.getStatInt(name));
ipcMain.handle('steam:set-stat-int', (_, name, value) => steamBridge.setStatInt(name, value));
ipcMain.handle('steam:store-stats', () => steamBridge.storeStats());
ipcMain.handle('steam:cloud-read', (_, filename) => steamBridge.cloudRead(filename));
ipcMain.handle('steam:cloud-write', (_, filename, data) => steamBridge.cloudWrite(filename, data));
ipcMain.handle('steam:cloud-delete', (_, filename) => steamBridge.cloudDelete(filename));
ipcMain.handle('steam:cloud-list', () => steamBridge.cloudList());
ipcMain.handle('steam:cloud-enabled', () => steamBridge.cloudEnabled());
ipcMain.handle('steam:overlay-store', () => steamBridge.openOverlayStore());
ipcMain.handle('steam:overlay-url', (_, url) => steamBridge.openOverlayUrl(url));

// Mod file access is limited to known mod roots: the bundled mods folder, the
// default userData mods folder, and folders the user picked in the dialog
// (remembered across runs). Paths are realpath-checked so `..` segments and
// symlinks cannot escape a root.
function defaultModsDir() {
  return path.join(app.getPath('userData'), 'mods');
}

function pickedRootsPath() {
  return path.join(app.getPath('userData'), 'mods-roots.json');
}

function loadPickedRoots() {
  try {
    const list = JSON.parse(fs.readFileSync(pickedRootsPath(), 'utf8'));
    return Array.isArray(list) ? list.filter(p => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function rememberPickedRoot(dir) {
  const roots = loadPickedRoots();
  if (roots.includes(dir)) return;
  roots.push(dir);
  try { fs.writeFileSync(pickedRootsPath(), JSON.stringify(roots), 'utf8'); } catch {}
}

function realpathOrNull(p) {
  try { return fs.realpathSync(p); } catch { return null; }
}

function isInside(child, root) {
  const rel = path.relative(root, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

// Resolves a renderer-supplied file:// URL or path (relative paths are taken
// relative to the app dir, where ./mods lives) to a real path inside a mod
// root, or null if it does not exist or falls outside every root.
function resolveModPath(input) {
  if (typeof input !== 'string' || !input) return null;
  let p;
  try {
    p = input.startsWith('file://') ? require('url').fileURLToPath(input) : input;
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const real = realpathOrNull(path.resolve(__dirname, p));
  if (!real) return null;
  const roots = [path.join(__dirname, 'mods'), defaultModsDir(), ...loadPickedRoots()]
    .map(realpathOrNull)
    .filter(Boolean);
  return roots.some(root => isInside(real, root)) ? real : null;
}

ipcMain.handle('mods:default-path', () => {
  return require('url').pathToFileURL(defaultModsDir()).href;
});

ipcMain.handle('mods:scan-dir', (_, dirPath) => {
  const dir = resolveModPath(dirPath);
  if (!dir) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && resolveModPath(path.join(dir, e.name, 'manifest.json')))
      .map(e => e.name)
      .sort();
  } catch {
    return [];
  }
});

ipcMain.handle('mods:read-file', (_, fileUrl) => {
  const filePath = resolveModPath(fileUrl);
  if (!filePath) return null;
  try {
    if (!fs.statSync(filePath).isFile()) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('mods:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Mods Folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  const real = realpathOrNull(result.filePaths[0]);
  if (!real) return null;
  rememberPickedRoot(real);
  return require('url').pathToFileURL(real).href;
});

// Dev builds write straight into the source portraits/ folder (the skin editor
// workflow). Packaged builds live in a read-only asar, so ask where to save.
// Resolves to the written path, or null if the user cancelled.
ipcMain.handle('write-portrait', async (_, filename, base64Data) => {
  const safe = path.basename(String(filename));
  if (!safe.toLowerCase().endsWith('.png')) throw new Error('Portrait must be a .png file');
  let dest = path.join(__dirname, 'portraits', safe);
  if (app.isPackaged) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Portrait',
      defaultPath: path.join(app.getPath('pictures'), safe),
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return null;
    dest = result.filePath;
  }
  fs.writeFileSync(dest, Buffer.from(String(base64Data), 'base64'));
  return dest;
});

ipcMain.handle('gdrive:enabled',    () => gdriveBridge.cloudEnabled());
ipcMain.handle('gdrive:begin-auth', () => gdriveBridge.beginAuth());
ipcMain.handle('gdrive:revoke',     () => gdriveBridge.revokeAuth());
ipcMain.handle('gdrive:read',   (_, filename) => gdriveBridge.cloudRead(filename));
ipcMain.handle('gdrive:write',  (_, filename, data) => gdriveBridge.cloudWrite(filename, data));
ipcMain.handle('gdrive:delete', (_, filename) => gdriveBridge.cloudDelete(filename));
ipcMain.handle('gdrive:list',   () => gdriveBridge.cloudList());

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath;
    try {
      filePath = decodeURIComponent(url.pathname);
    } catch {
      return new Response('', { status: 400 });
    }
    if (filePath.startsWith('/')) filePath = filePath.slice(1);
    if (filePath.endsWith('/') || filePath.includes('\0')) {
      return new Response('', { status: 404 });
    }
    // Decoding can surface `..` or `/` from %2E/%2F, so check the resolved
    // path still sits inside the app dir.
    const fullPath = path.resolve(__dirname, filePath);
    if (!isInside(fullPath, __dirname) || fullPath === __dirname) {
      return new Response('', { status: 404 });
    }
    return net.fetch(pathToFileURL(fullPath).href);
  });

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, 'icons', 'RiftholdIcon2.png'));
  }

  createWindow();
  steamBridge.initialize(480);
});

// The game quits when its window closes on every platform (including macOS).
// window-all-closed is skipped when quitting via Cmd+Q or app.quit(), so Steam
// shutdown happens in will-quit, which fires on every exit path.
app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  steamBridge.shutdown();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
