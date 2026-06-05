const DATA_URLS = ['./data/rgb_combined_v05.csv', '/data/rgb_combined_v05.csv'];

const APP_VERSION = 'v4-data-loader';

const EMBEDDED_COLOR_ROWS = [
  ['#000000', 0, 0, 0, 'black', 'embedded'],
  ['#0F0F0F', 15, 15, 15, 'Onyx', 'embedded'],
  ['#1C1C1C', 28, 28, 28, 'gray11', 'embedded'],
  ['#36454F', 54, 69, 79, 'Charcoal', 'embedded'],
  ['#696969', 105, 105, 105, 'DimGray', 'embedded'],
  ['#808080', 128, 128, 128, 'gray', 'embedded'],
  ['#A9A9A9', 169, 169, 169, 'DarkGray', 'embedded'],
  ['#D3D3D3', 211, 211, 211, 'LightGray', 'embedded'],
  ['#F5F5F5', 245, 245, 245, 'WhiteSmoke', 'embedded'],
  ['#FFFFFF', 255, 255, 255, 'white', 'embedded'],
  ['#EAE0C8', 234, 224, 200, 'Pearl', 'embedded'],
  ['#F5F5DC', 245, 245, 220, 'beige', 'embedded'],
  ['#EFDECD', 239, 222, 205, 'Almond', 'embedded'],
  ['#FADADD', 250, 218, 221, 'Pale pink', 'embedded'],
  ['#FFC0CB', 255, 192, 203, 'pink', 'embedded'],
  ['#F4C2C2', 244, 194, 194, 'Baby pink', 'embedded'],
  ['#E75480', 231, 84, 128, 'Dark pink', 'embedded'],
  ['#FF0000', 255, 0, 0, 'red', 'embedded'],
  ['#8B0000', 139, 0, 0, 'DarkRed', 'embedded'],
  ['#DC143C', 220, 20, 60, 'crimson', 'embedded'],
  ['#A52A2A', 165, 42, 42, 'brown', 'embedded'],
  ['#8B4513', 139, 69, 19, 'SaddleBrown', 'embedded'],
  ['#B87333', 184, 115, 51, 'Copper', 'embedded'],
  ['#D2B48C', 210, 180, 140, 'tan', 'embedded'],
  ['#FFA500', 255, 165, 0, 'orange', 'embedded'],
  ['#FF8C00', 255, 140, 0, 'DarkOrange', 'embedded'],
  ['#FFD700', 255, 215, 0, 'gold', 'embedded'],
  ['#FFFF00', 255, 255, 0, 'yellow', 'embedded'],
  ['#F0E68C', 240, 230, 140, 'khaki', 'embedded'],
  ['#808000', 128, 128, 0, 'olive', 'embedded'],
  ['#008000', 0, 128, 0, 'green', 'embedded'],
  ['#006400', 0, 100, 0, 'DarkGreen', 'embedded'],
  ['#32CD32', 50, 205, 50, 'LimeGreen', 'embedded'],
  ['#00FFFF', 0, 255, 255, 'cyan', 'embedded'],
  ['#008080', 0, 128, 128, 'teal', 'embedded'],
  ['#0000FF', 0, 0, 255, 'blue', 'embedded'],
  ['#000080', 0, 0, 128, 'navy', 'embedded'],
  ['#87CEEB', 135, 206, 235, 'SkyBlue', 'embedded'],
  ['#800080', 128, 0, 128, 'purple', 'embedded'],
  ['#4B0082', 75, 0, 130, 'indigo', 'embedded'],
  ['#FF00FF', 255, 0, 255, 'magenta', 'embedded'],
  ['#EE82EE', 238, 130, 238, 'violet', 'embedded']
];

const app = document.getElementById('app');
const video = document.getElementById('video');
const canvas = document.getElementById('frame');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const dataStatus = document.getElementById('dataStatus');
const sampleStatus = document.getElementById('sampleStatus');
const reticle = document.getElementById('reticle');
const labels = document.getElementById('labels');
const swatch = document.getElementById('swatch');
const colorName = document.getElementById('colorName');
const nameLabel = document.getElementById('nameLabel');
const colorFamily = document.getElementById('colorFamily');
const confidence = document.getElementById('confidence');
const measuredHex = document.getElementById('measuredHex');
const measuredRgb = document.getElementById('measuredRgb');
const nearestHex = document.getElementById('nearestHex');
const deltaE = document.getElementById('deltaE');
const sourceName = document.getElementById('sourceName');
const hexForm = document.getElementById('hexForm');
const hexInput = document.getElementById('hexInput');
const autoBtn = document.getElementById('autoBtn');
const sampleBtn = document.getElementById('sampleBtn');
const freezeBtn = document.getElementById('freezeBtn');
const labelBtn = document.getElementById('labelBtn');
const copyBtn = document.getElementById('copyBtn');
const torchBtn = document.getElementById('torchBtn');

