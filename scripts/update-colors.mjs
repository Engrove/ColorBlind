import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const targetCsv = path.join(dataDir, 'rgb_combined_v05.csv');
const targetMeta = path.join(dataDir, 'upstream-metadata.json');

const sources = [
  'https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv',
  'https://cdn.jsdelivr.net/gh/ayushoriginal/Optimized-RGB-To-ColorName@master/rgb_combined_v05.csv'
];

const minLines = 2500;

async function main() {
  await mkdir(dataDir, { recursive: true });

  let lastError = null;
  for (const source of sources) {
    try {
      console.log(`Downloading color data from ${source}`);
      const response = await fetch(source, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      validateCsv(text, source);
      await writeFile(targetCsv, normalizeLineEndings(text), 'utf8');
      await writeFile(targetMeta, JSON.stringify({
        sourceRepository: 'ayushoriginal/Optimized-RGB-To-ColorName',
        sourceFile: 'rgb_combined_v05.csv',
        sourceUrl: source,
        retrievedAt: new Date().toISOString(),
        lineCount: normalizeLineEndings(text).trim().split('\n').length,
        license: 'MIT License, copyright (c) 2016 jetbloom'
      }, null, 2) + '\n', 'utf8');
      console.log(`Wrote ${targetCsv}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Failed: ${source}: ${error.message}`);
    }
  }

  throw new Error(`Could not download color data. Last error: ${lastError?.message || 'unknown'}`);
}

function validateCsv(text, source) {
  const normalized = normalizeLineEndings(text);
  const lines = normalized.trim().split('\n');
  if (lines.length < minLines) {
    throw new Error(`Too few lines from ${source}: ${lines.length}`);
  }
  const header = lines[0].trim();
  const expected = '_Hex,_Red,_Green,_Blue,_Title,_Name,_grey,_seq,_SVG,_source,_dup';
  if (header !== expected) {
    throw new Error(`Unexpected CSV header from ${source}: ${header}`);
  }
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
