const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  quit: () => ipcRenderer.invoke('quit'),
  setFullscreen: (enabled) => ipcRenderer.invoke('set-fullscreen', enabled),
  isFullscreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullscreenChanged: (callback) => {
    ipcRenderer.on('fullscreen-changed', (event, isFullscreen) => callback(isFullscreen));
  },
  steam: {
    available: () => ipcRenderer.invoke('steam:available'),
    getPlayerInfo: () => ipcRenderer.invoke('steam:player-info'),
    getAchievements: () => ipcRenderer.invoke('steam:get-achievements'),
    activateAchievement: (name) => ipcRenderer.invoke('steam:activate-achievement', name),
    clearAchievement: (name) => ipcRenderer.invoke('steam:clear-achievement', name),
    getStatInt: (name) => ipcRenderer.invoke('steam:get-stat-int', name),
    setStatInt: (name, value) => ipcRenderer.invoke('steam:set-stat-int', name, value),
    storeStats: () => ipcRenderer.invoke('steam:store-stats'),
    cloudRead: (filename) => ipcRenderer.invoke('steam:cloud-read', filename),
    cloudWrite: (filename, data) => ipcRenderer.invoke('steam:cloud-write', filename, data),
    cloudDelete: (filename) => ipcRenderer.invoke('steam:cloud-delete', filename),
    cloudList: () => ipcRenderer.invoke('steam:cloud-list'),
    cloudEnabled: () => ipcRenderer.invoke('steam:cloud-enabled'),
    overlayStore: () => ipcRenderer.invoke('steam:overlay-store'),
    overlayUrl: (url) => ipcRenderer.invoke('steam:overlay-url', url),
  }
});
