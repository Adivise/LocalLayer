const { ipcRenderer } = require('electron');

const form = document.getElementById('overlay-form');
const addUrlBtn = document.getElementById('addUrl');
const urlContainer = document.getElementById('url-container');

const presetNameInput = document.getElementById('presetName');
const presetSelect = document.getElementById('presetSelect');
const savePresetBtn = document.getElementById('savePreset');
const deletePresetBtn = document.getElementById('deletePreset');

const refreshActiveBtn = document.getElementById('refreshActive');
const activeListContainer = document.getElementById('active-list');

// --- Helper Functions ---
function toIntOrZero(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function collectOptions() {
  const rows = document.querySelectorAll('.url-row');
  const urls = Array.from(rows, row => {
    const urlInput = row.querySelector('.fullscreenUrl');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) return null;

    const clickThrough = row.querySelector('.row-clickthrough')?.checked ?? false;
    const alwaysOnTop = row.querySelector('.row-alwaysontop')?.checked ?? false;

    const width = toIntOrZero(row.querySelector('.adv-width')?.value);
    const height = toIntOrZero(row.querySelector('.adv-height')?.value);
    const x = toIntOrZero(row.querySelector('.adv-x')?.value);
    const y = toIntOrZero(row.querySelector('.adv-y')?.value);

    return {
      url, clickThrough, alwaysOnTop, width, height, x, y
    };
  }).filter(Boolean);

  return { urls };
}

function createUrlRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'url-row';

  row.innerHTML = `
    <div class="input-wrapper">
      <input type="text" class="fullscreenUrl" placeholder="http://localhost:24050/..." required>
    </div>

    <div class="row-controls">
      <div class="row-options">
        <label class="custom-toggle" title="Allow mouse click-through">
          <input type="checkbox" class="row-clickthrough">
          <span class="slider"></span>
          <span class="label-text">Click-through</span>
        </label>
        <label class="custom-toggle" title="Always on top">
          <input type="checkbox" class="row-alwaysontop">
          <span class="slider"></span>
          <span class="label-text">Always on top</span>
        </label>
      </div>
      <button type="button" class="remove-btn-inline" title="Remove row">
        <svg class="icon" aria-hidden="true"><use href="#icon-remove"/></svg>
      </button>
    </div>

    <div class="advanced-options">
      <div class="size-field"><span>W:</span><input type="number" class="adv-width" placeholder="0"></div>
      <div class="size-field"><span>H:</span><input type="number" class="adv-height" placeholder="0"></div>
      <div class="size-field"><span>X:</span><input type="number" class="adv-x" placeholder="0"></div>
      <div class="size-field"><span>Y:</span><input type="number" class="adv-y" placeholder="0"></div>
    </div>
  `;

  if (data.url) row.querySelector('.fullscreenUrl').value = data.url;
  row.querySelector('.row-clickthrough').checked = !!data.clickThrough;
  row.querySelector('.row-alwaysontop').checked = !!data.alwaysOnTop;

  row.querySelector('.adv-width').value = data.width || 0;
  row.querySelector('.adv-height').value = data.height || 0;
  row.querySelector('.adv-x').value = data.x || 0;
  row.querySelector('.adv-y').value = data.y || 0;

  bindRowEvents(row);
  return row;
}

function addUrlField(data) {
  const row = createUrlRow(data);
  urlContainer.appendChild(row);
  const mainContent = document.querySelector('.main-content');
  mainContent.scrollTo({ top: mainContent.scrollHeight, behavior: 'smooth' });
  if (!data) row.querySelector('.fullscreenUrl').focus();
}

