import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_URL = 'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv';
const MIN_DATA_LINES = 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const publicData = path.join(publicDir, 'data', 'rgb_combined_v05.csv');
const distData = path.join(distDir, 'data', 'rgb_combined_v05.csv');

function normalizeText(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function lineCount(text) {
  return normalizeText(text)
    .split(/\r\n|\n|\r/)
    .filter(line => line.trim() !== '')
    .length;
}

function looksLikeColorCsv(text) {
  const normalized = normalizeText(text);
  const firstLine = normalized.split(/\r\n|\n|\r/, 1)[0] || '';
  const header = firstLine.toLowerCase();

  return (
    header.includes('_hex') &&
    header.includes('_red') &&
    header.includes('_green') &&
    header.includes('_blue') &&
    (header.includes('_title') || header.includes('_name'))
  );
}

function validateData(text, source) {
  const lines = lineCount(text);
  if (!looksLikeColorCsv(text)) {
    throw new Error(`${source} does not have the expected RGB color CSV header`);
  }
  if (lines < MIN_DATA_LINES) {
    throw new Error(`${source} has only ${lines} non-empty lines; expected at least ${MIN_DATA_LINES}`);
  }
  return { text, lines, source };
}

async function readBundledData() {
  const text = await readFile(publicData, 'utf8');
  return validateData(text, 'bundled public/data/rgb_combined_v05.csv');
}

async function downloadData() {
  const res = await fetch(DATA_URL, {
    headers: {
      'User-Agent': 'color-name-camera-build',
      Accept: 'text/csv,text/plain,*/*'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return validateData(text, DATA_URL);
}

let data;
try {
  data = await readBundledData();
  console.log(`Using bundled color data: ${data.lines} non-empty lines.`);
} catch (bundledErr) {
  console.warn(`Bundled color data invalid: ${bundledErr.message}`);
  console.warn('Trying upstream download...');
  data = await downloadData();
  console.log(`Downloaded upstream color data: ${data.lines} non-empty lines.`);
}

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(path.dirname(distData), { recursive: true });
await writeFile(distData, data.text, 'utf8');

await writeFile(
  path.join(distDir, 'build-info.json'),
  JSON.stringify({
    app: 'color-name-camera',
    version: 'v6-line-count-data-validation',
    colorDataSource: data.source,
    colorDataLines: data.lines,
    builtAt: new Date().toISOString()
  }, null, 2),
  'utf8'
);

console.log(`Built dist/ for Cloudflare Pages at ${distDir}`);
console.log(`Color data: ${data.lines} non-empty lines from ${data.source}`);
