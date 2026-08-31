import { expect, test } from '@playwright/test';

async function openInvitation(page, viewport) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewport);
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
}

test('keeps the reading frame free of chrome so the approved artwork stays exact', async ({ page }) => {
  await openInvitation(page, { width: 390, height: 844 });

  const reader = page.locator('#invitation-reader');
  await expect(reader.locator(':scope > *')).toHaveCount(1);
  await expect(reader.locator(':scope > .invitation-scroll')).toHaveCount(1);
  expect((await reader.innerText()).trim()).toBe('');

  for (const selector of ['.reader-progress', '.reader-bar', '.reader-rail', '.reader-toast']) {
    expect(
      await page.locator(selector).evaluate((element) => Boolean(element.closest('#invitation-reader'))),
      selector,
    ).toBe(false);
  }
});

test('tracks reading progress from the top of the invitation to the end', async ({ page }) => {
  await openInvitation(page, { width: 390, height: 844 });

  const progress = page.locator('.reader-progress');
  const readProgress = () => progress.evaluate((element) => (
    Number(getComputedStyle(element).getPropertyValue('--reading-progress'))
  ));

  await expect(progress).not.toHaveClass(/is-active/);
  expect(await readProgress()).toBeCloseTo(0, 2);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(progress).toHaveClass(/is-active/);
  await expect.poll(readProgress).toBeGreaterThan(0.9);
  await expect(page.locator('[data-section-label]')).toHaveText('VENUE');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(progress).not.toHaveClass(/is-active/);
});

test('reveals an accessible tool dock on phones without covering the last page', async ({ page }) => {
  await openInvitation(page, { width: 390, height: 844 });

  const rail = page.locator('.reader-rail');
  await expect(rail).toHaveClass(/is-visible/);
  await expect(rail).toHaveAttribute('aria-label', '邀請函導覽');

  const tools = rail.locator('.tool');
  await expect(tools).toHaveCount(3);
  await expect(tools).toHaveText(['加入行事曆', '開啟地圖', '分享邀請函']);

  const heights = await tools.evaluateAll((elements) => (
    elements.map((element) => element.getBoundingClientRect().height)
  ));
  for (const height of heights) {
    expect(height).toBeGreaterThanOrEqual(44);
  }

  // The dock is fixed, so the reader keeps enough bottom padding to clear it at rest.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const artwork = await page.locator('.invitation-scroll').boundingBox();
  const dock = await rail.boundingBox();
  expect(artwork.y + artwork.height).toBeLessThanOrEqual(dock.y);
});

test('reveals the header only past the cover and tracks the current section', async ({ page }) => {
  await openInvitation(page, { width: 390, height: 844 });

  const bar = page.locator('.reader-bar');
  const label = page.locator('[data-section-label]');

  // Clean cover: no chrome over the first screen.
  await expect(bar).not.toHaveClass(/is-visible/);
  await expect(label).toHaveText('邀請');

  await page.locator('[data-page="2"]').evaluate((page2) => page2.scrollIntoView({ block: 'start' }));
  await expect(bar).toHaveClass(/is-visible/);
  await expect.poll(() => label.textContent()).toBe("WHAT'S NEW");
  await expect(page.locator('.reader-bar__brand')).toHaveAttribute('href', 'https://freentity.com/');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).not.toHaveClass(/is-visible/);
});

test('keeps the rail off screens too short to hold it, falling back to the header', async ({ page }) => {
  // A 1440x900 laptop at 150% browser zoom lands here: wide enough for the rail,
  // too short for it, which used to clip the brand mark off the top.
  await openInvitation(page, { width: 1280, height: 600 });

  await expect(page.locator('.reader-bar')).toHaveCSS('display', 'flex');
  await expect(page.locator('.rail__brand')).toBeHidden();
  await expect(page.locator('.rail__tools .tool')).toHaveCount(3);

  await page.locator('[data-page="2"]').evaluate((page2) => page2.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.reader-bar')).toHaveClass(/is-visible/);

  // The header slides in, so poll until it settles rather than sampling mid-transition.
  const brandBox = () => page.locator('.reader-bar__brand').boundingBox();
  await expect.poll(async () => (await brandBox()).y).toBeGreaterThanOrEqual(0);

  const brand = await brandBox();
  expect(brand.x).toBeGreaterThanOrEqual(0);
  expect(brand.y + brand.height).toBeLessThanOrEqual(600);
});

test('keeps the tall desktop rail fully on screen', async ({ page }) => {
  await openInvitation(page, { width: 1440, height: 1000 });

  await expect(page.locator('.rail__facts')).toContainText('中園路 192 號 5 樓之一');
  await expect(page.locator('.rail__facts')).not.toContainText('1、2');

  const rail = await page.locator('.reader-rail').boundingBox();
  const brand = await page.locator('.rail__brand').boundingBox();
  expect(rail.y).toBeGreaterThanOrEqual(0);
  expect(rail.y + rail.height).toBeLessThanOrEqual(1000);
  expect(brand.y).toBeGreaterThanOrEqual(rail.y - 0.5);
  await expect(page.locator('.reader-bar')).toBeHidden();
});

test('copies the invitation link when the platform has no native share sheet', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
  await openInvitation(page, { width: 390, height: 844 });

  await page.locator('#share-invitation').click();

  const toast = page.locator('#reader-toast');
  await expect(toast).toHaveClass(/is-visible/);
  await expect(toast).toHaveText('已複製邀請函連結');
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('http://127.0.0.1:4173/Freentity/');
});

test('jumps between sections from the desktop rail and marks the current page', async ({ page }) => {
  await openInvitation(page, { width: 1440, height: 1000 });

  await expect(page.locator('.rail__nav button')).toHaveCount(4);
  await expect(page.locator('.rail__nav button[data-goto="1"]')).toHaveAttribute('aria-current', 'true');

  await page.locator('.rail__nav button[data-goto="3"]').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  const thirdAnchor = await page.locator('[data-page="3"]').boundingBox();
  expect(thirdAnchor.y).toBeGreaterThanOrEqual(60);
  expect(thirdAnchor.y).toBeLessThanOrEqual(76);
  await expect(page.locator('.rail__nav button[data-goto="3"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.rail__nav button[aria-current="true"]')).toHaveCount(1);
});

test('reaches every reader control by keyboard once the invitation is open', async ({ page }) => {
  await openInvitation(page, { width: 1440, height: 1000 });

  const reachable = [];
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const active = document.activeElement;
      return active === document.body ? null : (active.textContent ?? '').replace(/\s+/g, ' ').trim();
    });
    if (label) {
      reachable.push(label);
    }
  }

  for (const control of ['帆益科技 FREENTITY', '加入行事曆', '開啟地圖', '分享邀請函']) {
    expect(reachable, control).toContain(control);
  }
});
