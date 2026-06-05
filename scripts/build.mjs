import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_URL = 'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const distData = path.join(distDir, 'data', 'rgb_combined_v05.csv');
const publicData = path.join(publicDir, 'data', 'rgb_combined_v05.csv');

function countUsableRows(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '');
  if (!normalized.includes('_Hex') || !normalized.includes('_Red') || !normalized.includes('_Green') || !normalized.includes('_Blue')) {
    return 0;
  }

  return normalized
    .split(/\r?\n/)
    .filter(line => /^#[0-9A-Fa-f]{6},\d{1,3},\d{1,3},\d{1,3},/.test(line))
    .length;
}

async function downloadData() {
  const res = await fetch(DATA_URL, {
    headers: {
      'User-Agent': 'color-name-camera-build',
      'Accept': 'text/csv,text/plain,*/*'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const count = countUsableRows(text);
  if (count < 1000) throw new Error(`Unexpected CSV content: only ${count} usable rows`);
  return { text, count, source: DATA_URL };
}

async function readBundledData() {
  if (!existsSync(publicData)) return null;
  const text = await readFile(publicData, 'utf8');
  return { text, count: countUsableRows(text), source: 'bundled public/data/rgb_combined_v05.csv' };
}

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(path.dirname(distData), { recursive: true });

let data;
try {
  data = await downloadData();
  console.log(`Downloaded full color data: ${data.count} usable rows.`);
} catch (err) {
  console.warn(`Could not download full data during build: ${err.message}`);
  data = await readBundledData();
  if (!data) throw err;
  console.warn(`Using bundled data instead: ${data.count} usable rows.`);
}

await writeFile(distData, data.text, 'utf8');

if (data.count < 10) {
  throw new Error(`Build refused to deploy invalid color data from ${data.source}`);
}

await writeFile(
  path.join(distDir, 'build-info.json'),
  JSON.stringify({
    app: 'color-name-camera',
    version: 'v4-data-loader',
    colorDataSource: data.source,
    usableColorRows: data.count,
    builtAt: new Date().toISOString()
  }, null, 2),
  'utf8'
);

console.log(`Built dist/ for Cloudflare Pages at ${distDir}`);
