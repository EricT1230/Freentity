import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const expectedInvitationAssetSha256 = '14336c46d02c0a720eae5d4c7dc5ebc2f19bfc000a9c651676577e06b1f069b7';
const expectedResponsiveInvitationAssetSha256 = 'fbbcca1c1bf741d1f3f2e0c42cd3e23b94a74f6f3530a7ed9b58319f1f2a7851';
const expectedOfficialLogoSha256 = '2582061e74f0166c3dd4151f878271c7b0e5825add755646af06a30e41fb9a4d';
const expectedEnvelopeCardSha256 = '88ba4ac271c6952aa5f35d875cdfebf4e97d2e415895e3d58aca19b567c5a6ac';
const expectedSocialPreviewSha256 = '88ba4ac271c6952aa5f35d875cdfebf4e97d2e415895e3d58aca19b567c5a6ac';

async function openInvitation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
}

test('ships the exact invitation artwork rendered from the approved PDF', async () => {
  const asset = await readFile('assets/figma-invitation.jpeg');
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedInvitationAssetSha256);

  const responsiveAsset = await readFile('assets/figma-invitation-1170.jpeg');
  expect(createHash('sha256').update(responsiveAsset).digest('hex')).toBe(expectedResponsiveInvitationAssetSha256);
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

test('ships a cache-busting copy of the supplied social preview artwork', async () => {
  const originalAsset = await readFile('assets/social-preview.jpg');
  const versionedAsset = await readFile('assets/social-preview-20260830.jpg');

  expect(createHash('sha256').update(versionedAsset).digest('hex')).toBe(expectedSocialPreviewSha256);
  expect(versionedAsset.equals(originalAsset)).toBe(true);
});

test('keeps the complete invitation transcript available to assistive technology', async ({ page }) => {
  await openInvitation(page);
  const transcript = page.locator('#invitation-transcript');

  await expect(transcript).toContainText('新廠落成開幕暨技術發表');
  await expect(transcript).toContainText('誠摯邀請你，與我們共同開啟嶄新篇章');
  await expect(transcript).toContainText('2026 / 10 / 04(日) 14:00 起，自由入場');
  await expect(transcript).toContainText('320 桃園市中壢區中園路 192 號 5 樓之一');
  await expect(transcript).not.toContainText('無須事先回覆');
  await expect(transcript).toContainText('14:00 開放入場、迎賓');
  await expect(transcript).toContainText('16:30 活動結束');
  await expect(transcript).toContainText('帆益科技 陳定閎・陳薇・全體夥伴 敬邀');
});

test('loads the approved invitation as one continuous responsive artwork', async ({ page, request }) => {
  for (const path of [
    './assets/figma-invitation-1170.jpeg',
    './assets/figma-invitation.jpeg',
  ]) {
    const asset = await request.get(path);
    expect(asset.ok(), path).toBe(true);
    expect(asset.headers()['content-type']).toBe('image/jpeg');
  }

  await openInvitation(page);
  const artwork = page.locator('#invitation-reader > .invitation-scroll');
  await expect(artwork).toHaveCount(1);
  await expect(artwork.locator('img')).toHaveAttribute('src', './assets/figma-invitation.jpeg');
  await expect(artwork.locator('img')).toHaveAttribute(
    'srcset',
    './assets/figma-invitation-1170.jpeg 1170w, ./assets/figma-invitation.jpeg 2340w',
  );
  await expect.poll(
    () => artwork.locator('img').evaluate((element) => ({
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    })),
    { timeout: 10_000 },
  ).toMatchObject({ complete: true });
  const imageRatio = await artwork.locator('img').evaluate(
    (element) => element.naturalHeight / element.naturalWidth,
  );
  expect(imageRatio).toBeCloseTo(11245 / 2340, 2);
});

test('shows the complete continuous invitation when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/Freentity/');
  await expect(page.locator('#invitation-gate')).toBeHidden();
  await expect(page.locator('#invitation')).toBeVisible();
  await expect(page.locator('.invitation-scroll')).toHaveCount(1);
  await page.locator('.invitation-scroll').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await context.close();
});
