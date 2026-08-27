import { expect, test } from '@playwright/test';

async function openInvitation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });
}

test('uses the exact venue and repository-local calendar', async ({ page, request }) => {
  await page.goto('./');

  const mapHref = await page.locator('[data-action="map"]').getAttribute('href');
  expect(decodeURIComponent(mapHref)).toContain('320 桃園市中壢區中園路 192 號 5 樓之 1 、2');

  await expect(page.locator('[data-action="calendar"]')).toHaveAttribute('href', './assets/event.ics');
  const calendar = await request.get('./assets/event.ics');
  expect(calendar.ok()).toBe(true);
  const body = await calendar.text();
  expect(body).toContain('DTSTART;TZID=Asia/Taipei:20261004T140000');
  expect(body).toContain('DTEND;TZID=Asia/Taipei:20261004T163000');
  expect(body).toContain('LOCATION:320 桃園市中壢區中園路 192 號 5 樓之 1、2');
});

test('passes the exact event details to native sharing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: async (data) => { window.__sharedInvitation = data; },
      configurable: true,
    });
  });
  await openInvitation(page);
  await page.getByRole('button', { name: '分享邀請' }).click();
  await expect(page.locator('#share-status')).toHaveText('分享視窗已開啟。');
  expect(await page.evaluate(() => window.__sharedInvitation)).toEqual({
    title: '帆益科技｜新廠落成開幕暨技術發表',
    text: '誠摯邀請您參加帆益科技新廠落成開幕暨技術發表。',
    url: page.url(),
  });
});

test('shares a clean top-level URL instead of a chapter anchor', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: async (data) => { window.__sharedInvitation = data; },
      configurable: true,
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#closing');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await page.locator('#closing').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '分享邀請' }).click();

  const sharedUrl = await page.evaluate(() => window.__sharedInvitation.url);
  expect(sharedUrl).toBe(page.url().split('#')[0]);
});

test('copies the URL when native sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (value) => { window.__copiedInvitationUrl = value; } },
      configurable: true,
    });
  });
  await openInvitation(page);
  await page.getByRole('button', { name: '分享邀請' }).click();
  await expect(page.locator('#share-status')).toHaveText('邀請函網址已複製。');
  expect(await page.evaluate(() => window.__copiedInvitationUrl)).toBe(page.url());
});

test('reveals a manual URL when share and clipboard both fail', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await openInvitation(page);
  await page.getByRole('button', { name: '分享邀請' }).click();
  await expect(page.locator('#manual-share')).toBeVisible();
  await expect(page.locator('#share-url')).toHaveValue(page.url());
});

test('renders the complete invitation without a raster artwork dependency', async ({ page }) => {
  await page.route(/\.(?:png|webp|jpe?g)(?:\?.*)?$/i, (route) => route.abort());
  await openInvitation(page);
  await expect(page.locator('.invitation__artwork')).toHaveCount(0);
  await expect(page.locator('#invitation > section[data-chapter]')).toHaveCount(6);
  await expect(page.locator('#cover')).toContainText('2026 / 10 / 04');
  await expect(page.locator('#cover')).toContainText('桃園市中壢區中園路 192 號');
  await expect(page.locator('#rundown')).toContainText('無須事先回覆');
  await expect(page.getByRole('heading', { name: '當日流程' })).toBeAttached();
  await expect(page.getByRole('heading', { name: '地點與交通' })).toBeAttached();
});

test('shows the invitation when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/Freentity/');
  await expect(page.locator('#invitation')).toBeVisible();
  await expect(page.getByRole('link', { name: '開啟地圖導航' })).toBeVisible();
  await expect(page.getByRole('link', { name: '加入行事曆' })).toBeVisible();
  await expect(page.getByRole('button', { name: '分享邀請' })).toBeHidden();
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await context.close();
});
