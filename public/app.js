const app = document.getElementById('app');
const video = document.getElementById('video');
const canvas = document.getElementById('frame');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
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
const copyBtn = document.getElementById('copyBtn');
const sampleStatus = document.getElementById('sampleStatus');

const FALLBACK_COLORS = [
  ['#000000', 0, 0, 0, 'black'], ['#FFFFFF', 255, 255, 255, 'white'],
  ['#808080', 128, 128, 128, 'gray'], ['#FF0000', 255, 0, 0, 'red'],
  ['#8B0000', 139, 0, 0, 'dark red'], ['#A52A2A', 165, 42, 42, 'brown'],
  ['#FFA500', 255, 165, 0, 'orange'], ['#FFFF00', 255, 255, 0, 'yellow'],
  ['#008000', 0, 128, 0, 'green'], ['#00FFFF', 0, 255, 255, 'cyan'],
  ['#0000FF', 0, 0, 255, 'blue'], ['#800080', 128, 0, 128, 'purple'],
  ['#FFC0CB', 255, 192, 203, 'pink'], ['#F5F5DC', 245, 245, 220, 'beige']
];

const VISION_MODES = [
  ['standard', 'Standard vision'], ['redgreen', 'Red-green assist'],
  ['protan', 'Protan'], ['deutan', 'Deutan'], ['tritan', 'Tritan'],
  ['mono', 'Monochrome / contrast']
];

const MODE_HELP = {
  standard: 'Default output. No colorblind assistive grouping or live video filter.',
  redgreen: 'Groups warm red, brown and orange shades and applies a live contrast/saturation video filter.',
  protan: 'Adds extra caution for dark red and red/brown/orange shades and applies a protan-oriented live filter.',
  deutan: 'Simplifies red, brown, orange and pale pink/gray confusion zones and applies a deutan-oriented live filter.',
  tritan: 'Simplifies blue/green/cyan and yellow/pink/beige confusion zones and applies a tritan-oriented live filter.',
  mono: 'Prioritizes brightness and contrast instead of hue and converts the live video to monochrome.'
};

const state = { colors: [], stream: null, lastResult: null, auto: true, frozen: false, loopTimer: 0, samplePoint: { x: 50, y: 36 } };

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function toHex(rgb) { return '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
function rgbDistance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function parseCsv(text) { return String(text || '').trim().split(/\r?\n/).slice(1).map(line => line.split(',')); }
function modeLabel(mode) { return (VISION_MODES.find(x => x[0] === mode) || [mode, mode])[1]; }
function currentMode() { return localStorage.getItem('colorVisionMode') || 'standard'; }
function setMode(mode) { const value = VISION_MODES.some(x => x[0] === mode) ? mode : 'standard'; localStorage.setItem('colorVisionMode', value); app.dataset.visionMode = value; document.documentElement.dataset.visionMode = value; if (sampleStatus) { sampleStatus.textContent = value === 'standard' ? 'Camera sample' : `${modeLabel(value)} filter on`; sampleStatus.title = MODE_HELP[value]; } }

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h, s, l };
}

function familyFromRgb(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  const max = Math.max(...rgb);
  if (l <= 0.08 || max < 28) return 'Black';
  if (l >= 0.94 && s < 0.12) return 'White';
  if (s < 0.09) return 'Gray';
  if (h >= 345 || h < 10) return l > 0.62 ? 'Pink' : 'Red';
  if (h < 25) return l < 0.45 || s < 0.35 ? 'Brown' : 'Orange';
  if (h < 45) return l > 0.72 && s < 0.48 ? 'Beige' : 'Orange';
  if (h < 68) return l > 0.76 && s < 0.44 ? 'Beige' : 'Yellow';
  if (h < 165) return 'Green';
  if (h < 195) return 'Cyan';
  if (h < 255) return 'Blue';
  if (h < 292) return 'Purple';
  return 'Pink';
}

function colorEntry(hex, r, g, b, name, source = 'dataset') { return { hex, rgb: [Number(r), Number(g), Number(b)], name: clean(name), family: familyFromRgb([Number(r), Number(g), Number(b)]), source }; }
function fallbackColors() { return FALLBACK_COLORS.map(row => colorEntry(...row, 'embedded')); }

