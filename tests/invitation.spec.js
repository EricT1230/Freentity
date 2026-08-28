import { expect, test } from '@playwright/test';

const sourceAsset = './assets/figma-invitation.jpeg';
const envelopeCardAsset = './assets/envelope-card.jpg';
const envelopeLogoAsset = './assets/freentity-logo.png';
const slices = [
  { page: '1', start: 0, end: 339 },
  { page: '2', start: 339, end: 724 },
  { page: '3', start: 724, end: 1000 },
  { page: '4', start: 1000, end: 1404 },
];

async function openInvitation(page, { reducedMotion = false } = {}) {
  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', {
    timeout: reducedMotion ? 4000 : 8000,
  });
}

async function observeOpeningTransitions(page) {
  await page.evaluate(() => {
    window.__openingTransitions = [];
    const stages = {
      shell: document.querySelector('.envelope-shell'),
      flap: document.querySelector('.envelope__flap'),
      letter: document.querySelector('.envelope__letter'),
    };

    for (const [stage, element] of Object.entries(stages)) {
      for (const type of ['transitionstart', 'transitionend']) {
        element.addEventListener(type, (event) => {
          if (event.propertyName === 'transform') {
            window.__openingTransitions.push({
              stage,
              type,
              at: performance.now(),
              elapsedTime: event.elapsedTime,
            });
          }
        });
      }
    }
  });
}

async function waitForOpeningTransition(page, stage, type) {
  await page.waitForFunction(
    ([expectedStage, expectedType]) => window.__openingTransitions?.some(
      (event) => event.stage === expectedStage && event.type === expectedType,
    ),
    [stage, type],
    { timeout: 8000 },
  );
}

