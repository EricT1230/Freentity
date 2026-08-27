import { expect, test } from '@playwright/test';

test('renders the reconstructed 402 by 1404 reader pixel-for-pixel from the approved Figma frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });

  await page.addStyleTag({
    content: `
      .reader { gap: 0 !important; padding: 0 !important; }
      .design-page { box-shadow: none !important; }
    `,
  });

  const reader = page.locator('#invitation-reader');
  await expect(reader).toHaveScreenshot('approved-figma-frame.png', {
    animations: 'disabled',
    maxDiffPixels: 0,
  });
});
