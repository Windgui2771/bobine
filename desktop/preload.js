// Pont entre l'interface et Windows (même nom que dans l'appli Android : window.AppNative)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('AppNative', {
  platform: () => 'windows',
  version: () => '0.3.2',
  request: (id, method, url, body) => ipcRenderer.invoke('bobine:request', { method, url, body }),
  // lecture : plein écran pendant la vidéo
  setLandscape: (on) => ipcRenderer.send('bobine:fullscreen', on)
});
