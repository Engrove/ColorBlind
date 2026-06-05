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

function cacheBust(content, version) {
  return content
    .replace(/\.\/styles\.css(?:\?v=[^"' <]+)?/g, `./styles.css?v=${version}`)
    .replace(/\.\/app\.js(?:\?v=[^"' <]+)?/g, `./app.js?v=${version}`)
    .replace(/\.\/manifest\.webmanifest(?:\?v=[^"' <]+)?/g, `./manifest.webmanifest?v=${version}`);
}

const sourceText = await readFile(publicData, 'utf8');
const data = validateColorCsv(sourceText);
const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

await rm(distDir, { recursive: true, force: true });
await cp(publicDir, distDir, { recursive: true });
await mkdir(path.dirname(distData), { recursive: true });
await writeFile(distData, data.text, 'utf8');

const indexPath = path.join(distDir, 'index.html');
let indexHtml = await readFile(indexPath, 'utf8');
indexHtml = cacheBust(indexHtml, buildVersion);
await writeFile(indexPath, indexHtml, 'utf8');

const appPath = path.join(distDir, 'app.js');
let appJs = await readFile(appPath, 'utf8');
appJs = appJs.replace(
  /navigator\.serviceWorker\.register\(['"]\.\/service-worker\.js(?:\?v=[^'"]*)?['"]\)/g,
  `navigator.serviceWorker.register('./service-worker.js?v=${buildVersion}')`
);
await writeFile(appPath, appJs, 'utf8');

const swPath = path.join(distDir, 'service-worker.js');
let serviceWorker = await readFile(swPath, 'utf8');
serviceWorker = serviceWorker.replace(/__BUILD_VERSION__/g, buildVersion);
await writeFile(swPath, serviceWorker, 'utf8');

await writeFile(
  path.join(distDir, 'build-info.json'),
  JSON.stringify({
    app: 'color-name-camera',
    version: 'v8-cache-busted-app-shell',
    buildVersion,
    colorDataSource: 'repo:public/data/rgb_combined_v05.csv',
    colorDataLines: data.lines,
    cachePolicy: 'network-first-service-worker-and-versioned-assets',
    builtAt: new Date().toISOString()
  }, null, 2),
  'utf8'
);

console.log(`Built dist/ for Cloudflare Pages at ${distDir}`);
console.log(`Color data: ${data.lines} non-empty lines from repo:public/data/rgb_combined_v05.csv`);
console.log(`Cache-buster version: ${buildVersion}`);
