import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const DATA_URL = 'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv';
const root = new URL('..', import.meta.url).pathname;
const publicDir = `${root}public`;
const distDir = `${root}dist`;
const distData = `${distDir}/data/rgb_combined_v05.csv`;
const publicData = `${publicDir}/data/rgb_combined_v05.csv`;

async function downloadData() {
  const res = await fetch(DATA_URL, { headers: { 'User-Agent': 'color-name-camera-build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('_Hex,_Red,_Green,_Blue,_Title')) throw new Error('Unexpected CSV format');
  return text;
}

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(dirname(distData), { recursive: true });

try {
  const text = await downloadData();
  await writeFile(distData, text, 'utf8');
  console.log('Downloaded full color data for dist/.');
} catch (err) {
  console.warn(`Could not download full data during build: ${err.message}`);
  if (existsSync(publicData)) {
    const text = await readFile(publicData, 'utf8');
    await writeFile(distData, text, 'utf8');
    console.warn('Used bundled fallback data instead. Run npm run data:update before deployment if this repeats.');
  }
}

console.log('Built dist/ for Cloudflare Pages.');
