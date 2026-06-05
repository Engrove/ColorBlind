import { mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await copyDirectory(publicDir, distDir);
  console.log(`Built static site in ${distDir}`);
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
      const info = await stat(to);
      if (info.size === 0) throw new Error(`Empty file in build output: ${to}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
