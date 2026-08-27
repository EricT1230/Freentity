import { execFile as execFileCallback } from 'node:child_process';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execFile = promisify(execFileCallback);

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, path));
    } else {
      files.push(relative(root, path).replaceAll('\\', '/'));
    }
  }

  return files.sort();
}

test.afterEach(async () => {
  await rm('_site', { recursive: true, force: true });
});

test('builds a minimal Pages artifact with no custom-domain or test files', async () => {
  await execFile(process.execPath, ['scripts/build-site.mjs']);
  expect(await listFiles('_site')).toEqual([
    '.nojekyll',
    'assets/event.ics',
    'index.html',
    'script.js',
    'styles.css',
  ]);

  const html = await readFile('_site/index.html', 'utf8');
  expect(html).not.toContain('figma.com/api/mcp/asset');
  expect(html).not.toContain('CNAME');
  expect(html).not.toMatch(/assets\/invitation\.(?:png|webp)/);

  const calendar = await readFile('_site/assets/event.ics', 'utf8');
  expect(calendar.endsWith('\r\n')).toBe(true);
  expect(calendar.replaceAll('\r\n', '')).not.toContain('\n');
});

test('all runtime assets resolve below the repository path', async ({ request }) => {
  const runtimePaths = [
    './',
    './styles.css',
    './script.js',
    './assets/event.ics',
  ];

  for (const path of runtimePaths) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
});