async function inspectConcealedLetter(letter) {
  return letter.evaluate((element) => {
    const letterRect = element.getBoundingClientRect();
    const envelopeRect = element.closest('.envelope-shell').getBoundingClientRect();
    const coveredPoints = [.7, .8, .9].flatMap((yRatio) => (
      [.2, .5, .8].map((xRatio) => [xRatio, yRatio])
    ));

    return {
      topRatio: (letterRect.top - envelopeRect.top) / envelopeRect.height,
      clipPath: getComputedStyle(element).clipPath,
      exposedSamples: coveredPoints.filter(([xRatio, yRatio]) => {
        const topElement = document.elementFromPoint(
          envelopeRect.left + envelopeRect.width * xRatio,
          envelopeRect.top + envelopeRect.height * yRatio,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
      exposedBelowEnvelope: [.2, .5, .8].filter((xRatio) => {
        const topElement = document.elementFromPoint(
          envelopeRect.left + envelopeRect.width * xRatio,
          envelopeRect.bottom + 2,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
    };
  });
}

test('presents the closed envelope front with a floating Open invitation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'sealed');
  await expect(page.locator('#invitation-gate')).toBeVisible();
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.envelope-face--front')).toBeVisible();
  await expect(page.locator('.envelope-face--back')).toHaveCount(1);
  await expect(page.locator('.envelope-front__logo')).toHaveAttribute('src', envelopeLogoAsset);
  await expect(page.locator('.envelope-front__logo')).toHaveJSProperty('naturalWidth', 292);
  await expect(page.locator('.envelope-front__logo')).toHaveJSProperty('naturalHeight', 292);
  await expect(page.locator('.envelope-front__name')).toHaveText('Freentity');
  await expect(page.locator('.envelope-front__motif')).toHaveCount(0);
  await expect(page.locator('.envelope-front__emboss')).toHaveCount(1);
  await expect(page.locator('.envelope__letter img')).toHaveAttribute('src', envelopeCardAsset);
  await expect(page.locator('.envelope__letter img')).toHaveAttribute('width', '1280');
  await expect(page.locator('.envelope__letter img')).toHaveAttribute('height', '720');
  await expect(page.locator('.envelope__letter img')).toHaveJSProperty('naturalWidth', 1280);
  await expect(page.locator('.envelope__letter img')).toHaveJSProperty('naturalHeight', 720);
  await expect(page.locator('.gate__prompt')).toHaveText('Open');

  const presentation = await page.getByRole('button', { name: 'Open' }).evaluate((button) => {
    const buttonStyle = getComputedStyle(button);
    const promptStyle = getComputedStyle(button.querySelector('.gate__prompt strong'));
    const cardStyle = getComputedStyle(button.querySelector('.envelope__letter img'));
    const logoStyle = getComputedStyle(button.querySelector('.envelope-front__logo'));
    const embossStyle = getComputedStyle(button.querySelector('.envelope-front__emboss'));

    return {
      buttonBackground: buttonStyle.backgroundColor,
      buttonBorderWidth: buttonStyle.borderTopWidth,
      promptBackground: promptStyle.backgroundColor,
      promptBorderWidth: promptStyle.borderTopWidth,
      cardFilter: cardStyle.filter,
      logoFilter: logoStyle.filter,
      logoMixBlendMode: logoStyle.mixBlendMode,
      logoOpacity: logoStyle.opacity,
      embossFilter: embossStyle.filter,
      embossPathCount: button.querySelectorAll('.envelope-front__emboss path').length,
      embossMaskImage: embossStyle.maskImage === 'none'
        ? embossStyle.webkitMaskImage
        : embossStyle.maskImage,
    };
  });
  expect(presentation.buttonBackground).toBe('rgba(0, 0, 0, 0)');
  expect(presentation.buttonBorderWidth).toBe('0px');
  expect(presentation.promptBackground).toBe('rgba(0, 0, 0, 0)');
  expect(presentation.promptBorderWidth).toBe('0px');
  expect(presentation.cardFilter).toBe('none');
  expect(presentation.logoFilter).toBe('none');
  expect(presentation.logoMixBlendMode).toBe('normal');
  expect(presentation.logoOpacity).toBe('1');
  expect(presentation.embossFilter).toContain('drop-shadow');
  expect(presentation.embossPathCount).toBeGreaterThanOrEqual(5);
  expect(presentation.embossMaskImage).toBe('none');

  const envelope = await page.locator('.envelope-shell').boundingBox();
  const prompt = await page.locator('.gate__prompt').boundingBox();
  expect(envelope.width).toBeLessThanOrEqual(358);
  expect(envelope.y + envelope.height).toBeLessThan(prompt.y);
  expect(prompt.y + prompt.height).toBeLessThanOrEqual(832);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('preserves the official full-color logo on the extracted invitation card', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'card', { timeout: 3000 });

  const cardFilter = await page.locator('.envelope__letter img')
    .evaluate((image) => getComputedStyle(image).filter);

  expect(cardFilter).toBe('none');
});

test('matches the approved compact envelope front with a right-side line emboss', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const shell = page.locator('.envelope-shell');
  const brand = page.locator('.envelope-front__brand');
  const emboss = page.locator('.envelope-front__emboss');
  const shellBox = await shell.boundingBox();
  const brandBox = await brand.boundingBox();
  const embossBox = await emboss.boundingBox();
  const embossPresentation = await emboss.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      tagName: element.tagName.toLowerCase(),
      pathCount: element.querySelectorAll('path').length,
      maskImage: style.maskImage === 'none' ? style.webkitMaskImage : style.maskImage,
      fill: style.fill,
      stroke: style.stroke,
    };
  });

  const shellRatio = shellBox.width / shellBox.height;
  const brandCenterRatio = (brandBox.x + brandBox.width / 2 - shellBox.x) / shellBox.width;
  const embossLeftRatio = (embossBox.x - shellBox.x) / shellBox.width;

  expect(shellRatio).toBeGreaterThanOrEqual(1.38);
  expect(shellRatio).toBeLessThanOrEqual(1.48);
  expect(brandCenterRatio).toBeGreaterThanOrEqual(.4);
  expect(brandCenterRatio).toBeLessThanOrEqual(.49);
  expect(embossPresentation.tagName).toBe('svg');
  expect(embossPresentation.pathCount).toBeGreaterThanOrEqual(5);
  expect(embossPresentation.maskImage).toBe('none');
  expect(embossPresentation.fill).toBe('none');
  expect(embossPresentation.stroke).not.toBe('none');
  expect(embossLeftRatio).toBeGreaterThan(.45);
});

test('keeps keyboard focus inside the sealed invitation gate', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('flips to the back before opening the flap and extracting the card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await observeOpeningTransitions(page);

  const shell = page.locator('.envelope-shell');
  const flap = page.locator('.envelope-face--back .envelope__flap');
  const letter = page.locator('.envelope-face--back .envelope__letter');
  const initialLetter = await letter.boundingBox();

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await waitForOpeningTransition(page, 'shell', 'transitionend');
  const flippedM11 = await shell.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m11);
  expect(flippedM11).toBeLessThan(-0.85);
  const faceOpacities = await page.locator('.envelope-shell').evaluate((element) => ({
    front: Number(getComputedStyle(element.querySelector('.envelope-face--front')).opacity),
    back: Number(getComputedStyle(element.querySelector('.envelope-face--back')).opacity),
  }));
  expect(faceOpacities.front).toBeLessThan(.01);
  expect(faceOpacities.back).toBeGreaterThan(.99);
  const heldSealOpacity = await page.locator('.envelope__seal').evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(heldSealOpacity).toBeGreaterThan(.9);
  const concealedLetter = await inspectConcealedLetter(letter);
  expect(concealedLetter.topRatio).toBeGreaterThanOrEqual(.64);
  expect(concealedLetter.clipPath).toContain('60%');
  expect(concealedLetter.exposedSamples).toBe(0);
  expect(concealedLetter.exposedBelowEnvelope).toBe(0);

  await waitForOpeningTransition(page, 'flap', 'transitionstart');
  await waitForOpeningTransition(page, 'flap', 'transitionend');
  const openFlapM22 = await flap.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m22);
  expect(openFlapM22).toBeLessThan(-0.75);
  const flapOpenLetter = await inspectConcealedLetter(letter);
  expect(flapOpenLetter.exposedSamples).toBe(0);
  expect(flapOpenLetter.exposedBelowEnvelope).toBe(0);
  const readyLetter = await letter.boundingBox();
  expect(Math.abs(readyLetter.y - initialLetter.y)).toBeLessThan(3);

  await waitForOpeningTransition(page, 'letter', 'transitionend');
  const risenLetter = await letter.boundingBox();
  expect(risenLetter.y).toBeLessThan(initialLetter.y - 30);
  expect(await letter.evaluate((element) => getComputedStyle(element).clipPath)).toMatch(/^inset\(0px\)/);

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const eventFor = (stage, type) => transitions.find((event) => event.stage === stage && event.type === type);
  const eventAt = (stage, type) => eventFor(stage, type).at;
  expect(eventFor('shell', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(.95);
  expect(eventAt('flap', 'transitionstart') - eventAt('shell', 'transitionend')).toBeGreaterThanOrEqual(500);
  expect(eventFor('flap', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(.8);
  expect(eventAt('letter', 'transitionstart') - eventAt('flap', 'transitionend')).toBeGreaterThanOrEqual(450);
  expect(eventFor('letter', 'transitionend').elapsedTime).toBeGreaterThanOrEqual(1.05);
});

test('opens once and lands on the first design page without a scroll jump', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const openButton = page.getByRole('button', { name: 'Open' });

  await openButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
  await expect(openButton).toBeDisabled();
  await expect(page.locator('#invitation')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('#invitation').contains(document.activeElement))).toBe(false);
  await page.evaluate(() => document.querySelector('#open-invitation').click());
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#invitation')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#invitation')).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  const firstPage = await page.locator('[data-page="1"]').boundingBox();
  expect(firstPage.y).toBeGreaterThanOrEqual(0);
  expect(firstPage.y).toBeLessThan(3);
});

for (const key of ['Enter', 'Space']) {
  test(`opens from the ${key} key`, async ({ page }) => {
    await page.goto('./');
    const openButton = page.getByRole('button', { name: 'Open' });
    await openButton.focus();
    await page.keyboard.press(key);
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 8000 });
  });
}

