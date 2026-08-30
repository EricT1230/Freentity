import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outputRoot = '_site';
const runtimeFiles = [
  'index.html',
  'styles.css',
  'envelope.css',
  'reader.css',
  'script.js',
  'assets/event.ics',
  'assets/envelope-card.jpg',
  'assets/freentity-logo.png',
  'assets/figma-invitation-1170.jpeg',
  'assets/figma-invitation.jpeg',
  'assets/social-preview.jpg',
  'assets/social-preview-20260830.jpg',
];

await rm(outputRoot, { recursive: true, force: true });

for (const source of runtimeFiles) {
  const destination = join(outputRoot, source);
  await mkdir(dirname(destination), { recursive: true });

  await copyFile(source, destination);
}

await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
