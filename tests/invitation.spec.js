import { expect, test } from '@playwright/test';

test('loads the sealed invitation shell and local artwork', async ({ page, request }) => {
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'sealed');
  await expect(page.getByRole('button', { name: '開啟邀請' })).toBeVisible();
  await expect(page.locator('#invitation')).toBeAttached();

  const webp = await request.get('./assets/invitation.webp');
  const png = await request.get('./assets/invitation.png');
  expect(webp.ok()).toBe(true);
  expect(png.ok()).toBe(true);

  await expect(page.locator('.invitation__artwork')).toHaveJSProperty('complete', true);
  const dimensions = await page.locator('.invitation__artwork').evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  expect(dimensions).toEqual({ width: 1206, height: 4212 });
});

test('opens once, locks repeated activation, and focuses the invitation', async ({ page }) => {
  await page.goto('./');
  const openButton = page.getByRole('button', { name: '開啟邀請' });

  await openButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
  await expect(openButton).toBeDisabled();
  await page.evaluate(() => document.querySelector('#open-invitation').click());
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await expect(page.locator('#invitation')).toBeFocused();
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

test('uses a short transition when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });
});

test('updates edge parallax during scroll and suppresses it for reduced motion', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(50);
  const activeShift = await page.locator('#invitation').evaluate((node) => node.style.getPropertyValue('--scroll-shift'));
  expect(activeShift).not.toBe('0px');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(50);
  const reducedShift = await page.locator('#invitation').evaluate((node) => node.style.getPropertyValue('--scroll-shift'));
  expect(reducedShift).toBe('0px');
});

test('exposes complete event details to assistive technology', async ({ page }) => {
  await page.goto('./');
  const transcript = page.locator('.invitation__transcript');
  await expect(transcript).toContainText('14:00 開放入場');
  await expect(transcript).toContainText('16:30 活動結束');
  await expect(transcript).toContainText('產線區域禁止攝影');
});