test('keeps a shorter but complete opening sequence when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await observeOpeningTransitions(page);

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await waitForOpeningTransition(page, 'shell', 'transitionend');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'back');

  await waitForOpeningTransition(page, 'flap', 'transitionend');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap-open');

  await waitForOpeningTransition(page, 'letter', 'transitionstart');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'card');
  await waitForOpeningTransition(page, 'letter', 'transitionend');

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const elapsedFor = (stage) => transitions.find(
    (event) => event.stage === stage && event.type === 'transitionend',
  ).elapsedTime;
  expect(elapsedFor('shell')).toBeGreaterThanOrEqual(.35);
  expect(elapsedFor('flap')).toBeGreaterThanOrEqual(.28);
  expect(elapsedFor('letter')).toBeGreaterThanOrEqual(.4);

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 4000 });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
});

test('fails open to the readable invitation if the interaction module cannot load', async ({ page }) => {
  await page.route('**/script.js', (route) => route.abort('failed'));
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 6000 });
  await expect(page.locator('#invitation-gate')).toBeHidden();
  await expect(page.locator('#invitation')).toBeVisible();
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#invitation')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.design-page.is-visible')).toHaveCount(4);
});

test('shows the untouched Figma artwork as four complete, non-overlapping reading pages', async ({ page }) => {
  await openInvitation(page, { reducedMotion: true });

  const pages = page.locator('.design-page');
  await expect(pages).toHaveCount(slices.length);

  for (const slice of slices) {
    const designPage = page.locator(`[data-page="${slice.page}"]`);
    await expect(designPage).toHaveAttribute('data-slice-start', String(slice.start));
    await expect(designPage).toHaveAttribute('data-slice-end', String(slice.end));
    await expect(designPage.locator('.design-page__crop > img')).toHaveAttribute('src', sourceAsset);
    await expect(designPage.locator('.design-page__crop > img')).toHaveAttribute('width', '1174');
    await expect(designPage.locator('.design-page__crop > img')).toHaveAttribute('height', '4096');
    expect((await designPage.innerText()).trim()).toBe('');
  }

  const ranges = await pages.evaluateAll((elements) => elements.map((element) => ({
    start: Number(element.dataset.sliceStart),
    end: Number(element.dataset.sliceEnd),
  })));
  expect(ranges).toEqual(slices.map(({ start, end }) => ({ start, end })));
  expect(ranges[0].start).toBe(0);
  expect(ranges.at(-1).end).toBe(1404);
  for (let index = 1; index < ranges.length; index += 1) {
    expect(ranges[index].start).toBe(ranges[index - 1].end);
  }
});

test('maps every page crop to the matching coordinates in the 402 by 1404 Figma frame', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openInvitation(page, { reducedMotion: true });

  for (const slice of slices) {
    const designPage = page.locator(`[data-page="${slice.page}"]`);
    const cropBox = await designPage.locator('.design-page__crop').boundingBox();
    const imageBox = await designPage.locator('img').boundingBox();

    expect(cropBox.width).toBeCloseTo(402, 0);
    expect(cropBox.height).toBeCloseTo(slice.end - slice.start, 0);
    expect(imageBox.height).toBeCloseTo(1404, 0);
    expect(imageBox.y).toBeCloseTo(cropBox.y - slice.start, 0);
  }
});

test('reveals each paper page as it enters the reading viewport', async ({ page }) => {
  await openInvitation(page, { reducedMotion: false });
  await expect(page.locator('[data-page="1"]')).toHaveClass(/is-visible/);

  const fourthPage = page.locator('[data-page="4"]');
  await fourthPage.scrollIntoViewIfNeeded();
  await expect(fourthPage).toHaveClass(/is-visible/);
});
