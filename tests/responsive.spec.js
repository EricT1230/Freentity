import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

for (const viewport of viewports) {
  test(`does not overflow or crop at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

    const metrics = await page.evaluate(() => {
      const artwork = document.querySelector('.invitation__artwork').getBoundingClientRect();
      const controls = [...document.querySelectorAll('.utility-button')].map((node) => node.getBoundingClientRect());
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        artworkWidth: artwork.width,
        artworkHeight: artwork.height,
        controls: controls.map(({ left, right, width, height }) => ({ left, right, width, height })),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.artworkWidth).toBeLessThanOrEqual(402.5);
    expect(metrics.artworkHeight / metrics.artworkWidth).toBeCloseTo(1404 / 402, 2);
    for (const control of metrics.controls) {
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(metrics.clientWidth);
      expect(control.width).toBeGreaterThanOrEqual(72);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('reflows from portrait to landscape and back without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      artworkWidth: document.querySelector('.invitation__artwork').getBoundingClientRect().width,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.artworkWidth).toBeLessThanOrEqual(402.5);
  }
});

test('keeps all utility labels usable with increased text size at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./');
  await page.addStyleTag({ content: ':root { font-size: 125% !important; }' });
  await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

  const controls = await page.locator('.utility-button').evaluateAll((nodes) => nodes.map((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    height: node.getBoundingClientRect().height,
  })));
  for (const control of controls) {
    expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
});
