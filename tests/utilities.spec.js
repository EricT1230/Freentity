import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const expectedFigmaAssetSha256 = 'a61257abec55ce2736aded16299a2110d51fd5cceb57b7f3e3f37c38a8a7e659';
const expectedOfficialLogoSha256 = '2582061e74f0166c3dd4151f878271c7b0e5825add755646af06a30e41fb9a4d';
const expectedEnvelopeCardSha256 = 'f3e6869dc3741caebc657c58bf42b141e71c4c8dd66cba9dc442b8b59d52a9f6';
const expectedSocialPreviewSha256 = '1076d31968bf3b25ebc3efe415bea4e0efb7ab6b148bae9db8e7a648b2d98f24';

async function openInvitation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
}

test('ships the exact original image bytes exported from the Figma frame', async () => {
  const asset = await readFile('assets/figma-invitation.jpeg');
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedFigmaAssetSha256);
});

test('ships the official full-color Freentity logo without changing its pixels', async () => {
  const asset = await readFile('assets/freentity-logo.png').catch(() => null);
  expect(asset, 'the official logo PNG must be present in the static site').not.toBeNull();
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedOfficialLogoSha256);
});

test('ships the approved full-color envelope card without changing its pixels', async () => {
  const asset = await readFile('assets/envelope-card.jpg');
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedEnvelopeCardSha256);
});

test('ships the supplied social preview artwork without changing its pixels', async () => {
  const asset = await readFile('assets/social-preview.jpg');
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedSocialPreviewSha256);
});

test('keeps the complete invitation transcript available to assistive technology', async ({ page }) => {
  await openInvitation(page);
  const transcript = page.locator('#invitation-transcript');

  await expect(transcript).toContainText('新廠落成開幕暨技術發表');
  await expect(transcript).toContainText('誠摯邀請你，與我們共同開啟嶄新篇章');
  await expect(transcript).toContainText('2026 / 10 / 04(日) 14:00 起，自由入場');
  await expect(transcript).toContainText('320 桃園市中壢區中園路 192 號 5 樓之 1、2');
  await expect(transcript).toContainText('無須事先回覆');
  await expect(transcript).toContainText('14:00 開放入場、迎賓');
  await expect(transcript).toContainText('16:30 活動結束');
  await expect(transcript).toContainText('帆益科技 陳定閎・陳薇 敬邀');
});

test('loads every reading page from the repository-local Figma asset', async ({ page, request }) => {
  const asset = await request.get('./assets/figma-invitation.jpeg');
  expect(asset.ok()).toBe(true);
  expect(asset.headers()['content-type']).toBe('image/jpeg');

  await openInvitation(page);
  const readingPages = page.locator('.design-page');
  await expect(readingPages.locator('img[src="./assets/figma-invitation.jpeg"]')).toHaveCount(4);

  for (let index = 0; index < 4; index += 1) {
    const readingPage = readingPages.nth(index);
    const image = readingPage.locator('img');
    await readingPage.scrollIntoViewIfNeeded();
    await expect.poll(
      () => image.evaluate((element) => ({
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      })),
      { timeout: 10_000 },
    ).toEqual({ complete: true, naturalWidth: 1174, naturalHeight: 4096 });
  }
});

test('shows all four exact design pages when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/Freentity/');
  await expect(page.locator('#invitation-gate')).toBeHidden();
  await expect(page.locator('#invitation')).toBeVisible();
  await expect(page.locator('.design-page')).toHaveCount(4);
  await page.locator('[data-page="4"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await context.close();
});
