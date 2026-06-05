const LOCAL_DATA_URL = './data/rgb_combined_v05.csv';
const UPSTREAM_DATA_URL = 'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv';
const MIN_EXPECTED_COLOR_ROWS = 2500;
const SAMPLE_INTERVAL_MS = 320;

const els = {
  video: document.getElementById('video'),
  canvas: document.getElementById('frame'),
  startPanel: document.getElementById('startPanel'),
  startBtn: document.getElementById('startBtn'),
  loadDataBtn: document.getElementById('loadDataBtn'),
  autoBtn: document.getElementById('autoBtn'),
  sampleBtn: document.getElementById('sampleBtn'),
  freezeBtn: document.getElementById('freezeBtn'),
  labelBtn: document.getElementById('labelBtn'),
  copyBtn: document.getElementById('copyBtn'),
  torchBtn: document.getElementById('torchBtn'),
  swatch: document.getElementById('swatch'),
  exactName: document.getElementById('exactName'),
  familyName: document.getElementById('familyName'),
  confidence: document.getElementById('confidence'),
  measuredHex: document.getElementById('measuredHex'),
  measuredRgb: document.getElementById('measuredRgb'),
  nearestHex: document.getElementById('nearestHex'),
  deltaE: document.getElementById('deltaE'),
  sourceName: document.getElementById('sourceName'),
  dataStatus: document.getElementById('dataStatus'),
  cameraStatus: document.getElementById('cameraStatus'),
  hexInput: document.getElementById('hexInput'),
  testHexBtn: document.getElementById('testHexBtn'),
  labels: document.getElementById('labels')
};

const ctx = els.canvas.getContext('2d', { willReadFrequently: true });

let stream = null;
let colorData = [];
let autoMode = true;
let frozen = false;
let torchOn = false;
let loopTimer = null;
let lastResult = null;

init();

async function init() {
  bindEvents();
  await loadColorData();
  registerServiceWorker();
  const test = classifyRgb([231, 206, 194]);
  if (test) renderResult(test, 'Manual check #E7CEC2');
}

function bindEvents() {
  els.startBtn.addEventListener('click', startCamera);
  els.loadDataBtn.addEventListener('click', () => loadColorData(true));
  els.sampleBtn.addEventListener('click', () => sampleAndRender(true));
  els.labelBtn.addEventListener('click', addLabel);
  els.copyBtn.addEventListener('click', copyResult);
  els.torchBtn.addEventListener('click', toggleTorch);
  els.testHexBtn.addEventListener('click', testHexInput);
  els.hexInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') testHexInput();
  });

  els.autoBtn.addEventListener('click', () => {
    autoMode = !autoMode;
    els.autoBtn.classList.toggle('active', autoMode);
    els.autoBtn.textContent = autoMode ? 'Auto on' : 'Auto off';
    setCameraStatus(autoMode ? 'Auto mode active' : 'Manual mode');
  });

  els.freezeBtn.addEventListener('click', () => {
    frozen = !frozen;
    els.freezeBtn.classList.toggle('active', frozen);
    els.freezeBtn.textContent = frozen ? 'Frozen' : 'Freeze';
    setCameraStatus(frozen ? 'Frame frozen' : autoMode ? 'Auto mode active' : 'Manual mode');
  });
}

