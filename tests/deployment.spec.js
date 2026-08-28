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

test('builds a minimal GitHub Pages artifact containing only the exact design and static reader', async () => {
  await execFile(process.execPath, ['scripts/build-site.mjs']);
  expect(await listFiles('_site')).toEqual([
    '.nojekyll',
    'assets/envelope-card.jpg',
    'assets/figma-invitation.jpeg',
    'assets/freentity-logo.png',
    'assets/social-preview-20260828.jpg',
    'assets/social-preview.jpg',
    'index.html',
    'script.js',
    'styles.css',
  ]);

  const html = await readFile('_site/index.html', 'utf8');
  expect(html).not.toContain('figma.com/api/mcp/asset');
  expect(html).not.toContain('CNAME');
  expect(html).not.toMatch(/assets\/invitation\.(?:png|webp)/);
  expect(html).not.toContain('event.ics');
});

test('all runtime assets resolve below the repository path', async ({ request }) => {
  const runtimePaths = [
    './',
    './styles.css',
    './script.js',
    './assets/envelope-card.jpg',
    './assets/freentity-logo.png',
    './assets/figma-invitation.jpeg',
    './assets/social-preview.jpg',
    './assets/social-preview-20260828.jpg',
  ];

  for (const path of runtimePaths) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
});

test('publishes an absolute social preview for link unfurlers', async ({ page, request }) => {
  const siteUrl = 'https://erict1230.github.io/Freentity/';
  const previewUrl = `${siteUrl}assets/social-preview-20260828.jpg`;

  await page.goto('./');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', siteUrl);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'zh_TW');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', '帆益科技 Freentity');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', siteUrl);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    '帆益科技｜新廠落成開幕暨技術發表',
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    '誠摯邀請您參與帆益科技新廠落成開幕暨技術發表。',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', previewUrl);
  await expect(page.locator('meta[property="og:image:secure_url"]')).toHaveAttribute('content', previewUrl);
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1920');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '1080');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    '帆益科技新廠落成開幕暨技術發表邀請函封面',
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    '帆益科技｜新廠落成開幕暨技術發表',
  );
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    'content',
    '誠摯邀請您參與帆益科技新廠落成開幕暨技術發表。',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', previewUrl);
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
    'content',
    '帆益科技新廠落成開幕暨技術發表邀請函封面',
  );

  const preview = await request.get('./assets/social-preview-20260828.jpg');
  expect(preview.ok()).toBe(true);
  expect(preview.headers()['content-type']).toBe('image/jpeg');
});
