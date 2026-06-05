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

async function downloadData() {
  const res = await fetch(DATA_URL, { headers: { 'User-Agent': 'color-name-camera-build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('_Hex,_Red,_Green,_Blue,_Title')) throw new Error('Unexpected CSV format');
  return text;
}

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(path.dirname(distData), { recursive: true });

try {
  const text = await downloadData();
  await writeFile(distData, text, 'utf8');
  console.log('Downloaded full color data for dist/.');
} catch (err) {
  console.warn(`Could not download full data during build: ${err.message}`);
  if (existsSync(publicData)) {
    const text = await readFile(publicData, 'utf8');
    await writeFile(distData, text, 'utf8');
    console.warn('Used bundled fallback data instead.');
  } else {
    throw err;
  }
}

console.log(`Built dist/ for Cloudflare Pages at ${distDir}`);
