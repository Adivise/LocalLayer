const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let configWindow;
const presetFile = path.join(app.getPath('userData'), 'presets.json');

function ensurePresetFile() {
  if (!fs.existsSync(presetFile)) {
    fs.writeFileSync(presetFile, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function writePresets(data) {
  fs.writeFileSync(presetFile, JSON.stringify(data, null, 2), 'utf-8');
}

function readPresets() {
  ensurePresetFile();

  try {
    const raw = fs.readFileSync(presetFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read presets, resetting file.', error);
    const empty = {};
    writePresets(empty);
    return empty;
  }
}

function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 700,
    height: 720,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  configWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

/* ================= Overlay System ================= */

const overlays = new Map();
let nextOverlayId = 1;

function getVirtualBounds() {
  const displays = screen.getAllDisplays();

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }

  return { minX, minY, maxX, maxY };
}

function createOverlayWindow(opts) {
  const primary = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primary.workAreaSize;

  const winOptions = {
    frame: false,
    transparent: true,
    alwaysOnTop: !!opts.alwaysOnTop,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      backgroundThrottling: false
    }
  };

  const width = typeof opts.width === 'number' ? opts.width : 0;
  const height = typeof opts.height === 'number' ? opts.height : 0;
  const hasCustomSize = width > 0 && height > 0;

  if (hasCustomSize) {
    winOptions.width = width;
    winOptions.height = height;
    winOptions.x = typeof opts.x === 'number' ? opts.x : 0;
    winOptions.y = typeof opts.y === 'number' ? opts.y : 0;
  } else {
    winOptions.width = screenWidth;
    winOptions.height = screenHeight;
    winOptions.x = 0;
    winOptions.y = 0;
  }

  const win = new BrowserWindow(winOptions);

  win.loadURL(opts.url).catch(err => {
    console.error('Failed to load overlay URL:', opts.url, err);
  });

  if (opts.clickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }

  if (opts.alwaysOnTop) {
    win.setAlwaysOnTop(true, 'screen-saver');
  }

  /* ===== HIDE MODE = MOVE OFFSCREEN ONLY ===== */
  if (opts.hideFromDesktop) {
    const bounds = getVirtualBounds();
    const offscreenX = bounds.minX - winOptions.width - 500;
    win.setPosition(offscreenX, 0);
  }

  const id = String(nextOverlayId++);
  overlays.set(id, { win, opts });

  win.on('closed', () => {
    overlays.delete(id);
  });

  return id;
}

/* ================= IPC ================= */

ipcMain.on('create-overlay', (event, options) => {
  if (!options || !Array.isArray(options.urls)) return;
  const created = options.urls.map(opts => createOverlayWindow(opts));
  event.sender.send('overlays-created', created);
});

ipcMain.handle('list-overlays', () => {
  const list = [];
  overlays.forEach((value, key) => {
    list.push({
      id: key,
      url: value.opts.url,
      hidden: value.opts.hideFromDesktop === true
    });
  });
  return list;
});

ipcMain.handle('show-overlay', (event, id) => {
  const entry = overlays.get(String(id));
  if (!entry || entry.win.isDestroyed()) return { ok: false };

  entry.win.setPosition(0, 0);
  entry.win.show();
  return { ok: true };
});

ipcMain.handle('hide-overlay', (event, id) => {
  const entry = overlays.get(String(id));
  if (!entry || entry.win.isDestroyed()) return { ok: false };

  const bounds = getVirtualBounds();
  const [width] = entry.win.getSize();
  const offscreenX = bounds.minX - width - 500;

  entry.win.setPosition(offscreenX, 0);
  return { ok: true };
});

ipcMain.handle('destroy-overlay', (event, id) => {
  const entry = overlays.get(String(id));
  if (!entry) return { ok: false };

  if (!entry.win.isDestroyed()) {
    entry.win.close();
  }

  overlays.delete(String(id));
  return { ok: true };
});

/* ================= Presets ================= */

ipcMain.handle('save-preset', (event, { name, data }) => {
  const presets = readPresets();
  presets[name] = data;
  writePresets(presets);
  return presets;
});

ipcMain.handle('get-presets', () => readPresets());

ipcMain.handle('delete-preset', (event, name) => {
  const presets = readPresets();
  delete presets[name];
  writePresets(presets);
  return presets;
});

/* ================= App ================= */

app.whenReady().then(() => {
  ensurePresetFile();
  createConfigWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});