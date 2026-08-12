const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbit', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  openPortal: (payload) => ipcRenderer.invoke('portal:open', payload),
  signOutPortal: (payload) => ipcRenderer.invoke('portal:signOut', payload),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  hasAutoUpdates: () => ipcRenderer.invoke('app:autoUpdates'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  openReleases: () => ipcRenderer.invoke('app:openReleases')
});
