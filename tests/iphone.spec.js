import { mkdir } from 'node:fs/promises';
import { devices, expect, test } from '@playwright/test';

import {
  inspectPocketCoverage,
  observeOpeningTransitions,
  waitForOpeningTransition,
} from './opening-helpers.js';

test.use({
  ...devices['iPhone 13'],
  browserName: 'webkit',
  colorScheme: 'light',
  locale: 'zh-TW',
});

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
  // WebKit shares the machine with the Chromium workers, so allow the same headroom
  // the other specs use; the reduced-motion sequence itself runs in well under 2s.
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
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

test('unties, lifts and extracts on iPhone WebKit without overflow', async ({ page }) => {
  await mkdir('test-results/visual', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await observeOpeningTransitions(page);

  const shell = page.locator('.envelope-shell');
  const flap = page.locator('.envelope__flap');
  const letter = page.locator('.envelope__letter');
  const initialLetter = await letter.boundingBox();

  await expect(page.locator('.envelope-face--front')).toBeVisible();
  await expect(page.locator('.tie__cord--wrap')).toHaveCount(3);
  // Every wrap is fully drawn while the envelope is still tied shut.
  expect(await page.evaluate(() => [...document.querySelectorAll('.tie__cord--wrap')]
    .map((cord) => Number.parseFloat(getComputedStyle(cord).strokeDashoffset))))
    .toEqual([0, 0, 0]);

  await page.getByRole('button', { name: 'Open' }).tap();
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'unwind');

  await waitForOpeningTransition(page, 'cord', 'transitionend', 'unwind');
  await page.waitForFunction(() => window.__untiedSnapshot !== null, null, { timeout: 6000 });
  const untied = await page.evaluate(() => window.__untiedSnapshot);
  expect(untied.stillWound).toBe(0);
  expect(untied.tailOffset).toBeCloseTo(0, 0);
  expect(untied.flapAngle).toBeGreaterThan(.99);
  expect(untied.exposedBelowEnvelope).toBe(0);
  await page.screenshot({ path: 'test-results/visual/iphone-untied.png' });

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
  expect(eventFor('flap', 'transitionend', 'flap').elapsedTime).toBeGreaterThanOrEqual(.72);
  expect(eventFor('letter', 'transitionend', 'card').elapsedTime).toBeGreaterThanOrEqual(.95);

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
});
