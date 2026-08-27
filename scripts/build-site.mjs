import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outputRoot = '_site';
const runtimeFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'assets/invitation.webp',
  'assets/invitation.png',
  'assets/event.ics',
];

await rm(outputRoot, { recursive: true, force: true });

for (const source of runtimeFiles) {
  const destination = join(outputRoot, source);
  await mkdir(dirname(destination), { recursive: true });

  if (source.endsWith('.ics')) {
    const calendar = await readFile(source, 'utf8');
    const normalizedCalendar = `${calendar.replace(/\r\n?/g, '\n').trimEnd()}\n`
      .replaceAll('\n', '\r\n');
    await writeFile(destination, normalizedCalendar, 'utf8');
  } else {
    await copyFile(source, destination);
  }
}

await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
