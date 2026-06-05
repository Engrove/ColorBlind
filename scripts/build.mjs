import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_DATA_LINES = 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const publicData = path.join(publicDir, 'data', 'rgb_combined_v05.csv');
const distData = path.join(distDir, 'data', 'rgb_combined_v05.csv');

function normalizeText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function lineCount(text) {
  return normalizeText(text)
    .split('\n')
    .filter(line => line.trim() !== '')
    .length;
}

function validateColorCsv(text) {
  const normalized = normalizeText(text);
  const firstLine = normalized.split('\n', 1)[0] || '';
  const header = firstLine.toLowerCase();

  for (const required of ['_hex', '_red', '_green', '_blue']) {
    if (!header.includes(required)) {
      throw new Error(`Missing ${required} in CSV header`);
    }
  }

  if (!header.includes('_title') && !header.includes('_name')) {
    throw new Error('Missing _Title/_Name in CSV header');
  }

  const lines = lineCount(normalized);
  if (lines < MIN_DATA_LINES) {
    throw new Error(`Color CSV has only ${lines} non-empty lines; expected at least ${MIN_DATA_LINES}`);
  }

  return { text: normalized.trimEnd() + '\n', lines };
}

const sourceText = await readFile(publicData, 'utf8');
const data = validateColorCsv(sourceText);

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(path.dirname(distData), { recursive: true });
await writeFile(distData, data.text, 'utf8');

await writeFile(
  path.join(distDir, 'build-info.json'),
  JSON.stringify({
    app: 'color-name-camera',
    version: 'v7-local-vendored-dataset',
    colorDataSource: 'repo:public/data/rgb_combined_v05.csv',
    colorDataLines: data.lines,
    builtAt: new Date().toISOString()
  }, null, 2),
  'utf8'
);

console.log(`Built dist/ for Cloudflare Pages at ${distDir}`);
console.log(`Color data: ${data.lines} non-empty lines from repo:public/data/rgb_combined_v05.csv`);
