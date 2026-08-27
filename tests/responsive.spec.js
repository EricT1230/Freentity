import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

for (const viewport of viewports) {
  test(`keeps the gate and reading chapters composed at ${viewport.width}px`, async ({ page }) => {
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
    expect(prompt.y + prompt.height).toBeLessThanOrEqual(viewport.height - 12);

    await page.getByRole('button', { name: '開啟邀請' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });

    const openMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY,
    }));
    expect(openMetrics.scrollWidth).toBe(openMetrics.clientWidth);
    expect(openMetrics.scrollY).toBeLessThanOrEqual(1);

    for (const control of await page.locator('.action-link, .action-button').all()) {
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
  });
}

test('reflows through portrait, landscape, and portrait without drift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test('keeps chapter text and actions usable at 125% text size on 320px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto('./');
  await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.locator('#closing').scrollIntoViewIfNeeded();
  for (const control of await page.locator('.action-link, .action-button').all()) {
    const box = await control.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320.5);
  }
});
