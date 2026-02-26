// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let configWindow;
const overlayPairs = [];

const presetFile = path.join(app.getPath('userData'), 'presets.json');

function ensurePresetFile() {
  if (!fs.existsSync(presetFile)) {
    fs.writeFileSync(presetFile, JSON.stringify({}, null, 2));
  }
}

function readPresets() {
  ensurePresetFile();
  return JSON.parse(fs.readFileSync(presetFile, 'utf-8'));
}

function writePresets(data) {
  fs.writeFileSync(presetFile, JSON.stringify(data, null, 2), 'utf-8');
}

function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 600,
    height: 650,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  configWindow.loadFile('src/index.html');
}

function createOverlayWindows(opts) {
  let winOptions = {
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      backgroundThrottling: false,
    }
  };

  if (opts.advanced && opts.width && opts.height) {
    winOptions.width = opts.width;
    winOptions.height = opts.height;
  } else {
    winOptions.fullscreen = true;
  }

  const win = new BrowserWindow(winOptions);
  win.loadURL(opts.fullscreenUrl);

  if (opts.clickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }

  overlayPairs.push({ win });
}

ipcMain.on('create-overlay', (event, options) => {
  if (Array.isArray(options.urls)) {
    options.urls.forEach(item => {
      createOverlayWindows({
        fullscreenUrl: item.url,
        clickThrough: item.clickThrough,
        advanced: item.advanced,
        width: item.width,
        height: item.height
      });
    });
  }
});

ipcMain.handle('save-preset', (event, { name, data }) => {
  const presets = readPresets();
  presets[name] = data;
  writePresets(presets);
  return presets;
});

ipcMain.handle('get-presets', () => {
  return readPresets();
});

ipcMain.handle('delete-preset', (event, name) => {
  const presets = readPresets();
  delete presets[name];
  writePresets(presets);
  return presets;
});

app.whenReady().then(() => {
  ensurePresetFile();
  createConfigWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});