async function loadColorData() {
  try {
    const res = await fetch('./data/rgb_combined_v05.csv', { cache: 'reload' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseCsv(await res.text());
    const colors = rows.map(c => colorEntry(c[0], c[1], c[2], c[3], c[4] || c[5], c[9] || 'csv')).filter(c => /^#[0-9A-Fa-f]{6}$/.test(c.hex) && c.name);
    if (colors.length < 10) throw new Error('too few colors');
    state.colors = colors;
  } catch { state.colors = fallbackColors(); }
}

function nearestColor(rgb) {
  let best = null, score = Infinity;
  for (const c of state.colors) { const d = rgbDistance(rgb, c.rgb); if (d < score) { score = d; best = c; } }
  return best ? { ...best, delta: score } : null;
}

function createResult(rgb, mode) {
  const nearest = nearestColor(rgb); if (!nearest) return null;
  const family = familyFromRgb(rgb); const measured = toHex(rgb);
  return { mode, rgb, measuredHex: measured, nearestHex: nearest.hex, name: nearest.name, family, source: nearest.source, delta: nearest.delta, confidence: nearest.delta < 16 ? 'High' : nearest.delta < 44 ? 'Medium' : 'Low' };
}

function visionOutput(result) {
  const mode = currentMode(); const family = result.family;
  const output = { useAs: `${family} family`, group: 'No special group', note: MODE_HELP[mode] || '' };
  if (mode === 'mono') return { useAs: 'Brightness / contrast', group: 'Monochrome', note: MODE_HELP.mono };
  if (['redgreen', 'protan', 'deutan'].includes(mode) && ['Red', 'Orange', 'Brown', 'Pink', 'Beige'].includes(family)) { output.useAs = 'Red family'; output.group = 'Red / Brown / Orange'; }
  if (mode === 'tritan' && ['Blue', 'Green', 'Cyan'].includes(family)) { output.useAs = 'Blue / Green group'; output.group = 'Blue / Green / Cyan'; }
  if (mode === 'tritan' && ['Yellow', 'Pink', 'Beige'].includes(family)) { output.useAs = 'Yellow / Pink / Beige group'; output.group = 'Yellow / Pink / Beige'; }
  return output;
}

function ensureVisionControl() {
  let control = document.getElementById('visionModeControl');
  if (!control) { control = document.createElement('div'); control.id = 'visionModeControl'; control.className = 'vision-mode-control'; control.innerHTML = `<label for="visionModeSelect">Vision mode</label><select id="visionModeSelect">${VISION_MODES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`; document.body.appendChild(control); }
  const select = document.getElementById('visionModeSelect'); select.value = currentMode(); select.onchange = () => { setMode(select.value); if (state.lastResult) renderResult(state.lastResult); };
  setMode(select.value);
}

function ensureVisionPanel() {
  let panel = document.getElementById('visionPanel'); if (panel) return panel;
  const target = colorName?.closest('.sheet') || document.querySelector('.sheet'); if (!target) return null;
  panel = document.createElement('section'); panel.id = 'visionPanel'; panel.className = 'vision-panel'; panel.hidden = true;
  panel.innerHTML = '<div class="vision-row"><span class="vision-label">Use as</span><span id="visionUseAs" class="vision-value">--</span></div><div class="vision-row"><span class="vision-label">Likely confusion group</span><span id="visionGroup" class="vision-value">--</span></div><p id="visionNote" class="vision-note">--</p>';
  target.insertBefore(panel, target.firstElementChild?.nextSibling || target.firstChild);
  return panel;
}

function renderResult(result) {
  if (!result) return; state.lastResult = result;
  swatch.style.background = result.measuredHex; colorName.textContent = result.name; nameLabel.textContent = result.measuredHex === result.nearestHex ? 'Exact dataset match' : 'Closest color name'; colorFamily.textContent = result.family; measuredHex.textContent = result.measuredHex; measuredRgb.textContent = result.rgb.join(', '); nearestHex.textContent = result.nearestHex; deltaE.textContent = result.delta.toFixed(1); sourceName.textContent = result.source; confidence.textContent = result.confidence;
  const mode = currentMode(); const panel = ensureVisionPanel();
  if (mode === 'standard') { if (panel) panel.hidden = true; return; }
  const out = visionOutput(result); if (panel) { panel.hidden = false; document.getElementById('visionUseAs').textContent = out.useAs; document.getElementById('visionGroup').textContent = out.group; document.getElementById('visionNote').textContent = `${out.note} Does not diagnose color vision.`; }
  colorName.textContent = out.useAs; nameLabel.textContent = result.confidence === 'High' ? 'Use as' : 'Likely'; colorFamily.textContent = out.group;
}

function sampleCamera() {
  if (!video.videoWidth || !video.videoHeight) return state.lastResult;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const box = clamp(Math.round(Math.min(canvas.width, canvas.height) * 0.08), 24, 110); const x0 = Math.round((canvas.width - box) / 2); const y0 = Math.round((canvas.height * 0.36) - box / 2);
  const data = ctx.getImageData(clamp(x0, 0, canvas.width - box), clamp(y0, 0, canvas.height - box), box, box).data;
  let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < data.length; i += 4) { const y = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000; if (y < 4 || y > 252) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  if (!n) return null; return createResult([r / n, g / n, b / n], 'camera');
}

function loop() { if (state.auto && !state.frozen) renderResult(sampleCamera()); state.loopTimer = setTimeout(loop, 220); }
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera API is not available in this browser. Use current Chrome/Edge/Samsung Internet over HTTPS.');
    return;
  }

  const attempts = [
    {
      name: 'environment camera ideal',
      constraints: {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: false
      }
    },
    {
      name: 'environment camera simple',
      constraints: {
        video: { facingMode: 'environment' },
        audio: false
      }
    },
    {
      name: 'any camera',
      constraints: {
        video: true,
        audio: false
      }
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
      }

      state.stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
      video.srcObject = state.stream;
      video.setAttribute('playsinline', '');
      video.muted = true;

      try {
        await video.play();
      } catch (playError) {
        console.warn('Video play warning after camera grant', playError);
      }

      startScreen.classList.add('hidden');
      clearTimeout(state.loopTimer);
      loop();
      console.info('Camera started with profile:', attempt.name);
      return;
    } catch (error) {
      lastError = error;
      console.warn('Camera start attempt failed:', attempt.name, error);
    }
  }

  const name = lastError?.name || 'UnknownError';
  const message = lastError?.message || 'No browser detail';

  let userMessage;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    userMessage = 'Camera permission is blocked. Open browser site settings for this page and allow Camera, then reload.';
  } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    userMessage = 'No camera was found by the browser.';
  } else if (name === 'NotReadableError' || name === 'TrackStartError') {
    userMessage = 'The camera is busy or blocked by another app. Close other camera apps and reload.';
  } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    userMessage = 'The requested camera profile is not supported on this device.';
  } else if (name === 'SecurityError') {
    userMessage = 'Camera is blocked by browser security policy or site permissions.';
  } else {
    userMessage = 'Camera could not start.';
  }

  alert(`${userMessage}\n\nBrowser error: ${name}\n${message}`);
}
function parseHex(value) { const m = String(value || '').trim().match(/^#?([0-9a-fA-F]{6})$/); if (!m) return null; return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); }
async function copyResult() { const r = state.lastResult; if (!r) return; await navigator.clipboard?.writeText(`Color: ${colorName.textContent}\nFamily: ${colorFamily.textContent}\nMeasured HEX: ${r.measuredHex}\nMeasured RGB: ${r.rgb.map(v => Math.round(v)).join(', ')}\nVision mode: ${modeLabel(currentMode())}`); }

startBtn.addEventListener('click', startCamera);
autoBtn.addEventListener('click', () => { state.auto = !state.auto; autoBtn.textContent = state.auto ? 'Auto on' : 'Auto off'; });
copyBtn.addEventListener('click', copyResult);
hexForm.addEventListener('submit', event => { event.preventDefault(); const rgb = parseHex(hexInput.value); if (rgb) renderResult(createResult(rgb, 'manual')); });

await loadColorData(); ensureVisionControl(); renderResult(createResult([227, 217, 190], 'manual'));
if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js?v=v5-colorblind-assist', { updateViaCache: 'none' }).catch(() => {}));

