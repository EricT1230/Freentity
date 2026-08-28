import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const accessibilityTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function violationSummary(results) {
  return results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map((node) => node.target),
  }));
}

test('loads and opens without browser errors or failed same-origin requests', async ({ page }) => {
  const browserErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4173/Freentity/')) {
      failedRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });

  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('keeps local LCP and CLS within the browser QA budgets', async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaMetrics = { cls: 0, lcp: 0 };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__qaMetrics.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__qaMetrics.lcp = entries.at(-1)?.startTime ?? window.__qaMetrics.lcp;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto('./');

  // Wait for the entry rather than sleeping a fixed 500ms: a cold CI runner can
  // paint later than that, which failed the run for a timing reason instead of a
  // budget one. The budget itself is what this test is actually about.
  await page.waitForFunction(() => window.__qaMetrics.lcp > 0, null, { timeout: 10_000 });
  // Give layout shifts a window to land before reading CLS.
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => window.__qaMetrics);

  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeLessThan(2500);
  expect(metrics.cls).toBeLessThan(0.1);
});

test('has no automatically detectable WCAG A or AA violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const sealed = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
  expect(violationSummary(sealed)).toEqual([]);

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
  const open = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
  expect(violationSummary(open)).toEqual([]);
});