async function loadColorData(forceUpstream = false) {
  els.dataStatus.textContent = 'Loading color data';
  els.loadDataBtn.disabled = true;

  try {
    const localText = forceUpstream ? null : await fetchText(LOCAL_DATA_URL).catch(() => null);
    const localColors = localText ? parseColorCsv(localText) : [];

    if (localColors.length >= MIN_EXPECTED_COLOR_ROWS) {
      colorData = localColors;
      els.dataStatus.textContent = `${colorData.length.toLocaleString()} colors loaded locally`;
      return;
    }

    const upstreamText = await fetchText(UPSTREAM_DATA_URL);
    const upstreamColors = parseColorCsv(upstreamText);

    if (upstreamColors.length < MIN_EXPECTED_COLOR_ROWS) {
      throw new Error(`Color data only had ${upstreamColors.length} usable rows.`);
    }

    colorData = upstreamColors;
    els.dataStatus.textContent = `${colorData.length.toLocaleString()} colors loaded from upstream`;
  } catch (error) {
    console.error(error);
    const fallbackText = await fetchText('./data/rgb_combined_v05.sample.csv').catch(() => null);
    colorData = fallbackText ? parseColorCsv(fallbackText) : createEmergencyPalette();
    els.dataStatus.textContent = `Using fallback data: ${colorData.length} colors`;
  } finally {
    els.loadDataBtn.disabled = false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return await response.text();
}

function parseColorCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const headers = rows[0].map(value => value.trim());
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const required = ['_Hex', '_Red', '_Green', '_Blue', '_Title'];
  for (const header of required) {
    if (!(header in index)) throw new Error(`Missing CSV column ${header}`);
  }

  const colors = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const hex = normalizeHex(row[index._Hex]);
    const r = Number(row[index._Red]);
    const g = Number(row[index._Green]);
    const b = Number(row[index._Blue]);
    const title = cleanName(row[index._Title] || row[index._Name] || hex);
    const source = cleanName(row[index._source] || 'Unknown');
    const seq = Number(row[index._seq] || 9999);

    if (!hex || !Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !title) continue;
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) continue;

    const rgb = [r, g, b];
    colors.push({
      hex,
      rgb,
      title,
      source,
      seq: Number.isFinite(seq) ? seq : 9999,
      lab: rgbToLab(rgb)
    });
  }

  return colors;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not available in this browser.');
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    els.video.srcObject = stream;
    await els.video.play();
    els.startPanel.classList.add('hidden');
    configureTorchButton();
    setCameraStatus('Auto mode active');
    startSamplingLoop();
  } catch (error) {
    console.error(error);
    setCameraStatus('Camera failed');
    alert('Camera could not start. Use HTTPS or localhost, and allow camera access.');
  }
}

function configureTorchButton() {
  const track = stream?.getVideoTracks?.()[0];
  const caps = track?.getCapabilities?.() || {};
  els.torchBtn.disabled = !('torch' in caps);
}

async function toggleTorch() {
  const track = stream?.getVideoTracks?.()[0];
  if (!track?.applyConstraints) return;

  try {
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    els.torchBtn.classList.toggle('active', torchOn);
    els.torchBtn.textContent = torchOn ? 'Torch on' : 'Torch';
  } catch (error) {
    console.warn(error);
    torchOn = false;
    els.torchBtn.disabled = true;
  }
}

function startSamplingLoop() {
  if (loopTimer) window.clearTimeout(loopTimer);

  const tick = () => {
    if (autoMode && !frozen) sampleAndRender(false);
    loopTimer = window.setTimeout(tick, SAMPLE_INTERVAL_MS);
  };

  tick();
}

function sampleAndRender(force) {
  if (!force && (!autoMode || frozen)) return;
  const rgb = sampleCenterColor();
  if (!rgb) return;
  const result = classifyRgb(rgb);
  if (result) renderResult(result, 'Camera sample');
}

function sampleCenterColor() {
  const video = els.video;
  if (!video.videoWidth || !video.videoHeight) return null;

  els.canvas.width = video.videoWidth;
  els.canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, els.canvas.width, els.canvas.height);

  const box = Math.max(28, Math.round(Math.min(els.canvas.width, els.canvas.height) * 0.085));
  const x0 = Math.round((els.canvas.width - box) / 2);
  const y0 = Math.round((els.canvas.height - box) / 2);
  const image = ctx.getImageData(x0, y0, box, box).data;

  const pixels = [];
  const luminanceValues = [];
  const step = box > 90 ? 2 : 1;

  for (let y = 0; y < box; y += step) {
    for (let x = 0; x < box; x += step) {
      const idx = (y * box + x) * 4;
      const r = image[idx];
      const g = image[idx + 1];
      const b = image[idx + 2];
      const a = image[idx + 3];
      if (a < 10) continue;
      const lum = perceivedLuminance([r, g, b]);
      pixels.push({ rgb: [r, g, b], lum });
      luminanceValues.push(lum);
    }
  }

  if (pixels.length < 12) return null;

  luminanceValues.sort((a, b) => a - b);
  const low = percentile(luminanceValues, 0.06);
  const high = percentile(luminanceValues, 0.94);
  const filtered = pixels.filter(pixel => pixel.lum >= low && pixel.lum <= high);
  const selected = dominantCluster(filtered.length >= 12 ? filtered : pixels);
  return medianRgb(selected.length ? selected.map(pixel => pixel.rgb) : pixels.map(pixel => pixel.rgb));
}