const state = {
  colors: [],
  stream: null,
  lastResult: null,
  auto: true,
  frozen: false,
  torch: false,
  samplePoint: { x: 50, y: 36 },
  loopTimer: 0
};
/* EIC minimal UI runtime patch */
function applyMinimalUi() {
  for (const id of ['dataStatus', 'sampleStatus', 'sampleBtn', 'freezeBtn', 'labelBtn', 'torchBtn']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  for (const selector of ['.topbar', '.brand', '.statusbar', '.status-bar', '.hud-top', '.app-header', '.sample-status', '.camera-status']) {
    document.querySelectorAll(selector).forEach(el => { el.hidden = true; });
  }
}
applyMinimalUi();


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function cleanName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\bSVG\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  const pushCell = () => {
    row.push(value);
    value = '';
  };

  const pushRow = () => {
    pushCell();
    if (row.some(cell => String(cell || '').trim() !== '')) rows.push(row);
    row = [];
  };

  const input = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      pushCell();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      pushRow();
      if (next === '\n') i++;
    } else {
      value += ch;
    }
  }

  if (value !== '' || row.length) pushRow();
  return rows;
}

function srgbToLinear(v) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToLab(rgb) {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  const f = v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

function labDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
    else if (max === g) h = ((b - r) / d) + 2;
    else h = ((r - g) / d) + 4;
    h *= 60;
  }
  return { h, s, l };
}

function toHex(rgb) {
  return '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function familyFromRgb(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  const [labL, labA, labB] = rgbToLab(rgb);
  const chroma = Math.hypot(labA, labB);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const spread = max - min;

  if (l <= 0.08 || max < 28) return 'Black';
  if (l >= 0.96 && s <= 0.10) return 'White';
  if (s <= 0.085 && chroma < 9 && spread < 24) return 'Gray';

  if (h >= 345 || h < 10) {
    return l > 0.62 && s < 0.70 ? 'Pink' : 'Red';
  }

  if (h >= 10 && h < 25) {
    if (l >= 0.68 && s <= 0.62) return 'Pink';
    if (l <= 0.42 || s < 0.32) return 'Brown';
    return 'Orange';
  }

  if (h >= 25 && h < 45) {
    if (l >= 0.74 && s <= 0.46) return 'Beige';
    if (l <= 0.50 || s < 0.34) return 'Brown';
    return 'Orange';
  }

  if (h >= 45 && h < 68) {
    if (l >= 0.78 && s <= 0.42) return 'Beige';
    if (l <= 0.36 && s <= 0.48) return 'Brown';
    return 'Yellow';
  }

  if (h >= 68 && h < 165) return 'Green';
  if (h >= 165 && h < 195) return 'Cyan';
  if (h >= 195 && h < 255) return 'Blue';
  if (h >= 255 && h < 292) return 'Purple';
  if (h >= 292 && h < 345) return 'Pink';

  return labL > 70 ? 'Light neutral' : 'Dark neutral';
}

function titlePenalty(entry, family) {
  const title = entry.title.toLowerCase();
  const source = entry.source.toLowerCase();
  let p = 0;

  if (/^(gray|grey)\d+$/.test(title)) p += family === 'Gray' ? 5.5 : 8.5;
  if (/^(red|blue|green|cyan|magenta|yellow|orange|purple|brown|sienna|tomato|coral|salmon|pink|plum|orchid|goldenrod|khaki|wheat|snow|ivory|azure|honeydew|seashell)\d+$/.test(title)) p += 4.5;
  if (/^pantone\s+\d/i.test(title)) p += 0.8;
  if (source.includes('dup')) p += 4;
  if (source.includes('svg')) p -= 0.4;
  if (source.includes('colorhexa')) p -= 0.2;
  if (!entry.title || entry.title.length < 2) p += 20;
  return p;
}

