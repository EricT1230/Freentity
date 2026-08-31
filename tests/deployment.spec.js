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
    'assets/event.ics',
    'assets/figma-invitation-1170.jpeg',
    'assets/figma-invitation.jpeg',
    'assets/freentity-logo.png',
    'assets/social-preview-20260830.jpg',
    'assets/social-preview.jpg',
    'envelope.css',
    'index.html',
    'reader.css',
    'script.js',
    'styles.css',
  ]);

  const html = await readFile('_site/index.html', 'utf8');
  expect(html).not.toContain('figma.com/api/mcp/asset');
  expect(html).not.toContain('CNAME');
  expect(html).not.toMatch(/assets\/invitation\.(?:png|webp)/);
});

test('keeps every fetched resource first-party except the opt-in venue map link', async () => {
  const html = await readFile('index.html', 'utf8');
  const allowedPrefixes = [
    'https://freentity.pages.dev/',
    'https://freentity.com/',
    'http://www.w3.org/2000/svg',
    'https://www.google.com/maps/search/',
  ];

  for (const [url] of html.matchAll(/https?:\/\/[^"'\s)]+/g)) {
    expect(allowedPrefixes.some((prefix) => url.startsWith(prefix)), url).toBe(true);
  }

  const sources = {
    'styles.css': await readFile('styles.css', 'utf8'),
    'envelope.css': await readFile('envelope.css', 'utf8'),
    'reader.css': await readFile('reader.css', 'utf8'),
    'script.js': await readFile('script.js', 'utf8'),
  };
  for (const [name, source] of Object.entries(sources)) {
    expect(source, name).not.toMatch(/url\(\s*["']?https?:/);
    expect(source, name).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/);
    expect(source, name).not.toContain('@import');
  }
});

test('references every local asset relatively so it serves from a root domain or a subpath', async () => {
  const html = await readFile('index.html', 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(([, value]) => value);
  const localReferences = references.filter((value) => !/^https?:/.test(value));

  expect(localReferences.length).toBeGreaterThan(6);
  for (const reference of localReferences) {
    // A leading slash would break the GitHub Pages subpath; a bare name would break
    // nothing today but keeps the published tree ambiguous. Require "./".
    expect(reference.startsWith('./'), reference).toBe(true);
  }
});

test('offers the event as a repository-local calendar download', async ({ page, request }) => {
  await page.goto('./');

  const calendar = page.locator('a[href="./assets/event.ics"]');
  await expect(calendar).toHaveCount(1);
  await expect(calendar).toHaveAttribute('download', 'freentity-2026-10-04.ics');

  const response = await request.get('./assets/event.ics');
  expect(response.ok()).toBe(true);
  const calendarBody = await response.text();
  expect(calendarBody).toContain('DTSTART;TZID=Asia/Taipei:20261004T140000');
  expect(calendarBody).toContain('DTEND;TZID=Asia/Taipei:20261004T163000');
  expect(calendarBody).toContain('SUMMARY:帆益科技新廠落成開幕暨技術發表');
  expect(calendarBody).toContain('LOCATION:320 桃園市中壢區中園路 192 號 5 樓之一');
});

test('opens every outbound link in a rel-protected new tab', async ({ page }) => {
  await page.goto('./');

  const outbound = page.locator('a[target="_blank"]');
  await expect(outbound).toHaveCount(3);

  const rels = await outbound.evaluateAll((links) => links.map((link) => link.getAttribute('rel')));
  for (const rel of rels) {
    expect(rel).toBe('noopener noreferrer');
  }

  // Both brand marks lead to the official site; the third is the venue map.
  await expect(page.locator('a[href="https://freentity.com/"]')).toHaveCount(2);
  await expect(page.locator('a[href*="google.com/maps/search/"]')).toHaveCount(1);
});

test('links both brand marks to the official Freentity site', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });

  for (const selector of ['.reader-bar__brand', '.rail__brand']) {
    const brand = page.locator(selector);
    await expect(brand, selector).toHaveAttribute('href', 'https://freentity.com/');
    // The mark must reach the link with its own colours untouched.
    const mark = brand.locator('img');
    await expect(mark, selector).toHaveAttribute('src', './assets/freentity-logo.png');
    expect(
      await mark.evaluate((image) => {
        const style = getComputedStyle(image);
        return [style.filter, style.mixBlendMode, style.opacity];
      }),
      selector,
    ).toEqual(['none', 'normal', '1']);
  }
});

test('all runtime assets resolve below the repository path', async ({ request }) => {
  const runtimePaths = [
    './',
    './styles.css',
    './envelope.css',
    './reader.css',
    './script.js',
    './assets/event.ics',
    './assets/envelope-card.jpg',
    './assets/freentity-logo.png',
    './assets/figma-invitation-1170.jpeg',
    './assets/figma-invitation.jpeg',
    './assets/social-preview.jpg',
    './assets/social-preview-20260830.jpg',
  ];

  for (const path of runtimePaths) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
});

test('publishes an absolute social preview for link unfurlers', async ({ page, request }) => {
  const siteUrl = 'https://freentity.pages.dev/';
  const previewUrl = `${siteUrl}assets/social-preview-20260830.jpg`;

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

  const preview = await request.get('./assets/social-preview-20260830.jpg');
  expect(preview.ok()).toBe(true);
  expect(preview.headers()['content-type']).toBe('image/jpeg');
});
