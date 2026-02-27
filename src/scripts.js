const { ipcRenderer } = require('electron');

const form = document.getElementById('overlay-form');
const addUrlBtn = document.getElementById('addUrl');
const urlContainer = document.getElementById('url-container');

const presetNameInput = document.getElementById('presetName');
const presetSelect = document.getElementById('presetSelect');
const savePresetBtn = document.getElementById('savePreset');
const deletePresetBtn = document.getElementById('deletePreset');

function toIntOrZero(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function collectOptions() {
  const rows = document.querySelectorAll('.url-row');

  const urls = Array.from(rows, row => {
    const urlInput = row.querySelector('.fullscreenUrl');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) return null;

    const clickThrough = row.querySelector('.row-clickthrough')?.checked ?? false;
    const alwaysOnTop = row.querySelector('.row-alwaysontop')?.checked ?? false;
    const hideFromDesktop = row.querySelector('.row-hide-desktop')?.checked ?? false;

    const width = toIntOrZero(row.querySelector('.adv-width')?.value);
    const height = toIntOrZero(row.querySelector('.adv-height')?.value);
    const x = toIntOrZero(row.querySelector('.adv-x')?.value);
    const y = toIntOrZero(row.querySelector('.adv-y')?.value);

    return {
      url,
      clickThrough,
      alwaysOnTop,
      width,
      height,
      x,
      y,
      hideFromDesktop
    };
  }).filter(Boolean);

  return { urls };
}

function createUrlRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'url-row show-advanced';

  row.innerHTML = `
    <div class="input-wrapper">
      <input type="text" class="fullscreenUrl" placeholder="http://localhost:24050/..." required>
    </div>

    <div class="row-controls">
      <div class="row-options">

        <label class="custom-toggle">
          <input type="checkbox" class="row-clickthrough">
          <span class="slider"></span>
          <span class="label-text">Click-through</span>
        </label>

        <label class="custom-toggle">
          <input type="checkbox" class="row-alwaysontop">
          <span class="slider"></span>
          <span class="label-text">Always On Top</span>
        </label>

        <label class="custom-toggle">
          <input type="checkbox" class="row-hide-desktop">
          <span class="slider"></span>
          <span class="label-text">Hide</span>
        </label>

      </div>

      <button type="button" class="remove-btn-inline" title="Remove row">✕</button>
    </div>

    <div class="advanced-options">
      <div class="size-field">
        <span>W:</span>
        <input type="number" class="adv-width" placeholder="0">
      </div>

      <div class="size-field">
        <span>H:</span>
        <input type="number" class="adv-height" placeholder="0">
      </div>

      <div class="size-field">
        <span>X:</span>
        <input type="number" class="adv-x" placeholder="0">
      </div>

      <div class="size-field">
        <span>Y:</span>
        <input type="number" class="adv-y" placeholder="0">
      </div>
    </div>
  `;

  // apply initial data if provided
  if (data.url) row.querySelector('.fullscreenUrl').value = data.url;
  row.querySelector('.row-clickthrough').checked = !!data.clickThrough;
  row.querySelector('.row-alwaysontop').checked = !!data.alwaysOnTop;
  row.querySelector('.row-hide-desktop').checked = !!data.hideFromDesktop;
  row.querySelector('.adv-width').value = data.width || 0;
  row.querySelector('.adv-height').value = data.height || 0;
  row.querySelector('.adv-x').value = (typeof data.x !== 'undefined') ? data.x : 0;
  row.querySelector('.adv-y').value = (typeof data.y !== 'undefined') ? data.y : 0;
  row.classList.add('show-advanced');

  bindRowEvents(row);
  return row;
}

function addUrlField(data) {
  const row = createUrlRow(data);
  urlContainer.appendChild(row);
  urlContainer.scrollTo({ top: urlContainer.scrollHeight, behavior: 'smooth' });
  row.querySelector('.fullscreenUrl').focus();
}

function bindRowEvents(row) {
  const removeBtn = row.querySelector('.remove-btn-inline');
  removeBtn.addEventListener('click', () => {
    row.style.opacity = '0';
    row.style.transform = 'scale(0.95)';
    setTimeout(() => row.remove(), 180);
  });

  const numericSelectors = ['.adv-width', '.adv-height', '.adv-x', '.adv-y'];
  numericSelectors.forEach(selector => {
    const input = row.querySelector(selector);
    if (!input) return;

    if (input.value === '') {
      input.value = '0';
    }

    input.addEventListener('blur', () => {
      if (input.value === '') {
        input.value = '0';
      }
    });
  });
}

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
  if (!name) {
    alert('Enter preset name');
    return;
  }

  const data = collectOptions();
  if (!data.urls.length) {
    alert('Add at least one URL before saving.');
    return;
  }

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

savePresetBtn.addEventListener('click', savePreset);
deletePresetBtn.addEventListener('click', deletePreset);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  ipcRenderer.send('create-overlay', collectOptions());
});

addUrlBtn.addEventListener('click', () => addUrlField());

// initialize existing starter row if present
document.querySelectorAll('.url-row').forEach(row => {
  row.classList.add('show-advanced');
  bindRowEvents(row);
});

loadPresets();