function confidenceFromDelta(delta) {
  if (delta < 3.5) return { text: 'High', className: '' };
  if (delta < 9) return { text: 'Medium', className: 'medium' };
  return { text: 'Low', className: 'low' };
}

function createColorEntry(hex, rgb, title, source) {
  return {
    hex: String(hex || '').trim().toUpperCase(),
    rgb,
    lab: rgbToLab(rgb),
    title: cleanName(title),
    source: cleanName(source) || 'dataset',
    family: familyFromRgb(rgb)
  };
}

function parseColorCsvText(text, sourceLabel) {
  const normalized = String(text || '').replace(/^\uFEFF/, '');
  if (!normalized.includes('_Hex') || !normalized.includes('_Red') || !normalized.includes('_Green') || !normalized.includes('_Blue')) {
    throw new Error(`CSV header not found in ${sourceLabel}`);
  }

  const rows = parseCsv(normalized);
  if (rows.length < 2) throw new Error(`CSV has no data rows in ${sourceLabel}`);

  const header = rows.shift().map(h => String(h || '').replace(/^\uFEFF/, '').trim());
  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = ['_Hex', '_Red', '_Green', '_Blue', '_Title'];

  for (const key of required) {
    if (!(key in index)) throw new Error(`Missing ${key} column in ${sourceLabel}`);
  }

  const colors = rows.map(cols => {
    const rgb = [
      Number(cols[index._Red]),
      Number(cols[index._Green]),
      Number(cols[index._Blue])
    ];
    const title = cleanName(cols[index._Title] || cols[index._Name]);
    const source = cleanName(cols[index._source]) || sourceLabel;
    return createColorEntry(cols[index._Hex], rgb, title, source);
  }).filter(c => /^#[0-9A-F]{6}$/.test(c.hex) && c.rgb.every(Number.isFinite) && c.title);

  if (colors.length < 10) throw new Error(`Only ${colors.length} usable colors in ${sourceLabel}`);

  return colors;
}

function embeddedColors() {
  return EMBEDDED_COLOR_ROWS.map(([hex, r, g, b, title, source]) =>
    createColorEntry(hex, [r, g, b], title, source)
  );
}

async function loadColorData() {
  const errors = [];

  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url, {
        cache: 'reload',
        headers: { 'Accept': 'text/csv,text/plain,*/*' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const colors = parseColorCsvText(text, url);

      state.colors = colors;
      const label = colors.length >= 1000 ? 'full color dataset loaded locally' : 'fallback color dataset loaded locally';
      dataStatus.textContent = `${colors.length.toLocaleString('en-US')} ${label}`;
      dataStatus.title = `Data source: ${url}`;
      return;
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  state.colors = embeddedColors();
  dataStatus.textContent = `${state.colors.length.toLocaleString('en-US')} embedded fallback colors loaded`;
  dataStatus.title = errors.join('\n');
}

function findNearest(rgb) {
  if (!state.colors.length) return null;
  const lab = rgbToLab(rgb);
  const family = familyFromRgb(rgb);
  let best = null;
  let bestScore = Infinity;

  for (const c of state.colors) {
    const delta = labDistance(lab, c.lab);
    const score = delta + titlePenalty(c, family);
    if (score < bestScore) {
      bestScore = score;
      best = { ...c, delta };
    }
  }

  return best ? { ...best, family } : null;
}

function getSampleViewportPoint() {
  return {
    x: window.innerWidth * state.samplePoint.x / 100,
    y: window.innerHeight * state.samplePoint.y / 100
  };
}

function viewportToVideoPoint(x, y) {
  const rect = video.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !rect.width || !rect.height) return null;

  const scale = Math.max(rect.width / vw, rect.height / vh);
  const displayW = vw * scale;
  const displayH = vh * scale;
  const offsetX = (rect.width - displayW) / 2;
  const offsetY = (rect.height - displayH) / 2;

  const vx = (x - rect.left - offsetX) / scale;
  const vy = (y - rect.top - offsetY) / scale;
  return {
    x: clamp(Math.round(vx), 0, vw - 1),
    y: clamp(Math.round(vy), 0, vh - 1)
  };
}

function median(values) {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] || 0;
}

function sampleCamera() {
  if (!video.videoWidth || !video.videoHeight || state.frozen) return state.lastResult;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const vp = getSampleViewportPoint();
  const point = viewportToVideoPoint(vp.x, vp.y);
  if (!point) return null;

  const box = clamp(Math.round(Math.min(canvas.width, canvas.height) * 0.075), 28, 108);
  const x0 = clamp(Math.round(point.x - box / 2), 0, canvas.width - box);
  const y0 = clamp(Math.round(point.y - box / 2), 0, canvas.height - box);
  const data = ctx.getImageData(x0, y0, box, box).data;

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = (r * 299 + g * 587 + b * 114) / 1000;
    if (y < 4 || y > 252) continue;
    pixels.push([r, g, b, y]);
  }
  if (pixels.length < 30) return null;

  const ys = pixels.map(p => p[3]).sort((a, b) => a - b);
  const lo = ys[Math.floor(ys.length * 0.12)];
  const hi = ys[Math.floor(ys.length * 0.88)];
  const filtered = pixels.filter(p => p[3] >= lo && p[3] <= hi);
  if (!filtered.length) return null;

  const rgb = [
    Math.round(median(filtered.map(p => p[0]))),
    Math.round(median(filtered.map(p => p[1]))),
    Math.round(median(filtered.map(p => p[2])))
  ];

  return createResult(rgb, 'camera');
}