function bindRowEvents(row) {
  const removeBtn = row.querySelector('.remove-btn-inline');
  removeBtn.addEventListener('click', () => {
    row.style.opacity = '0';
    row.style.transform = 'scale(0.95)';
    setTimeout(() => row.remove(), 200);
  });

  const numericSelectors = ['.adv-width', '.adv-height', '.adv-x', '.adv-y'];
  numericSelectors.forEach(selector => {
    const input = row.querySelector(selector);
    if (!input) return;
    if (input.value === '') input.value = '0';
    input.addEventListener('blur', () => {
      if (input.value === '') input.value = '0';
    });
  });
}

// --- Presets ---
async function loadPresets() {
  const presets = await ipcRenderer.invoke('get-presets');
  presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
  Object.keys(presets).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    presetSelect.appendChild(opt);
  });
}

async function savePreset() {
  const name = presetNameInput.value.trim();
  if (!name) return alert('Please enter a preset name before saving.');

  const data = collectOptions();
  if (!data.urls.length) return alert('Please add at least one URL before saving.');

  await ipcRenderer.invoke('save-preset', { name, data });
  await loadPresets();
  presetSelect.value = name;
  presetNameInput.value = '';
}

async function deletePreset() {
  const name = presetSelect.value;
  if (!name) return;
  await ipcRenderer.invoke('delete-preset', name);
  await loadPresets();
}

presetSelect.addEventListener('change', async () => {
  const presets = await ipcRenderer.invoke('get-presets');
  const preset = presets[presetSelect.value];
  if (!preset) return;

  urlContainer.innerHTML = '';
  preset.urls.forEach(urlData => addUrlField(urlData));
});

async function fetchActiveOverlays() {
  const overlays = await ipcRenderer.invoke('list-overlays');
  activeListContainer.innerHTML = '';

  if (overlays.length === 0) {
    activeListContainer.innerHTML = '<div class="empty-state">No active overlays</div>';
    return;
  }

  overlays.forEach(overlay => {
    const item = document.createElement('div');
    item.className = 'active-item';
  
    const isHidden = overlay.hidden;
    const statusText = isHidden ? 'Hidden' : 'Visible';
    const statusClass = isHidden ? 'hidden' : 'visible';
    const toggleBtnText = isHidden ? 'Show' : 'Hide';
    
    const displayTitle = escapeHtml(overlay.title);
    const urlSafe = escapeHtml(overlay.url);

    item.innerHTML = `
      <div class="active-info">
        <span class="active-url" title="${urlSafe}" style="font-weight: 600; font-family: sans-serif;">
          ${displayTitle}
        </span>
        <span class="active-status">
          <span class="status-dot ${statusClass}"></span> ${statusText}
        </span>
      </div>
      <div class="active-actions">
        <button type="button" class="action-btn btn-center" data-id="${overlay.id}">Center</button>
        <button type="button" class="action-btn btn-toggle" data-id="${overlay.id}" data-hidden="${isHidden}">${toggleBtnText}</button>
        <button type="button" class="action-btn btn-destroy" data-id="${overlay.id}">Destroy</button>
      </div>
    `;

    item.querySelector('.btn-center').addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await ipcRenderer.invoke('center-overlay', id);
      await fetchActiveOverlays();
    });

    item.querySelector('.btn-toggle').addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await ipcRenderer.invoke('toggle-overlay', id);
      await fetchActiveOverlays();
    });

    item.querySelector('.btn-destroy').addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await ipcRenderer.invoke('destroy-overlay', id);
      fetchActiveOverlays();
    });

    activeListContainer.appendChild(item);
  });
}

// --- Events ---
savePresetBtn.addEventListener('click', savePreset);
deletePresetBtn.addEventListener('click', deletePreset);
refreshActiveBtn.addEventListener('click', fetchActiveOverlays);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  ipcRenderer.send('create-overlay', collectOptions());
});

addUrlBtn.addEventListener('click', () => addUrlField());

ipcRenderer.on('overlays-created', () => {
  fetchActiveOverlays();
});

if (document.querySelectorAll('.url-row').length === 0) {
  addUrlField();
}
loadPresets();
fetchActiveOverlays();