import { mkdir } from 'node:fs/promises';
import { devices, expect, test } from '@playwright/test';

test.use({
  ...devices['iPhone 13'],
  browserName: 'webkit',
  colorScheme: 'light',
  locale: 'zh-TW',
});

async function observeOpeningTransitions(page) {
  await page.evaluate(() => {
    window.__openingTransitions = [];
    const stages = {
      shell: document.querySelector('.envelope-shell'),
      flap: document.querySelector('.envelope__flap'),
      letter: document.querySelector('.envelope__letter'),
    };

    for (const [stage, element] of Object.entries(stages)) {
      for (const type of ['transitionstart', 'transitionend']) {
        element.addEventListener(type, (event) => {
          if (event.propertyName === 'transform') {
            window.__openingTransitions.push({
              stage,
              type,
              at: performance.now(),
              elapsedTime: event.elapsedTime,
            });
          }
        });
      }
    }
  });
}

async function waitForOpeningTransition(page, stage, type) {
  await page.waitForFunction(
    ([expectedStage, expectedType]) => window.__openingTransitions?.some(
      (event) => event.stage === expectedStage && event.type === expectedType,
    ),
    [stage, type],
    { timeout: 8000 },
  );
}

async function inspectConcealedLetter(letter) {
  return letter.evaluate((element) => {
    const letterRect = element.getBoundingClientRect();
    const envelopeRect = element.closest('.envelope-shell').getBoundingClientRect();
    const coveredPoints = [.7, .8, .9].flatMap((yRatio) => (
      [.2, .5, .8].map((xRatio) => [xRatio, yRatio])
    ));

    return {
      topRatio: (letterRect.top - envelopeRect.top) / envelopeRect.height,
      clipPath: getComputedStyle(element).clipPath,
      exposedSamples: coveredPoints.filter(([xRatio, yRatio]) => {
        const topElement = document.elementFromPoint(
          envelopeRect.left + envelopeRect.width * xRatio,
          envelopeRect.top + envelopeRect.height * yRatio,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
      exposedBelowEnvelope: [.2, .5, .8].filter((xRatio) => {
        const topElement = document.elementFromPoint(
          envelopeRect.left + envelopeRect.width * xRatio,
          envelopeRect.bottom + 2,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
    };
  });
}

test('opens and reads cleanly in an actual iPhone WebKit device profile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const device = await page.evaluate(() => ({
    devicePixelRatio,
    userAgent: navigator.userAgent,
  }));
  expect(device.devicePixelRatio).toBe(3);
  expect(device.userAgent).toContain('iPhone');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.getByRole('button', { name: 'Open' }).tap();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  const firstPage = await page.locator('[data-page="1"]').boundingBox();
  expect(firstPage.width).toBeCloseTo(390, 0);
  expect(firstPage.height).toBeCloseTo(390 * 339 / 402, 0);

  await page.setViewportSize({ width: 664, height: 390 });
  const landscape = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(landscape.scrollWidth).toBe(landscape.clientWidth);
  expect((await page.locator('[data-page="1"]').boundingBox()).width).toBeCloseTo(402, 0);
});

test('plays the full front-to-back opening sequence on iPhone WebKit without overflow', async ({ page }) => {
  await mkdir('test-results/visual', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await observeOpeningTransitions(page);

  const shell = page.locator('.envelope-shell');
  const flap = page.locator('.envelope-face--back .envelope__flap');
  const letter = page.locator('.envelope-face--back .envelope__letter');

  await expect(page.locator('.envelope-face--front')).toBeVisible();
  expect(await shell.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m11)).toBeGreaterThan(.95);

  await page.getByRole('button', { name: 'Open' }).tap();
  await waitForOpeningTransition(page, 'shell', 'transitionend');
  expect(await shell.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m11)).toBeLessThan(-.85);
  const faceOpacities = await shell.evaluate((element) => ({
    front: Number(getComputedStyle(element.querySelector('.envelope-face--front')).opacity),
    back: Number(getComputedStyle(element.querySelector('.envelope-face--back')).opacity),
  }));
  expect(faceOpacities.front).toBeLessThan(.01);
  expect(faceOpacities.back).toBeGreaterThan(.99);
  const concealedLetter = await inspectConcealedLetter(letter);
  expect(concealedLetter.topRatio).toBeGreaterThanOrEqual(.64);
  expect(concealedLetter.clipPath).toContain('60%');
  expect(concealedLetter.exposedSamples).toBe(0);
  expect(concealedLetter.exposedBelowEnvelope).toBe(0);
  await page.screenshot({ path: 'test-results/visual/iphone-back.png' });

  const envelopeBox = await shell.boundingBox();
  await waitForOpeningTransition(page, 'flap', 'transitionend');
  const openFlap = await flap.boundingBox();
  expect(openFlap.y).toBeLessThan(envelopeBox.y - 20);
  const flapOpenLetter = await inspectConcealedLetter(letter);
  expect(flapOpenLetter.exposedSamples).toBe(0);
  expect(flapOpenLetter.exposedBelowEnvelope).toBe(0);
  await page.screenshot({ path: 'test-results/visual/iphone-flap-open.png' });

  await waitForOpeningTransition(page, 'letter', 'transitionstart');
  const movingLetter = await letter.boundingBox();
  expect(movingLetter.x).toBeGreaterThanOrEqual(0);
  expect(movingLetter.x + movingLetter.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.waitForTimeout(320);
  await page.screenshot({ path: 'test-results/visual/iphone-card-rise.png' });
  await waitForOpeningTransition(page, 'letter', 'transitionend');

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const eventFor = (stage, type) => transitions.find((event) => event.stage === stage && event.type === type);
  const eventAt = (stage, type) => eventFor(stage, type).at;
  expect(eventFor('shell', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(.95);
  expect(eventAt('flap', 'transitionstart') - eventAt('shell', 'transitionend')).toBeGreaterThanOrEqual(500);
  expect(eventFor('flap', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(.8);
  expect(eventAt('letter', 'transitionstart') - eventAt('flap', 'transitionend')).toBeGreaterThanOrEqual(450);
  expect(eventFor('letter', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(1.05);

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
});