function createResult(rgb, mode) {
  const nearest = findNearest(rgb);
  if (!nearest) return null;
  const measured = toHex(rgb);
  const conf = confidenceFromDelta(nearest.delta);
  return {
    mode,
    rgb,
    measuredHex: measured,
    nearestHex: nearest.hex,
    name: nearest.title,
    family: familyFromRgb(rgb),
    source: nearest.source,
    delta: nearest.delta,
    confidence: conf,
    isExactHex: measured === nearest.hex
  };
}

function renderResult(result) {
  if (!result) return;
  state.lastResult = result;
  swatch.style.background = result.measuredHex;
  colorName.textContent = result.name;
  nameLabel.textContent = result.isExactHex ? 'Exact dataset match' : 'Closest color name';
  colorFamily.textContent = result.family;
  measuredHex.textContent = result.measuredHex;
  measuredRgb.textContent = result.rgb.join(', ');
  nearestHex.textContent = result.nearestHex;
  deltaE.textContent = result.delta.toFixed(2);
  sourceName.textContent = result.source;
  confidence.textContent = result.confidence.text;
  confidence.className = `confidence ${result.confidence.className}`.trim();
  sampleStatus.textContent = result.mode === 'manual' ? 'Manual HEX' : 'Camera sample';
}

function updateSamplePoint(xPct, yPct) {
  state.samplePoint.x = clamp(xPct, 12, 88);
  state.samplePoint.y = clamp(yPct, 20, 58);
  document.documentElement.style.setProperty('--sample-x', `${state.samplePoint.x}%`);
  document.documentElement.style.setProperty('--sample-y', `${state.samplePoint.y}%`);
}

function loop() {
  if (state.auto && !state.frozen) renderResult(sampleCamera());
  state.loopTimer = window.setTimeout(loop, 420);
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    video.srcObject = state.stream;
    await video.play();
    startScreen.classList.add('hidden');

    const track = state.stream.getVideoTracks()[0];
    if (track?.applyConstraints) {
      track.applyConstraints({
        advanced: [
          { focusMode: 'continuous' },
          { exposureMode: 'continuous' },
          { whiteBalanceMode: 'continuous' }
        ]
      }).catch(() => {});
    }

    const caps = track?.getCapabilities?.() || {};
    if ('torch' in caps) torchBtn.disabled = false;

    clearTimeout(state.loopTimer);
    loop();
  } catch (err) {
    sampleStatus.textContent = 'Camera blocked';
    alert('Camera could not start. Use HTTPS or localhost and allow camera permission.');
  }
}

function toggleAuto() {
  state.auto = !state.auto;
  autoBtn.textContent = state.auto ? 'Auto on' : 'Auto off';
  autoBtn.classList.toggle('primary', state.auto);
}

function toggleFreeze() {
  state.frozen = !state.frozen;
  freezeBtn.textContent = state.frozen ? 'Live' : 'Freeze';
  video.classList.toggle('frozen', state.frozen);
  if (!state.frozen) renderResult(sampleCamera());
}

