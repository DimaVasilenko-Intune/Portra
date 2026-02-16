const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const DATA_FILE = path.join(app.getPath('userData'), 'customers.enc');
const DATA_FILE_LEGACY = path.join(app.getPath('userData'), 'customers.json');

function encrypt(plaintext) {
  if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(plaintext);
  return Buffer.from(plaintext, 'utf-8');
}

function decrypt(buffer) {
  if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buffer);
  return buffer.toString('utf-8');
}

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

function sanitizeImportedData(parsed) {
  const customers = Array.isArray(parsed?.customers) ? parsed.customers : [];
  return {
    customers: customers
      .filter((c) => c && typeof c.name === 'string')
      .map((c) => ({
        id: c.id || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
        name: c.name.trim() || 'Customer',
        portals: Array.isArray(c.portals)
          ? c.portals
              .filter((p) => p && typeof p.name === 'string' && typeof p.url === 'string')
              .map((p) => ({
                name: p.name.trim(),
                url: p.url.trim(),
                username: typeof p.username === 'string' ? p.username : ''
              }))
          : []
      }))
  };
}

function parseCfgText(text) {
  // 1) JSON with .cfg extension (Portals exports often use this)
  try {
    const parsed = JSON.parse(text);

    // Portra-native format
    if (parsed?.customers) return sanitizeImportedData(parsed);

    // Portals-like format: { "users-data": [ { name, friendlyName, tenant, ... } ] }
    const users = Array.isArray(parsed?.['users-data']) ? parsed['users-data'] : [];
    if (users.length) {
      const defaultPortals = [
        { name: 'Azure', url: 'https://portal.azure.com' },
        { name: 'Intune', url: 'https://intune.microsoft.com' },
        { name: 'Admin Center', url: 'https://admin.microsoft.com' },
        { name: 'Security Center', url: 'https://security.microsoft.com' },
        { name: 'Entra', url: 'https://entra.microsoft.com' }
      ];

      const customers = users.map((u, idx) => {
        const customerName = u.friendlyName || u.tenant || u.name || `Customer ${idx + 1}`;
        const username = typeof u.name === 'string' ? u.name : '';
        return {
          id: `${Date.now()}-${Math.random()}-${idx}`,
          name: String(customerName),
          portals: defaultPortals.map((p) => ({ ...p, username }))
        };
      });

      return { customers };
    }
  } catch {}

  // 2) INI-like sections: [Customer Name], lines: PortalName=https://url
  const lines = text.split(/\r?\n/);
  const customers = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const section = line.match(/^\[(.+?)\]$/);
    if (section) {
      current = { id: `${Date.now()}-${Math.random()}`, name: section[1], portals: [] };
      customers.push(current);
      continue;
    }

    const kv = line.match(/^([^=]+)=(.+)$/);
    if (kv && current) {
      current.portals.push({ name: kv[1].trim(), url: kv[2].trim(), username: '' });
      continue;
    }

    // 3) CSV-ish fallback: customer,portal,url,username
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      const [customerName, portalName, url, username = ''] = parts;
      let customer = customers.find((c) => c.name === customerName);
      if (!customer) {
        customer = { id: `${Date.now()}-${Math.random()}`, name: customerName, portals: [] };
        customers.push(customer);
      }
      customer.portals.push({ name: portalName, url, username });
    }
  }

  if (!customers.length) throw new Error('Unsupported .cfg format');
  return { customers };
}

function migrateIfNeeded() {
  if (fs.existsSync(DATA_FILE_LEGACY) && !fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE_LEGACY, 'utf-8');
      JSON.parse(raw);
      fs.writeFileSync(DATA_FILE, encrypt(raw));
      fs.unlinkSync(DATA_FILE_LEGACY);
    } catch {}
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
  fs.writeFileSync(DATA_FILE, encrypt(JSON.stringify(data, null, 2)));
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
  return ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
}

function findBrowser() {
  return chromeCandidates().find((p) => fs.existsSync(p));
}

function openWithProfile({ customerId, url }) {
  const browserPath = findBrowser();
  if (!browserPath) return shell.openExternal(url);

  const profileRoot = path.join(app.getPath('userData'), 'profiles', customerId);
  fs.mkdirSync(profileRoot, { recursive: true });

  const child = spawn(browserPath, [`--user-data-dir=${profileRoot}`, '--new-window', url], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

function setupAutoUpdates() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async () => {
    const res = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Portra update ready',
      message: 'A new Portra version is downloaded and ready to install.'
    });
    if (res.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', () => {
    // Keep silent in production; updater should never break core app.
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

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

  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev && devServerUrl) return win.loadURL(devServerUrl);
  if (fs.existsSync(distIndex)) return win.loadFile(distIndex);

  return win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h2 style="font-family:sans-serif;padding:40px">Portra build missing — run: npm run build</h2>'));
}

app.whenReady().then(() => {
  migrateIfNeeded();

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
      filters: [
        { name: 'Portra/Portals Config', extensions: ['json', 'cfg'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'CFG', extensions: ['cfg'] }
      ]
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };

    try {
      const filePath = filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let parsed;
      if (ext === '.cfg') {
        parsed = parseCfgText(content);
      } else {
        parsed = JSON.parse(content);
      }

      const sanitized = sanitizeImportedData(parsed);
      if (!Array.isArray(sanitized.customers)) throw new Error('Invalid format: expected customers[]');

      saveData(sanitized);
      return { ok: true, data: sanitized, filePath };
    } catch (err) {
      return { ok: false, error: `Import failed: ${err.message}` };
    }
  });

  ipcMain.handle('portal:open', (_e, payload) => {
    openWithProfile(payload);
    return { ok: true };
  });

  ipcMain.handle('app:version', () => app.getVersion());

  createWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
