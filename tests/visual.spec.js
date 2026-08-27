import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 402, 768, 1440, 2048];

for (const width of widths) {
  test(`captures sealed and exact-design reading states at ${width}px`, async ({ page }) => {
    await mkdir('test-results/visual', { recursive: true });
    await page.setViewportSize({ width, height: width >= 1900 ? 1150 : width >= 768 ? 1000 : 844 });
    await page.goto('./');
    await page.screenshot({ path: `test-results/visual/${width}-sealed.png` });

    await page.getByRole('button', { name: 'Open' }).click();
    if (width === 390) {
      await page.waitForTimeout(450);
      await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
      await page.screenshot({ path: 'test-results/visual/390-opening.png' });
      await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'back', { timeout: 3000 });
      await page.screenshot({ path: 'test-results/visual/390-back.png' });
      await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap-open', { timeout: 3000 });
      await page.screenshot({ path: 'test-results/visual/390-flap-open.png' });
      await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'card', { timeout: 3000 });
      await page.waitForTimeout(420);
      await page.screenshot({ path: 'test-results/visual/390-card-rise.png' });
    }
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `test-results/visual/${width}-open.png` });

    if (width === 390) {
      for (const pageNumber of ['1', '2', '3', '4']) {
        const designPage = page.locator(`[data-page="${pageNumber}"]`);
        await designPage.scrollIntoViewIfNeeded();
        await expect(designPage).toHaveClass(/is-visible/);
        await page.waitForTimeout(700);
        await designPage.screenshot({ path: `test-results/visual/390-page-${pageNumber}.png` });
      }
    }
  });
}
