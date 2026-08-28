import { expect, test } from '@playwright/test';

test('renders the reconstructed 402 by 1404 reader pixel-for-pixel from the approved PDF', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

  // Neutralise everything that is presentation rather than artwork: the reading gaps,
  // the paper shadow, and the fixed navigation chrome that a stitched element
  // screenshot would otherwise composite over the page.
  await page.addStyleTag({
    content: `
      .reader { gap: 0 !important; padding: 0 !important; }
      .design-page { box-shadow: none !important; }
      .reader-progress,
      .reader-rail,
      .reader-toast { display: none !important; }
    `,
  });

  const reader = page.locator('#invitation-reader');
  await expect(reader).toHaveScreenshot('approved-invitation-frame.png', {
    animations: 'disabled',
    maxDiffPixels: 0,
  });
});
