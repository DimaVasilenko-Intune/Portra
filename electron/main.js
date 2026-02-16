const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const DATA_FILE = path.join(app.getPath('userData'), 'customers.enc');
const DATA_FILE_LEGACY = path.join(app.getPath('userData'), 'customers.json');

// ---------------------------------------------------------------------------
// Encryption helpers — uses Electron safeStorage (OS keychain-backed)
// Falls back to plaintext if safeStorage is unavailable (e.g. headless Linux)
// ---------------------------------------------------------------------------
function encrypt(plaintext) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plaintext);
  }
  return Buffer.from(plaintext, 'utf-8');
}

function decrypt(buffer) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buffer);
  }
  return buffer.toString('utf-8');
}

// ---------------------------------------------------------------------------
// Data persistence
// ---------------------------------------------------------------------------
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

function migrateIfNeeded() {
  // Migrate plaintext customers.json → encrypted customers.enc
  if (fs.existsSync(DATA_FILE_LEGACY) && !fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE_LEGACY, 'utf-8');
      JSON.parse(raw); // validate
      fs.writeFileSync(DATA_FILE, encrypt(raw));
      fs.unlinkSync(DATA_FILE_LEGACY);
    } catch { /* ignore bad legacy file */ }
  }
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultData();
    saveData(seed);
    return seed;
  }
  try {
    const buf = fs.readFileSync(DATA_FILE);
    return JSON.parse(decrypt(buf));
  } catch {
    return defaultData();
  }
}

function saveData(data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(DATA_FILE, encrypt(json));
}

// ---------------------------------------------------------------------------
// Browser profile launcher
// ---------------------------------------------------------------------------
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

  const child = spawn(browserPath, [
    `--user-data-dir=${profileRoot}`,
    '--new-window',
    url
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 600,
    minHeight: 400,
    title: 'Portra',
    backgroundColor: '#0b1020',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  // Security: restrict navigation and new windows
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

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
    '<h2 style="font-family:sans-serif;padding:40px">Portra build missing — run: npm run build</h2>'
  ));
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  migrateIfNeeded();

  // --- Data CRUD ---
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
    // Export is intentionally plaintext so user can read/edit
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

  // --- Portal ---
  ipcMain.handle('portal:open', (_e, payload) => {
    openWithProfile(payload);
    return { ok: true };
  });

  // --- App info ---
  ipcMain.handle('app:version', () => app.getVersion());

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
