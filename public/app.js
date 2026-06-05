const DATA_URLS = [
  './data/rgb_combined_v05.csv',
  'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv'
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

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        value += '"'; i++;
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
      row.push(value); value = '';
    } else if (ch === '\n') {
      row.push(value); value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      value += ch;
    }
  }
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
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
  const y = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;

  if (y < 26) return 'Black';
  if (y > 242 && s < 0.18) return 'White';

  if (s < 0.12) {
    if (y < 58) return 'Black';
    if (y > 224) return 'White';
    return 'Gray';
  }

  if (s < 0.24) {
    if (h >= 18 && h <= 62 && l >= 0.45) return 'Beige';
    if (h >= 12 && h <= 48 && l < 0.45) return 'Brown';
    if (h >= 330 || h <= 16) return l > 0.54 ? 'Pink' : 'Red';
    if (h >= 190 && h <= 260) return 'Blue';
    return 'Gray';
  }

  if (h >= 345 || h < 12) return l > 0.62 ? 'Pink' : 'Red';
  if (h < 28) return l < 0.52 ? 'Brown' : 'Orange';
  if (h < 48) return l < 0.42 ? 'Brown' : (l > 0.78 && s < 0.55 ? 'Beige' : 'Orange');
  if (h < 70) return l > 0.78 && s < 0.45 ? 'Beige' : 'Yellow';
  if (h < 165) return 'Green';
  if (h < 195) return 'Cyan';
  if (h < 255) return 'Blue';
  if (h < 292) return 'Purple';
  if (h < 345) return l > 0.62 ? 'Pink' : 'Magenta';
  return 'Unknown';
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

async function loadColorData() {
  let lastError = '';
  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCsv(text);
      const header = rows.shift().map(h => h.trim());
      const index = Object.fromEntries(header.map((h, i) => [h, i]));
      const colors = rows.map(cols => {
        const rgb = [
          Number(cols[index._Red]),
          Number(cols[index._Green]),
          Number(cols[index._Blue])
        ];
        const title = cleanName(cols[index._Title] || cols[index._Name]);
        return {
          hex: String(cols[index._Hex] || '').trim().toUpperCase(),
          rgb,
          lab: rgbToLab(rgb),
          title,
          source: cleanName(cols[index._source]) || 'dataset',
          family: familyFromRgb(rgb)
        };
      }).filter(c => /^#[0-9A-F]{6}$/.test(c.hex) && c.rgb.every(Number.isFinite) && c.title);

      if (colors.length < 10) throw new Error('Too few colors loaded');
      state.colors = colors;
      dataStatus.textContent = `${colors.length.toLocaleString('en-US')} colors loaded locally`;
      return;
    } catch (err) {
      lastError = err.message;
    }
  }
  dataStatus.textContent = `color data error: ${lastError}`;
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
    family: nearest.family,
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
  label.textContent = `${r.name} · ${r.family} · ${r.measuredHex}`;
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
