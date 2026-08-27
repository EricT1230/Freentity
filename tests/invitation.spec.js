import { expect, test } from '@playwright/test';

const chapterIds = ['cover', 'letter', 'innovation', 'rundown', 'venue', 'closing'];

async function openInvitation(page, { reducedMotion = false } = {}) {
  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', {
    timeout: reducedMotion ? 500 : 2500,
  });
}

test('presents one uncluttered full-screen envelope gate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'sealed');
  await expect(page.locator('#invitation-gate')).toBeVisible();
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.invitation__artwork')).toHaveCount(0);
  await expect(page.locator('.letter__title')).toHaveCSS('opacity', '0');

  const envelope = await page.locator('.envelope-shell').boundingBox();
  const letter = await page.locator('.envelope__letter').boundingBox();
  const prompt = await page.locator('.gate__prompt').boundingBox();
  expect(envelope.width).toBeLessThanOrEqual(358);
  expect(letter.y + letter.height).toBeLessThanOrEqual(envelope.y + envelope.height + 0.5);
  expect(envelope.y + envelope.height).toBeLessThan(prompt.y);
  expect(prompt.y + prompt.height).toBeLessThanOrEqual(820);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('keeps keyboard focus inside the sealed invitation gate', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '開啟邀請' })).toBeFocused();
});

test('opens once and lands at the first chapter without a scroll jump', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const openButton = page.getByRole('button', { name: '開啟邀請' });

  await openButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
  await expect(openButton).toBeDisabled();
  await expect(page.locator('#invitation')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('#invitation').contains(document.activeElement))).toBe(false);
  await page.evaluate(() => document.querySelector('#open-invitation').click());
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#invitation')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#invitation')).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  const cover = await page.locator('#cover').boundingBox();
  expect(cover.y).toBeGreaterThanOrEqual(0);
  expect(cover.y).toBeLessThan(40);
});

for (const key of ['Enter', 'Space']) {
  test(`opens from the ${key} key`, async ({ page }) => {
    await page.goto('./');
    const openButton = page.getByRole('button', { name: '開啟邀請' });
    await openButton.focus();
    await page.keyboard.press(key);
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  });
}

test('opens immediately when reduced motion is requested', async ({ page }) => {
  await openInvitation(page, { reducedMotion: true });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
});

test('renders six semantic reading chapters instead of one long poster', async ({ page }) => {
  await openInvitation(page, { reducedMotion: true });

  const chapters = page.locator('#invitation > section[data-chapter]');
  await expect(chapters).toHaveCount(chapterIds.length);
  await expect(page.locator('.invitation__artwork')).toHaveCount(0);

  for (const id of chapterIds) {
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-labelledby', `${id}-title`);
  }

  await expect(page.getByRole('heading', { name: '新廠落成開幕暨技術發表' })).toBeAttached();
  await expect(page.getByRole('heading', { name: '投入 15 年的研究' })).toBeAttached();
  await expect(page.getByRole('heading', { name: '當日流程' })).toBeAttached();
  await expect(page.getByRole('heading', { name: '地點與交通' })).toBeAttached();
});

test('reveals each chapter as it enters the reading viewport', async ({ page }) => {
  await openInvitation(page, { reducedMotion: true });
  await expect(page.locator('#cover')).toHaveClass(/is-visible/);

  const innovation = page.locator('#innovation');
  await innovation.scrollIntoViewIfNeeded();
  await expect(innovation).toHaveClass(/is-visible/);
});
