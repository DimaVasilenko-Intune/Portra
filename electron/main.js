const { app, BrowserWindow, Menu, ipcMain, shell, dialog, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { compareVersions, defaultData, isLaunchableUrl, sanitizeImportedData, parseCfgText } = require('./dataFormat');

// Enable WebAuthn / FIDO2 / security keys on all platforms
app.commandLine.appendSwitch('enable-features', 'WebAuthentication,WebAuthenticationConditionalUI');

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
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

// Set when the data file exists but cannot be decrypted. While this is set, saveData()
// refuses to overwrite the file — on macOS a changed code signature can revoke keychain
// access, and silently reseeding would destroy the customer list on the next write.
let dataReadError = null;

function readData() {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultData();
    saveData(seed);
    return { ...seed, readError: null, encryptionAvailable };
  }
  try {
    const buf = fs.readFileSync(DATA_FILE);
    const data = JSON.parse(decrypt(buf));
    dataReadError = null;
    return { ...data, readError: null, encryptionAvailable };
  } catch (err) {
    // Keep the unreadable file, plus a timestamped copy, so nothing is lost.
    const backup = `${DATA_FILE}.unreadable-${Date.now()}`;
    try { fs.copyFileSync(DATA_FILE, backup); } catch {}
    dataReadError = {
      message: err.message,
      backupPath: fs.existsSync(backup) ? backup : DATA_FILE,
      encryptionAvailable
    };
    return { customers: [], readError: dataReadError, encryptionAvailable };
  }
}

function saveData(data) {
  if (dataReadError) {
    throw new Error(`Refusing to overwrite unreadable data file. Backup: ${dataReadError.backupPath}`);
  }
  const { readError, encryptionAvailable, ...clean } = data || {};
  fs.writeFileSync(DATA_FILE, encrypt(JSON.stringify(clean, null, 2)));
}

/* ── Internal Portra browser ──────────────────────────────────────── */

// A real Chrome UA for the host platform. Electron's default UA contains "Electron", which
// makes Microsoft sign-in hide passkey/security-key options. The platform token must match the
// actual OS — claiming Windows on a Mac makes Entra offer Windows Hello, which does not exist
// there.
const CHROME_MAJOR = process.versions.chrome.split('.')[0];

function chromeUserAgent() {
  const platformToken = isMac
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
}

// Permissions a Microsoft admin portal legitimately needs. Everything else is denied —
// portal windows load arbitrary remote content, so blanket approval is not acceptable.
//
// 'bluetooth' is here for sign-in, not for pages that want to talk to gadgets: the passkey
// hybrid transport ("use your phone") reaches the phone over BLE, and denying this leaves the
// user stuck on Entra's "the device will open a security window" screen with no window ever
// appearing. The matching Info.plist usage string is already shipped for the same reason.
const ALLOWED_PERMISSIONS = new Set([
  'clipboard-read',
  'clipboard-sanitized-write',
  'fullscreen',
  'hid',
  'usb',
  'bluetooth'
]);

const configuredSessions = new Set();

function configureSession(ses) {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);

  ses.setUserAgent(chromeUserAgent());

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  // Security keys reach us over HID/USB when plugged in, and over BLE for phone-as-passkey.
  const AUTHENTICATOR_TRANSPORTS = new Set(['hid', 'usb', 'bluetooth']);
  ses.setDevicePermissionHandler(({ deviceType }) => AUTHENTICATOR_TRANSPORTS.has(deviceType));
}

function createPortalWindow(ses, title) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title,
    autoHideMenuBar: true,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  // Portal redirects and login flows navigate freely, but only over https.
  win.webContents.on('will-navigate', (e, navUrl) => {
    if (!isLaunchableUrl(navUrl)) e.preventDefault();
  });

  // Sign-in and consent flows use popups. Give them a real window in the same isolated
  // session instead of replacing the page the user is on.
  win.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    if (!isLaunchableUrl(popupUrl)) return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 600,
        height: 750,
        title,
        autoHideMenuBar: true,
        webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true }
      }
    };
  });

  // Apply the same https-only guard to popups the handler above allowed.
  win.webContents.on('did-create-window', (child) => {
    child.webContents.on('will-navigate', (e, navUrl) => {
      if (!isLaunchableUrl(navUrl)) e.preventDefault();
    });
  });

  win.webContents.setVisualZoomLevelLimits(1, 3);
  return win;
}

