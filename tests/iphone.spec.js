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
    window.__backPhaseSnapshot = null;
    const activePhases = {};
    const root = document.documentElement;
    const stages = {
      shell: document.querySelector('.envelope-shell'),
      flap: document.querySelector('.envelope__flap'),
      letter: document.querySelector('.envelope__letter'),
    };

    const phaseObserver = new MutationObserver(() => {
      if (root.dataset.openingPhase !== 'back' || window.__backPhaseSnapshot) {
        return;
      }

      const envelopeRect = stages.shell.getBoundingClientRect();
      const samplePoints = [.12, .28, .44, .6, .76, .9].flatMap((yRatio) => (
        [.12, .31, .5, .69, .88].map((xRatio) => [xRatio, yRatio])
      ));
      window.__backPhaseSnapshot = {
        frontOpacity: Number(getComputedStyle(stages.shell.querySelector('.envelope-face--front')).opacity),
        backOpacity: Number(getComputedStyle(stages.shell.querySelector('.envelope-face--back')).opacity),
        exposedSamples: samplePoints.filter(([xRatio, yRatio]) => {
          const topElement = document.elementFromPoint(
            envelopeRect.left + envelopeRect.width * xRatio,
            envelopeRect.top + envelopeRect.height * yRatio,
          );
          return topElement?.closest('.envelope__letter') === stages.letter;
        }).length,
        exposedBelowEnvelope: [.2, .5, .8].filter((xRatio) => {
          const topElement = document.elementFromPoint(
            envelopeRect.left + envelopeRect.width * xRatio,
            envelopeRect.bottom + 2,
          );
          return topElement?.closest('.envelope__letter') === stages.letter;
        }).length,
      };
      phaseObserver.disconnect();
    });
    phaseObserver.observe(root, { attributes: true, attributeFilter: ['data-opening-phase'] });

    for (const [stage, element] of Object.entries(stages)) {
      for (const type of ['transitionstart', 'transitionend']) {
        element.addEventListener(type, (event) => {
          if (event.propertyName === 'transform') {
            if (type === 'transitionstart') {
              activePhases[stage] = document.documentElement.dataset.openingPhase;
            }
            window.__openingTransitions.push({
              stage,
              type,
              phase: activePhases[stage],
              at: performance.now(),
              elapsedTime: event.elapsedTime,
            });
          }
        });
      }
    }
  });
}

async function waitForOpeningTransition(page, stage, type, phase) {
  await page.waitForFunction(
    ([expectedStage, expectedType, expectedPhase]) => window.__openingTransitions?.some(
      (event) => event.stage === expectedStage
        && event.type === expectedType
        && (!expectedPhase || event.phase === expectedPhase),
    ),
    [stage, type, phase],
    { timeout: 8000 },
  );
}

async function inspectPocketCoverage(letter) {
  return letter.evaluate((element) => {
    const envelopeRect = element.closest('.envelope-shell').getBoundingClientRect();
    const coveredPoints = [.7, .8, .9].flatMap((yRatio) => (
      [.2, .5, .8].map((xRatio) => [xRatio, yRatio])
    ));

    return {
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
  const initialLetter = await letter.boundingBox();

  await expect(page.locator('.envelope-face--front')).toBeVisible();
  expect(await shell.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m11)).toBeGreaterThan(.95);

  await page.getByRole('button', { name: 'Open' }).tap();
  await waitForOpeningTransition(page, 'shell', 'transitionend', 'flip');
  expect(await shell.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m11)).toBeLessThan(-.85);
  await page.waitForFunction(() => window.__backPhaseSnapshot !== null);
  const backPhase = await page.evaluate(() => window.__backPhaseSnapshot);
  expect(backPhase.frontOpacity).toBeLessThan(.01);
  expect(backPhase.backOpacity).toBeGreaterThan(.99);
  expect(backPhase.exposedSamples).toBe(0);
  expect(backPhase.exposedBelowEnvelope).toBe(0);
  await page.screenshot({ path: 'test-results/visual/iphone-back.png' });

  const envelopeBox = await shell.boundingBox();
  await waitForOpeningTransition(page, 'flap', 'transitionend', 'flap');
  const openFlap = await flap.boundingBox();
  expect(openFlap.y).toBeLessThan(envelopeBox.y - 20);
  const pocketCoverage = await inspectPocketCoverage(letter);
  expect(pocketCoverage.exposedSamples).toBe(0);
  expect(pocketCoverage.exposedBelowEnvelope).toBe(0);
  expect((await letter.boundingBox()).y).toBeLessThan(initialLetter.y - 40);
  await page.screenshot({ path: 'test-results/visual/iphone-flap-open.png' });

  await waitForOpeningTransition(page, 'letter', 'transitionstart', 'card');
  const movingLetter = await letter.boundingBox();
  expect(movingLetter.x).toBeGreaterThanOrEqual(0);
  expect(movingLetter.x + movingLetter.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.waitForTimeout(320);
  await page.screenshot({ path: 'test-results/visual/iphone-card-rise.png' });
  await waitForOpeningTransition(page, 'letter', 'transitionend', 'card');

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const eventFor = (stage, type, phase) => transitions.find(
    (event) => event.stage === stage && event.type === type && event.phase === phase,
  );
  const flipEnd = eventFor('shell', 'transitionend', 'flip');
  const flapEnd = eventFor('flap', 'transitionend', 'flap');
  const cardEnd = eventFor('letter', 'transitionend', 'card');
  expect(flipEnd.elapsedTime).toBeGreaterThanOrEqual(.82);
  expect(flapEnd.elapsedTime).toBeGreaterThanOrEqual(.72);
  expect(cardEnd.elapsedTime).toBeGreaterThanOrEqual(.95);

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
});
