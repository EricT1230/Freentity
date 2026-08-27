import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
  { width: 2048, height: 1150 },
];

const sliceHeights = [339, 385, 276, 404];

for (const viewport of viewports) {
  test(`keeps the envelope and exact Figma pages composed at ${viewport.width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewport);
    await page.goto('./');

    const sealedMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    }));
    expect(sealedMetrics.scrollWidth).toBe(sealedMetrics.clientWidth);
    expect(sealedMetrics.scrollHeight).toBeLessThanOrEqual(sealedMetrics.viewportHeight + 1);

    const envelope = await page.locator('.envelope-shell').boundingBox();
    const prompt = await page.locator('.gate__prompt').boundingBox();
    expect(envelope.width).toBeLessThanOrEqual(viewport.width - 24);
    expect(envelope.y + envelope.height).toBeLessThan(prompt.y);
    expect(prompt.y + prompt.height).toBeLessThanOrEqual(viewport.height - 8);

    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

    const openMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY,
    }));
    expect(openMetrics.scrollWidth).toBe(openMetrics.clientWidth);
    expect(openMetrics.scrollY).toBeLessThanOrEqual(1);

    const expectedWidth = viewport.width >= 900
      ? Math.min(openMetrics.clientWidth - 128, 760)
      : Math.min(openMetrics.clientWidth, 402);
    const pages = await page.locator('.design-page').all();
    expect(pages).toHaveLength(4);
    for (let index = 0; index < pages.length; index += 1) {
      const box = await pages[index].boundingBox();
      expect(box.width).toBeCloseTo(expectedWidth, 0);
      expect(box.height).toBeCloseTo(expectedWidth * sliceHeights[index] / 402, 0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(openMetrics.clientWidth + 0.5);
    }
  });
}

test('uses a substantial centered reading canvas on desktop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');

  const sealedEnvelope = await page.locator('.envelope-shell').boundingBox();
  expect(sealedEnvelope.width).toBeGreaterThanOrEqual(680);

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

  const reader = await page.locator('.reader').boundingBox();
  const firstPage = await page.locator('[data-page="1"]').boundingBox();
  expect(reader.width).toBeGreaterThanOrEqual(700);
  expect(reader.width).toBeLessThanOrEqual(760.5);
  expect(firstPage.width).toBeCloseTo(reader.width, 0);
  expect(firstPage.height).toBeCloseTo(firstPage.width * 339 / 402, 0);
  expect(firstPage.x).toBeCloseTo((1440 - firstPage.width) / 2, 0);
  expect(firstPage.y).toBeGreaterThanOrEqual(40);
});

test('reflows through portrait, landscape, and portrait without drift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    const pageWidth = (await page.locator('[data-page="1"]').boundingBox()).width;
    expect(pageWidth).toBeCloseTo(Math.min(metrics.clientWidth, 402), 0);
  }
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1440, height: 1000 },
]) {
  test(`keeps every slow-opening stage inside ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await mkdir('test-results/visual', { recursive: true });
    await page.setViewportSize(viewport);
    await page.goto('./');

    const shell = page.locator('.envelope-shell');
    const flap = page.locator('.envelope__flap');
    const letter = page.locator('.envelope__letter');
    await page.getByRole('button', { name: 'Open' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'back', { timeout: 3000 });
    const backBox = await shell.boundingBox();
    expect(backBox.y).toBeGreaterThanOrEqual(12);
    expect(backBox.y + backBox.height).toBeLessThanOrEqual(viewport.height - 12);

    await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap-open', { timeout: 4000 });
    const openFlapBox = await flap.boundingBox();
    const openShellBox = await shell.boundingBox();
    expect(openFlapBox.y).toBeGreaterThanOrEqual(12);
    expect(openShellBox.y + openShellBox.height).toBeLessThanOrEqual(viewport.height - 12);
    await page.screenshot({
      path: `test-results/visual/desktop-${viewport.width}x${viewport.height}-flap-open.png`,
    });

    await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'card', { timeout: 3000 });
    await page.waitForTimeout(420);
    const cardBox = await letter.boundingBox();
    const cardFlapBox = await flap.boundingBox();
    const cardShellBox = await shell.boundingBox();
    expect(Math.min(cardBox.y, cardFlapBox.y)).toBeGreaterThanOrEqual(12);
    expect(cardShellBox.y + cardShellBox.height).toBeLessThanOrEqual(viewport.height - 12);
    await page.screenshot({
      path: `test-results/visual/desktop-${viewport.width}x${viewport.height}-card-rise.png`,
    });

    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
  });
}

test('keeps the Figma design proportional when browser text size changes on 320px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto('./');
  await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const firstPage = await page.locator('[data-page="1"]').boundingBox();
  expect(firstPage.width).toBeCloseTo(320, 0);
  expect(firstPage.height).toBeCloseTo(320 * 339 / 402, 0);
});
