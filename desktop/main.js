// Bobine pour Windows : une fenêtre qui affiche l'interface web intégrée.
const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

// l'interface est servie sous app://bobine/ (modules JS et stockage local fonctionnent comme sur un site)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web');

if (!app.requestSingleInstanceLock()) app.quit();
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 800, minHeight: 500,
    backgroundColor: '#05070B', title: 'Bobine', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true,
      allowRunningInsecureContent: true // serveurs maison en http://
    }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('app://bobine/index.html');
  // F11 = plein écran ; liens externes (Homepage, tableau de bord Jellyfin) dans le navigateur
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB)) return new Response('interdit', { status: 403 });
    if (!fs.existsSync(file)) return new Response('introuvable', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // appels vers Seerr faits par l'appli (Seerr refuse les appels directs d'une autre adresse) ; cookies gardés
  ipcMain.handle('bobine:request', async (_e, { method, url, body }) => {
    try {
      const r = await net.fetch(url, { method, body: body || undefined, headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' }, credentials: 'include', session: session.defaultSession });
      return { status: r.status, text: await r.text() };
    } catch { return { status: 0, text: '{"message":"Seerr injoignable"}' }; }
  });
  ipcMain.on('bobine:fullscreen', (_e, on) => win?.setFullScreen(!!on));
  createWindow();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
