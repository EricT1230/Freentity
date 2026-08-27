import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 402, 768, 1440];

for (const width of widths) {
  test(`captures sealed and open states at ${width}px`, async ({ page }) => {
    await mkdir('test-results/visual', { recursive: true });
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.goto('./');
    await page.screenshot({ path: `test-results/visual/${width}-sealed.png` });

    await page.getByRole('button', { name: '開啟邀請' }).click();
    if (width === 390) {
      await page.waitForTimeout(420);
      await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
      await page.screenshot({ path: 'test-results/visual/390-opening.png' });
    }
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
    await page.waitForTimeout(850);
    await page.screenshot({ path: `test-results/visual/${width}-open.png` });

    if (width === 390) {
      for (const chapter of ['letter', 'innovation', 'rundown', 'venue', 'closing']) {
        const section = page.locator(`#${chapter}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveClass(/is-visible/);
        await page.waitForTimeout(850);
        await page.screenshot({ path: `test-results/visual/390-${chapter}.png` });
      }
    }
  });
}
