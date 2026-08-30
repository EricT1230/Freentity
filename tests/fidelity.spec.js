import { expect, test } from '@playwright/test';

test('renders the approved long invitation without crop, filter, or reconstruction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });

  const artwork = page.locator('#invitation-reader > .invitation-scroll');
  const image = artwork.locator(':scope > img');
  await expect(artwork).toHaveCount(1);
  await expect(image).toHaveAttribute('width', '2340');
  await expect(image).toHaveAttribute('height', '11245');

  const rendering = await image.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();

    return {
      display: style.display,
      filter: style.filter,
      opacity: style.opacity,
      objectFit: style.objectFit,
      renderedRatio: bounds.height / bounds.width,
    };
  });

  expect(rendering.display).toBe('block');
  expect(rendering.filter).toBe('none');
  expect(rendering.opacity).toBe('1');
  expect(rendering.objectFit).toBe('fill');
  expect(rendering.renderedRatio).toBeCloseTo(11245 / 2340, 3);
});