function dominantCluster(pixels) {
  if (pixels.length <= 24) return pixels;

  const sorted = [...pixels].sort((a, b) => a.lum - b.lum);
  let centers = [
    [...sorted[Math.floor(sorted.length * 0.25)].rgb],
    [...sorted[Math.floor(sorted.length * 0.50)].rgb],
    [...sorted[Math.floor(sorted.length * 0.75)].rgb]
  ];

  for (let iter = 0; iter < 5; iter++) {
    const buckets = centers.map(() => []);
    for (const pixel of pixels) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const d = rgbDistanceSq(pixel.rgb, centers[i]);
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
        }
      }
      buckets[bestIndex].push(pixel);
    }

    centers = buckets.map((bucket, i) => bucket.length ? medianRgb(bucket.map(pixel => pixel.rgb)) : centers[i]);
  }

  const buckets = centers.map(() => []);
  for (const pixel of pixels) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const d = rgbDistanceSq(pixel.rgb, centers[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    buckets[bestIndex].push(pixel);
  }

  return buckets.sort((a, b) => b.length - a.length)[0] || pixels;
}

function classifyRgb(rgb) {
  if (!colorData.length) return null;

  const measuredHex = rgbToHex(rgb);
  const family = colorFamily(rgb);
  const nearest = findNearest(rgb);
  const confidence = confidenceFromDeltaE(nearest.deltaE);

  return {
    measuredRgb: rgb,
    measuredHex,
    family,
    nearest,
    confidence
  };
}

function findNearest(rgb) {
  const lab = rgbToLab(rgb);
  const shortlist = [];

  for (const color of colorData) {
    const d76 = deltaE76Sq(lab, color.lab);
    if (shortlist.length < 28) {
      shortlist.push({ color, d76 });
      shortlist.sort((a, b) => b.d76 - a.d76);
    } else if (d76 < shortlist[0].d76) {
      shortlist[0] = { color, d76 };
      shortlist.sort((a, b) => b.d76 - a.d76);
    }
  }

  let best = null;
  for (const candidate of shortlist) {
    const de = deltaE2000(lab, candidate.color.lab);
    if (!best || de < best.deltaE || (de === best.deltaE && candidate.color.seq < best.color.seq)) {
      best = { color: candidate.color, deltaE: de };
    }
  }

  return best;
}

function renderResult(result, statusText) {
  lastResult = result;

  const exact = result.nearest.color;
  els.swatch.style.background = result.measuredHex;
  els.exactName.textContent = exact.title;
  els.familyName.textContent = result.family;
  els.measuredHex.textContent = result.measuredHex;
  els.measuredRgb.textContent = result.measuredRgb.join(', ');
  els.nearestHex.textContent = exact.hex;
  els.deltaE.textContent = result.nearest.deltaE.toFixed(2);
  els.sourceName.textContent = exact.source || 'Unknown';
  els.confidence.textContent = result.confidence.label;
  els.confidence.className = `confidence ${result.confidence.className}`.trim();
  setCameraStatus(statusText);
}

function confidenceFromDeltaE(delta) {
  if (delta <= 3) return { label: 'High', className: '' };
  if (delta <= 10) return { label: 'Medium', className: 'warn' };
  return { label: 'Approx.', className: 'bad' };
}

function testHexInput() {
  const hex = normalizeHex(els.hexInput.value || '#E7CEC2');
  if (!hex) {
    els.hexInput.value = '';
    els.hexInput.placeholder = 'Invalid HEX';
    return;
  }

  els.hexInput.value = hex;
  const rgb = hexToRgb(hex);
  const result = classifyRgb(rgb);
  if (result) renderResult(result, `Manual test ${hex}`);
}

