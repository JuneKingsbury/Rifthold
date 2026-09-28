const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    bypassCSP: true
  }
}]);

let mainWindow;

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

  mainWindow.loadURL('app://game/index.html');

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

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);
    if (filePath.startsWith('/')) filePath = filePath.slice(1);
    if (filePath.endsWith('/')) {
      return new Response('', { status: 404 });
    }
    const fullPath = path.join(__dirname, filePath);
    return net.fetch(pathToFileURL(fullPath).href);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
