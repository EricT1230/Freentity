import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outputRoot = '_site';
const runtimeFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'assets/envelope-card.jpg',
  'assets/freentity-logo.png',
  'assets/figma-invitation.jpeg',
  'assets/social-preview.jpg',
  'assets/social-preview-20260828.jpg',
];

await rm(outputRoot, { recursive: true, force: true });

for (const source of runtimeFiles) {
  const destination = join(outputRoot, source);
  await mkdir(dirname(destination), { recursive: true });

  await copyFile(source, destination);
}

await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
