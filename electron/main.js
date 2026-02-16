const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const DATA_FILE = path.join(app.getPath('userData'), 'customers.json');

function defaultData() {
  return {
    customers: [
      {
        id: 'sample-1',
        name: 'Sample Customer',
        portals: [
          { name: 'Azure', url: 'https://portal.azure.com', username: '' },
          { name: 'M365 Admin', url: 'https://admin.microsoft.com', username: '' }
        ]
      }
    ]
  };
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return defaultData(); }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function chromeCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  }

  return [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge'
  ];
}

function findBrowser() {
  return chromeCandidates().find((p) => fs.existsSync(p));
}

function openWithProfile({ customerId, url }) {
  const browserPath = findBrowser();
  if (!browserPath) return shell.openExternal(url);

  const profileRoot = path.join(app.getPath('userData'), 'profiles', customerId);
  fs.mkdirSync(profileRoot, { recursive: true });

  const args = [
    `--user-data-dir=${profileRoot}`,
    '--new-window',
    url
  ];

  const child = spawn(browserPath, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Portra',
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev && devServerUrl) {
    win.loadURL(devServerUrl);
    return;
  }

  if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex);
    return;
  }

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<h2>Portra build mangler</h2><p>Kjør: npm run build</p>'
  ));
}

app.whenReady().then(() => {
  ipcMain.handle('data:load', () => readData());
  ipcMain.handle('data:save', (_e, data) => {
    saveData(data);
    return { ok: true };
  });
  ipcMain.handle('data:export', async (_e, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Portra data',
      defaultPath: 'portra-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { ok: true, filePath };
  });
  ipcMain.handle('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Portra data',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };

    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed || !Array.isArray(parsed.customers)) {
        return { ok: false, error: 'Invalid format: expected { customers: [] }' };
      }
      saveData(parsed);
      return { ok: true, data: parsed, filePath: filePaths[0] };
    } catch (err) {
      return { ok: false, error: `Import failed: ${err.message}` };
    }
  });
  ipcMain.handle('portal:open', (_e, payload) => {
    openWithProfile(payload);
    return { ok: true };
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
