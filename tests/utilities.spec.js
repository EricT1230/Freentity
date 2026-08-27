import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const expectedFigmaAssetSha256 = 'a61257abec55ce2736aded16299a2110d51fd5cceb57b7f3e3f37c38a8a7e659';

async function openInvitation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });
}

test('ships the exact original image bytes exported from the Figma frame', async () => {
  const asset = await readFile('assets/figma-invitation.jpeg');
  expect(createHash('sha256').update(asset).digest('hex')).toBe(expectedFigmaAssetSha256);
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
  await expect(page.locator('.design-page img[src="./assets/figma-invitation.jpeg"]')).toHaveCount(4);
  for (const image of await page.locator('.design-page img').all()) {
    expect(await image.evaluate((element) => element.complete && element.naturalWidth === 1174 && element.naturalHeight === 4096)).toBe(true);
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
