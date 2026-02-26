// renderer.js
const { ipcRenderer } = require('electron');

const form = document.getElementById('overlay-form');
const addUrlBtn = document.getElementById('addUrl');
const urlContainer = document.getElementById('url-container');

const presetNameInput = document.getElementById('presetName');
const presetSelect = document.getElementById('presetSelect');
const savePresetBtn = document.getElementById('savePreset');
const deletePresetBtn = document.getElementById('deletePreset');

function collectOptions() {
  const rows = Array.from(document.querySelectorAll('.url-row'));

  const urls = rows.map(row => {
    const input = row.querySelector('.fullscreenUrl');
    const ct = row.querySelector('.row-clickthrough').checked;
    const adv = row.querySelector('.row-advanced').checked;
    const width = parseInt(row.querySelector('.adv-width').value, 10) || null;
    const height = parseInt(row.querySelector('.adv-height').value, 10) || null;

    return {
      url: input.value.trim(),
      clickThrough: ct,
      advanced: adv,
      width,
      height
    };
  }).filter(o => o.url.length > 0);

  return { urls };
}

function addUrlField() {
  const row = document.createElement('div');
  row.className = 'url-row';

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
          <input type="checkbox" class="row-advanced">
          <span class="slider"></span>
          <span class="label-text">Advanced Size</span>
        </label>
      </div>

      <button type="button" class="remove-btn-inline" title="Remove row">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>

    <div class="advanced-options">
      <div class="size-field">
        <span>W:</span>
        <div class="number-control">
          <button type="button" class="num-btn minus">−</button>
          <input type="number" class="adv-width" value="800" min="100">
          <button type="button" class="num-btn plus">+</button>
        </div>
      </div>

      <div class="size-field">
        <span>H:</span>
        <div class="number-control">
          <button type="button" class="num-btn minus">−</button>
          <input type="number" class="adv-height" value="600" min="100">
          <button type="button" class="num-btn plus">+</button>
        </div>
      </div>
    </div>
  `;

  urlContainer.appendChild(row);
  urlContainer.scrollTo({ top: urlContainer.scrollHeight, behavior: 'smooth' });

  bindRowEvents(row);
  row.querySelector('.fullscreenUrl').focus();
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
  preset.urls.forEach(() => addUrlField());

  const rows = document.querySelectorAll('.url-row');
  rows.forEach((row, i) => {
    const data = preset.urls[i];
    row.querySelector('.fullscreenUrl').value = data.url;
    row.querySelector('.row-clickthrough').checked = data.clickThrough;
    row.querySelector('.row-advanced').checked = data.advanced;
    row.querySelector('.adv-width').value = data.width || '';
    row.querySelector('.adv-height').value = data.height || '';
    row.classList.toggle('show-advanced', data.advanced);
  });
});

savePresetBtn.addEventListener('click', savePreset);
deletePresetBtn.addEventListener('click', deletePreset);

loadPresets();

function bindRowEvents(row) {
  const advCheckbox = row.querySelector('.row-advanced');
  advCheckbox.addEventListener('change', () => {
    row.classList.toggle('show-advanced', advCheckbox.checked);
  });

  const removeBtn = row.querySelector('.remove-btn-inline');
  removeBtn.addEventListener('click', () => {
    row.style.opacity = '0';
    row.style.transform = 'scale(0.95)';
    setTimeout(() => row.remove(), 200);
  });

  row.querySelectorAll('.number-control').forEach(control => {
    const input = control.querySelector('input');
    const minus = control.querySelector('.minus');
    const plus = control.querySelector('.plus');

    minus.addEventListener('click', () => input.stepDown());
    plus.addEventListener('click', () => input.stepUp());
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  ipcRenderer.send('create-overlay', collectOptions());
});

urlContainer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const inputs = urlContainer.querySelectorAll('.fullscreenUrl');
    if (e.target === inputs[inputs.length - 1]) {
      e.preventDefault();
      addUrlField();
    }
  }
});

addUrlBtn.addEventListener('click', addUrlField);

document.querySelectorAll('.url-row').forEach(row => bindRowEvents(row));