async function copyResult() {
  if (!lastResult) return;
  const nearest = lastResult.nearest.color;
  const text = [
    `Exact color: ${nearest.title}`,
    `Color family: ${lastResult.family}`,
    `Measured HEX: ${lastResult.measuredHex}`,
    `Measured RGB: ${lastResult.measuredRgb.join(', ')}`,
    `Nearest HEX: ${nearest.hex}`,
    `Delta E: ${lastResult.nearest.deltaE.toFixed(2)}`,
    `Source: ${nearest.source || 'Unknown'}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    setCameraStatus('Copied result');
  } catch {
    setCameraStatus('Copy failed');
  }
}

function addLabel() {
  if (!lastResult) return;

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${lastResult.nearest.color.title} / ${lastResult.family}`;
  label.style.borderColor = lastResult.measuredHex;
  label.style.color = '#fff';

  const jitterX = Math.round(Math.random() * 28 - 14);
  const jitterY = Math.round(Math.random() * 28 - 14);
  label.style.transform = `translate(calc(-50% + ${jitterX}px), calc(-50% + ${jitterY}px))`;
  els.labels.appendChild(label);

  window.setTimeout(() => {
    label.style.opacity = '0';
    label.style.transition = 'opacity 350ms ease';
    window.setTimeout(() => label.remove(), 380);
  }, 6500);
}

function setCameraStatus(text) {
  els.cameraStatus.textContent = text;
}

function colorFamily(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  const [labL, labA, labB] = rgbToLab(rgb);
  const chroma = Math.hypot(labA, labB);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const spread = max - min;

  if (l <= 0.08 || max < 28) return 'Black';
  if (l >= 0.96 && s <= 0.10) return 'White';
  if (s <= 0.085 && chroma < 9 && spread < 24) return 'Gray';

  if ((h >= 345 || h < 10)) {
    if (l > 0.62 && s < 0.70) return 'Pink';
    return 'Red';
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
  if (h >= 165 && h < 195) return 'Teal';
  if (h >= 195 && h < 255) return 'Blue';
  if (h >= 255 && h < 292) return 'Purple';
  if (h >= 292 && h < 345) return 'Pink';

  return labL > 70 ? 'Light neutral' : 'Dark neutral';
}

function createEmergencyPalette() {
  const base = [
    ['#000000', 'Black', 'Fallback'],
    ['#FFFFFF', 'White', 'Fallback'],
    ['#808080', 'Gray', 'Fallback'],
    ['#FF0000', 'Red', 'Fallback'],
    ['#FFA500', 'Orange', 'Fallback'],
    ['#FFFF00', 'Yellow', 'Fallback'],
    ['#008000', 'Green', 'Fallback'],
    ['#00FFFF', 'Cyan', 'Fallback'],
    ['#0000FF', 'Blue', 'Fallback'],
    ['#800080', 'Purple', 'Fallback'],
    ['#FFC0CB', 'Pink', 'Fallback'],
    ['#A52A2A', 'Brown', 'Fallback'],
    ['#F5F5DC', 'Beige', 'Fallback']
  ];

  return base.map(([hex, title, source], i) => ({
    hex,
    rgb: hexToRgb(hex),
    title,
    source,
    seq: i + 1,
    lab: rgbToLab(hexToRgb(hex))
  }));
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

function cleanName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHex(value) {
  const raw = String(value || '').trim();
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex).slice(1);
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function medianRgb(values) {
  const channels = [0, 1, 2].map(channel => {
    const sorted = values.map(rgb => rgb[channel]).sort((a, b) => a - b);
    return Math.round(percentile(sorted, 0.5));
  });
  return channels;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const weight = idx - lo;
  return sortedValues[lo] * (1 - weight) + sortedValues[hi] * weight;
}

function perceivedLuminance(rgb) {
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

function rgbDistanceSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbToHsl(rgb) {
  let [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return { h, s, l };
}

function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  x = labPivot(x);
  y = labPivot(y);
  z = labPivot(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function srgbToLinear(v) {
  v = clamp(v, 0, 255) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function labPivot(v) {
  return v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
}

function deltaE76Sq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(degToRad(dhp / 2));
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T = 1
    - 0.17 * Math.cos(degToRad(hbarp - 30))
    + 0.24 * Math.cos(degToRad(2 * hbarp))
    + 0.32 * Math.cos(degToRad(3 * hbarp + 6))
    - 0.20 * Math.cos(degToRad(4 * hbarp - 63));
  const deltaTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt((Cbarp ** 7) / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * ((Lbarp - 50) ** 2)) / Math.sqrt(20 + ((Lbarp - 50) ** 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(degToRad(2 * deltaTheta)) * Rc;

  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
    (dCp / (kC * Sc)) ** 2 +
    (dHp / (kH * Sh)) ** 2 +
    Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
  );
}

function hueAngle(b, a) {
  if (a === 0 && b === 0) return 0;
  const angle = radToDeg(Math.atan2(b, a));
  return angle >= 0 ? angle : angle + 360;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