async function toggleTorch() {
  const track = state.stream?.getVideoTracks?.()[0];
  if (!track?.applyConstraints) return;
  try {
    state.torch = !state.torch;
    await track.applyConstraints({ advanced: [{ torch: state.torch }] });
    torchBtn.textContent = state.torch ? 'Torch on' : 'Torch';
    torchBtn.classList.toggle('primary', state.torch);
  } catch {
    state.torch = false;
    torchBtn.disabled = true;
  }
}

function addLabel() {
  const r = state.lastResult;
  if (!r) return;
  const label = document.createElement('div');
  label.className = 'float-label';
  label.textContent = `${r.name} Ã‚Â· ${r.family} Ã‚Â· ${r.measuredHex}`;
  label.style.left = `${state.samplePoint.x}%`;
  label.style.top = `${state.samplePoint.y}%`;
  label.style.color = r.measuredHex;
  labels.appendChild(label);
  window.setTimeout(() => {
    label.style.transition = 'opacity .3s ease, transform .3s ease';
    label.style.opacity = '0';
    label.style.transform = 'translate(-50%, -135%)';
    window.setTimeout(() => label.remove(), 340);
  }, 4500);
}

async function copyResult() {
  const r = state.lastResult;
  if (!r) return;
  const text = `Color: ${r.name}\nFamily: ${r.family}\nMeasured HEX: ${r.measuredHex}\nMeasured RGB: ${r.rgb.join(', ')}\nNearest HEX: ${r.nearestHex}\nDelta E: ${r.delta.toFixed(2)}\nSource: ${r.source}`;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied';
    window.setTimeout(() => copyBtn.textContent = 'Copy', 900);
  } catch {
    copyBtn.textContent = 'Copy failed';
    window.setTimeout(() => copyBtn.textContent = 'Copy', 900);
  }
}

function parseHexInput(value) {
  const match = String(value || '').trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const hex = match[1];
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}

startBtn.addEventListener('click', startCamera);
autoBtn.addEventListener('click', toggleAuto);
sampleBtn.addEventListener('click', () => renderResult(sampleCamera()));
freezeBtn.addEventListener('click', toggleFreeze);
labelBtn.addEventListener('click', addLabel);
copyBtn.addEventListener('click', copyResult);
torchBtn.addEventListener('click', toggleTorch);

hexForm.addEventListener('submit', event => {
  event.preventDefault();
  const rgb = parseHexInput(hexInput.value);
  if (!rgb) {
    hexInput.focus();
    return;
  }
  renderResult(createResult(rgb, 'manual'));
});

app.addEventListener('pointerdown', event => {
  if (event.target.closest('button, input, summary, details, .sheet, .topbar, .start-screen')) return;
  const x = event.clientX / window.innerWidth * 100;
  const y = event.clientY / window.innerHeight * 100;
  updateSamplePoint(x, y);
  renderResult(sampleCamera());
});

window.addEventListener('resize', () => {
  if (window.matchMedia('(orientation: landscape) and (max-height: 560px)').matches) {
    updateSamplePoint(42, 50);
  } else if (state.samplePoint.y > 58) {
    updateSamplePoint(state.samplePoint.x, 36);
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

await loadColorData();
renderResult(createResult([227, 217, 190], 'manual'));

/* EIC PWA install UI patch */
(() => {
  let deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function getInstallElements() {
    return {
      button: document.getElementById('installBtn'),
      hint: document.getElementById('installHint')
    };
  }

  function showManualInstallHint() {
    const { hint } = getInstallElements();
    if (!hint || isStandalone()) return;
    hint.hidden = false;
    hint.classList.add('is-visible');
  }

  function updateInstallUi() {
    const { button, hint } = getInstallElements();
    if (!button) return;

    if (isStandalone()) {
      button.hidden = true;
      if (hint) hint.hidden = true;
      return;
    }

    button.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUi();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const { button, hint } = getInstallElements();
    if (button) button.hidden = true;
    if (hint) hint.hidden = true;
  });

  document.addEventListener('DOMContentLoaded', () => {
    const { button } = getInstallElements();
    if (!button) return;

    updateInstallUi();

    button.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        showManualInstallHint();
        return;
      }

      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;

      promptEvent.prompt();
      try {
        await promptEvent.userChoice;
      } finally {
        updateInstallUi();
      }
    });
  });
})();