// Second line of defence. Imports are sanitised, but the partition name is the isolation
// boundary, so never build one from an id that has not been checked right here.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function partitionFor(customerId) {
  if (!SAFE_ID.test(String(customerId ?? ''))) return null;
  return `persist:workspace-${customerId}`;
}

function openPortalInternal({ customerId, url, customerName, portalName }) {
  if (!isLaunchableUrl(url)) return { ok: false, error: 'Only https URLs can be opened.' };

  // Each customer gets an isolated Electron session: separate cookies, localStorage and
  // auth state, so no system browser profile or other tenant's session leaks in.
  const partition = partitionFor(customerId);
  if (!partition) return { ok: false, error: 'This customer has an invalid id and cannot be opened.' };

  const ses = session.fromPartition(partition);
  configureSession(ses);

  const title = [customerName, portalName].filter(Boolean).join(' — ') || 'Portra Browser';
  createPortalWindow(ses, title).loadURL(url);
  return { ok: true };
}

/* ── Update checks ────────────────────────────────────────────────── */

const RELEASES_PAGE = 'https://github.com/DimaVasilenko-Intune/Portra/releases/latest';
const RELEASES_API = 'https://api.github.com/repos/DimaVasilenko-Intune/Portra/releases/latest';

// Automatic updates are unavailable on macOS while the app is unsigned, so the version check
// has to be explicit. This is the only network request Portra itself makes, it sends nothing
// beyond the request, and it only runs when asked.
function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const req = require('https').get(
      RELEASES_API,
      { headers: { 'User-Agent': `Portra/${app.getVersion()}`, Accept: 'application/vnd.github+json' }, timeout: 10000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GitHub returned ${res.statusCode}`));
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const tag = JSON.parse(body).tag_name;
            if (!tag) throw new Error('No tag_name in response');
            resolve(String(tag));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

async function checkForUpdate() {
  const current = app.getVersion();
  try {
    const latest = await fetchLatestVersion();
    return {
      ok: true,
      current,
      latest: latest.replace(/^v/, ''),
      updateAvailable: compareVersions(latest, current) > 0,
      releasesUrl: RELEASES_PAGE
    };
  } catch (err) {
    return { ok: false, current, error: err.message, releasesUrl: RELEASES_PAGE };
  }
}

/* ── Auto-updater ─────────────────────────────────────────────────── */

function setupAutoUpdates() {
  if (isDev) return;

  // On macOS, Squirrel refuses to apply an update unless both the running app and the
  // update are signed with a Developer ID certificate. Until Portra is signed and
  // notarized, skip the updater instead of failing silently on every launch.
  if (isMac && !process.env.PORTRA_ENABLE_MAC_UPDATER) return;

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

  autoUpdater.on('error', () => {});

  autoUpdater.checkForUpdates().catch(() => {});
}

/* ── Application menu ─────────────────────────────────────────────── */

// Portal windows have no browser chrome, so Back / Forward / Reload / Copy URL live in the
// menu and on the usual keyboard shortcuts. Without this a portal window is a dead end.
function buildMenu() {
  const portalWindow = () => {
    const win = BrowserWindow.getFocusedWindow();
    return win && win.webContents.getURL().startsWith('https:') ? win : null;
  };

  const checkForUpdateItem = {
    label: 'Check for Updates…',
    click: async () => {
      const result = await checkForUpdate();
      if (!result.ok) {
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Could not check for updates',
          message: 'Portra could not reach GitHub to check for a newer version.',
          detail: result.error
        });
        return;
      }
      if (!result.updateAvailable) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Portra is up to date',
          message: `You are running the latest version (${result.current}).`
        });
        return;
      }
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Open releases page', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update available',
        message: `Portra ${result.latest} is available. You are running ${result.current}.`,
        detail: isMac
          ? 'Portra cannot update itself on macOS while it is unsigned. Download the new version, then run:\n\nxattr -dr com.apple.quarantine /Applications/Portra.app'
          : undefined
      });
      if (response === 0) shell.openExternal(result.releasesUrl);
    }
  };

  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            checkForUpdateItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        ...(isMac ? [] : [checkForUpdateItem, { type: 'separator' }, { role: 'quit' }])
      ]
    },
    { role: 'editMenu' },
    {
      label: 'Portal',
      submenu: [
        {
          label: 'Back',
          accelerator: isMac ? 'Cmd+[' : 'Alt+Left',
          click: () => portalWindow()?.webContents.navigationHistory.goBack()
        },
        {
          label: 'Forward',
          accelerator: isMac ? 'Cmd+]' : 'Alt+Right',
          click: () => portalWindow()?.webContents.navigationHistory.goForward()
        },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Copy Current URL',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            const win = portalWindow();
            if (win) require('electron').clipboard.writeText(win.webContents.getURL());
          }
        },
        {
          label: 'Open in Default Browser',
          click: () => {
            const win = portalWindow();
            if (win) shell.openExternal(win.webContents.getURL());
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    { role: 'windowMenu' }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ── Main window ──────────────────────────────────────────────────── */

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 600,
    minHeight: 400,
    title: 'Portra',
    backgroundColor: '#0b1020',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
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

  // The app shell is entirely local. Lock it down in packaged builds; the Vite dev server
  // needs inline scripts and a websocket, so leave dev alone.
  if (!isDev) {
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'"]
        }
      });
    });
  }

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev && devServerUrl) return win.loadURL(devServerUrl);
  if (fs.existsSync(distIndex)) return win.loadFile(distIndex);

  return win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h2 style="font-family:sans-serif;padding:40px">Portra build missing — run: npm run build</h2>'));
}

/* ── App ready ────────────────────────────────────────────────────── */

// Two instances writing customers.enc would clobber each other's changes.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  migrateIfNeeded();

  ipcMain.handle('data:load', () => readData());
  ipcMain.handle('data:save', (_e, data) => {
    try {
      saveData(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('data:export', async (_e, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Portra data',
      defaultPath: 'portra-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const { readError, ...clean } = data || {};
    fs.writeFileSync(filePath, JSON.stringify(clean, null, 2));
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
      if (!sanitized.customers.length) throw new Error('No customers found in file');

      // Import replaces the whole workspace, so confirm before discarding what is there.
      const existing = readData();
      if (existing.customers?.length) {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Replace', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          title: 'Replace all Portra data?',
          message: `Import ${sanitized.customers.length} customer(s) from ${path.basename(filePath)}?`,
          detail: `This replaces your current ${existing.customers.length} customer(s). Export first if you want a backup.`
        });
        if (response !== 0) return { ok: false, canceled: true };
      }

      saveData(sanitized);
      return { ok: true, data: sanitized, filePath };
    } catch (err) {
      return { ok: false, error: `Import failed: ${err.message}` };
    }
  });

  ipcMain.handle('portal:open', (_e, payload) => openPortalInternal(payload || {}));

  // Signing out is the only way to get a workspace's credentials off disk. Portal session
  // cookies and the tokens portals keep in localStorage are stored unencrypted by Chromium —
  // see docs/SECURITY.md — so a workspace left signed in is a credential sitting on disk.
  ipcMain.handle('portal:signOut', async (_e, { customerId, customerName } = {}) => {
    const partition = partitionFor(customerId);
    if (!partition) return { ok: false, error: 'Invalid customer id.' };

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Sign out', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Sign out of workspace',
      message: `Sign out of ${customerName || 'this workspace'}?`,
      detail: 'Clears cookies, tokens and cached site data for this customer only. Your portal list and username are kept.'
    });
    if (response !== 0) return { ok: false, canceled: true };

    const ses = session.fromPartition(partition);

    // Close this workspace's windows first, or the pages just write their state back.
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.session === ses) win.destroy();
    }

    try {
      await ses.clearStorageData();
      await ses.clearCache();
      await ses.clearAuthCache();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);
  // Auto-updates only work where the app is signed, so tell the renderer which it is.
  ipcMain.handle('app:autoUpdates', () => !isMac);
  ipcMain.handle('app:checkUpdate', () => checkForUpdate());
  ipcMain.handle('app:openReleases', () => shell.openExternal(RELEASES_PAGE));

  buildMenu();
  createWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
