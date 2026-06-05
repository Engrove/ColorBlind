import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DATA_URL = 'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv';
const outFile = process.argv[2] || 'public/data/rgb_combined_v05.csv';

const res = await fetch(DATA_URL, {
  headers: { 'User-Agent': 'color-name-camera-build' }
});

if (!res.ok) {
  throw new Error(`Failed to download color data: HTTP ${res.status}`);
}

const text = await res.text();
if (!text.includes('_Hex,_Red,_Green,_Blue,_Title')) {
  throw new Error('Downloaded file does not look like the expected color CSV.');
}

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, text, 'utf8');
console.log(`Wrote ${outFile}`);
