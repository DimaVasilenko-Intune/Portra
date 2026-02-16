const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
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
  return process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : [
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
    title: 'OrbitDesk',
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('data:load', () => readData());
  ipcMain.handle('data:save', (_e, data) => {
    saveData(data);
    return { ok: true };
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
