import { expect, test } from '@playwright/test';

import {
  inspectPocketCoverage,
  observeOpeningTransitions,
  waitForOpeningTransition,
} from './opening-helpers.js';

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

test('presents the closed envelope front with a floating Open invitation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'sealed');
  await expect(page.locator('#invitation-gate')).toBeVisible();
  await expect(page.locator('#invitation')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.envelope-face--front')).toBeVisible();
  // One paper face now: a string tie closes the face you are already looking at.
  await expect(page.locator('.envelope-face--back')).toHaveCount(0);
  await expect(page.locator('.envelope__disc')).toHaveCount(2);
  await expect(page.locator('.tie__cord--wrap')).toHaveCount(3);
  await expect(page.locator('.tie__cord--tail')).toHaveCount(1);
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

test('keeps the larger Freentity wordmark inside the envelope on phone and desktop', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844, minimumFontSize: 22.5 },
    { width: 1440, height: 1000, minimumFontSize: 36 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');

    const shellBox = await page.locator('.envelope-shell').boundingBox();
    const nameBox = await page.locator('.envelope-front__name').boundingBox();
    const fontSize = await page.locator('.envelope-front__name').evaluate((element) => (
      Number.parseFloat(getComputedStyle(element).fontSize)
    ));

    expect(fontSize).toBeGreaterThanOrEqual(viewport.minimumFontSize);
    expect(nameBox.x).toBeGreaterThan(shellBox.x);
    expect(nameBox.x + nameBox.width).toBeLessThan(shellBox.x + shellBox.width);
  }
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
  // The lockup is centred on the flap, above the centred tie.
  expect(brandCenterRatio).toBeGreaterThanOrEqual(.46);
  expect(brandCenterRatio).toBeLessThanOrEqual(.54);
  expect(embossPresentation.tagName).toBe('svg');
  expect(embossPresentation.pathCount).toBeGreaterThanOrEqual(5);
  expect(embossPresentation.maskImage).toBe('none');
  expect(embossPresentation.fill).toBe('none');
  expect(embossPresentation.stroke).not.toBe('none');
  expect(embossLeftRatio).toBeGreaterThan(.45);
});

test('hinges the flap inside a real perspective instead of a flat mirror flip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const depth = await page.evaluate(() => {
    const flap = document.querySelector('.envelope__flap');
    const faces = [...flap.querySelectorAll('.envelope__flap-face')];
    const backfaceOf = (element) => {
      const style = getComputedStyle(element);
      return style.backfaceVisibility || style.webkitBackfaceVisibility;
    };

    return {
      // The flap must take perspective from its DIRECT parent, or folding it back
      // projects orthographically and reads as a mirror flip rather than paper.
      flapParentPerspective: getComputedStyle(flap.parentElement).perspective,
      flapTransformStyle: getComputedStyle(flap).transformStyle,
      flapOrigin: getComputedStyle(flap).transformOrigin,
      flapClipPath: getComputedStyle(flap).clipPath,
      faceCount: faces.length,
      faceBackfaces: faces.map(backfaceOf),
    };
  });

  expect(depth.flapParentPerspective).not.toBe('none');
  expect(Number.parseFloat(depth.flapParentPerspective)).toBeGreaterThan(400);
  // A clip-path on the flap itself would flatten it and cancel its backface pair.
  expect(depth.flapTransformStyle).toBe('preserve-3d');
  expect(depth.flapClipPath).toBe('none');
  expect(depth.flapOrigin.endsWith('0px')).toBe(true);
  expect(depth.faceCount).toBe(2);
  expect(depth.faceBackfaces).toEqual(['hidden', 'hidden']);
});

test('keeps the cord measured in normalised path units at every envelope size', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto('./');

    const tie = await page.evaluate(() => {
      const wraps = [...document.querySelectorAll('.tie__cord--wrap')];
      const tail = document.querySelector('.tie__cord--tail');
      const read = (element) => getComputedStyle(element);

      return {
        // pathLength normalisation is what keeps the dash maths size independent.
        pathLengths: wraps.map((wrap) => wrap.getAttribute('pathLength')),
        tailPathLength: tail.getAttribute('pathLength'),
        woundOffsets: wraps.map((wrap) => Number.parseFloat(read(wrap).strokeDashoffset)),
        tailOffset: Number.parseFloat(read(tail).strokeDashoffset),
        // Separate paths, because an SVG dash pattern restarts at every subpath.
        subpathCounts: wraps.map((wrap) => (wrap.getAttribute('d').match(/M/g) ?? []).length),
        fill: read(wraps[0]).fill,
        cap: read(wraps[0]).strokeLinecap,
      };
    });

    expect(tie.pathLengths, String(viewport.width)).toEqual(['100', '100', '100']);
    expect(tie.tailPathLength).toBe('100');
    expect(tie.woundOffsets).toEqual([0, 0, 0]);
    // A short loose end is already out while tied, which is what reads as string.
    expect(tie.tailOffset).toBeGreaterThan(0);
    expect(tie.tailOffset).toBeLessThan(100);
    expect(tie.subpathCounts).toEqual([1, 1, 1]);
    expect(tie.fill).toBe('none');
    expect(tie.cap).toBe('round');
  }
});

test('sets the sealed stage in the deep green brand palette', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const palette = await page.evaluate(() => ({
    gateImage: getComputedStyle(document.querySelector('#invitation-gate')).backgroundImage,
    prompt: getComputedStyle(document.querySelector('.gate__prompt strong')).color,
    themeColor: document.querySelector('meta[name="theme-color"]').content,
  }));

  const stops = [...palette.gateImage.matchAll(/rgba?\(([^)]+)\)/g)]
    .map(([, channels]) => channels.split(/[,/]/).slice(0, 3).map(Number))
    .filter(([red, green, blue]) => red + green + blue > 0);
  expect(stops.length).toBeGreaterThan(2);
  for (const [red, green, blue] of stops) {
    expect(green).toBeGreaterThanOrEqual(red);
    expect(green).toBeGreaterThanOrEqual(blue);
  }

  // The prompt now sits on that dark stage, so it has to read near-white.
  const [red, green, blue] = palette.prompt.match(/\d+/g).slice(0, 3).map(Number);
  expect(Math.min(red, green, blue)).toBeGreaterThan(200);
  expect(palette.themeColor).toBe('#06170f');
});

test('tilts the sealed envelope toward a fine pointer and releases it on opening', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');

  const readTilt = () => page.locator('.envelope-lift').evaluate((element) => ({
    tiltX: Number.parseFloat(element.style.getPropertyValue('--tilt-x')),
    tiltY: Number.parseFloat(element.style.getPropertyValue('--tilt-y')),
  }));

  const shell = await page.locator('.envelope-shell').boundingBox();
  await page.mouse.move(shell.x + shell.width * 0.92, shell.y + shell.height * 0.9);
  const tilted = await readTilt();
  expect(tilted.tiltY).toBeGreaterThan(1);
  expect(tilted.tiltX).toBeLessThan(-1);

  await page.getByRole('button', { name: 'Open' }).click();
  const released = await readTilt();
  expect(released.tiltX).toBe(0);
  expect(released.tiltY).toBe(0);
});

test('keeps keyboard focus inside the sealed invitation gate', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
});

test('unwinds the tie before opening the flap and extracting the card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await observeOpeningTransitions(page);

  const flap = page.locator('.envelope__flap');
  const letter = page.locator('.envelope__letter');
  const initialLetter = await letter.boundingBox();

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'unwind');

  // Wraps come off outermost first, so the outermost has already gone while the
  // innermost still holds. Cord length is conserved: the tail grows by exactly
  // what the winding gives up.
  await page.waitForFunction(() => {
    const offsets = [...document.querySelectorAll('.tie__cord--wrap')]
      .map((cord) => Number.parseFloat(getComputedStyle(cord).strokeDashoffset));
    return offsets[0] < -95 && offsets[2] > -60;
  }, null, { timeout: 4000 });

  const midUnwind = await page.evaluate(() => ({
    outer: Number.parseFloat(getComputedStyle(document.querySelector('.tie__cord--wrap3')).strokeDashoffset),
    inner: Number.parseFloat(getComputedStyle(document.querySelector('.tie__cord--wrap1')).strokeDashoffset),
    tail: Number.parseFloat(getComputedStyle(document.querySelector('.tie__cord--tail')).strokeDashoffset),
    flapAngle: new DOMMatrix(getComputedStyle(document.querySelector('.envelope__flap')).transform).m22,
  }));
  expect(midUnwind.outer).toBeLessThan(midUnwind.inner);
  expect(midUnwind.tail).toBeLessThan(74);
  // The flap stays shut for as long as any wrap still holds it.
  expect(midUnwind.flapAngle).toBeGreaterThan(.99);

  await waitForOpeningTransition(page, 'cord', 'transitionend', 'unwind');
  await page.waitForFunction(() => window.__untiedSnapshot !== null, null, { timeout: 6000 });
  const untied = await page.evaluate(() => window.__untiedSnapshot);
  expect(untied.stillWound).toBe(0);
  expect(untied.tailOffset).toBeCloseTo(0, 0);
  expect(untied.flapAngle).toBeGreaterThan(.99);
  expect(untied.exposedBelowEnvelope).toBe(0);

  await waitForOpeningTransition(page, 'flap', 'transitionstart', 'flap');
  await waitForOpeningTransition(page, 'flap', 'transitionend', 'flap');
  const openFlapM22 = await flap.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m22);
  expect(openFlapM22).toBeLessThan(-0.75);
  const pocketCoverage = await inspectPocketCoverage(letter);
  expect(pocketCoverage.exposedSamples).toBe(0);
  expect(pocketCoverage.exposedBelowEnvelope).toBe(0);
  const readyLetter = await letter.boundingBox();
  expect(readyLetter.y).toBeLessThan(initialLetter.y - 40);

  await waitForOpeningTransition(page, 'letter', 'transitionend', 'card');
  const risenLetter = await letter.boundingBox();
  expect(risenLetter.y).toBeLessThan(readyLetter.y - 30);
  expect(await letter.evaluate((element) => getComputedStyle(element).clipPath)).toMatch(/^inset\(0px\)/);

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const eventFor = (stage, type, phase) => transitions.find(
    (event) => event.stage === stage && event.type === type && event.phase === phase,
  );
  const cordEnd = eventFor('cord', 'transitionend', 'unwind');
  const flapStart = eventFor('flap', 'transitionstart', 'flap');
  const flapEnd = eventFor('flap', 'transitionend', 'flap');
  const cardStart = eventFor('letter', 'transitionstart', 'card');
  const cardEnd = eventFor('letter', 'transitionend', 'card');
  expect(flapStart.at - cordEnd.at).toBeGreaterThanOrEqual(70);
  expect(flapStart.at - cordEnd.at).toBeLessThanOrEqual(450);
  expect(flapEnd.elapsedTime).toBeGreaterThanOrEqual(.72);
  expect(cardStart.at - flapEnd.at).toBeGreaterThanOrEqual(70);
  expect(cardStart.at - flapEnd.at).toBeLessThanOrEqual(450);
  expect(cardEnd.elapsedTime).toBeGreaterThanOrEqual(.95);
});

test('lets the card peek above the pocket mouth while the flap is lifting', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap', { timeout: 4000 });

  await page.waitForFunction(() => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('.envelope__flap')).transform);
    return document.documentElement.dataset.openingPhase === 'flap' && matrix.m22 < -.2;
  });

  const exposure = await page.locator('.envelope-shell').evaluate((shell) => {
    const shellRect = shell.getBoundingClientRect();
    const letter = shell.querySelector('.envelope__letter');
    const pocket = shell.querySelector('.envelope__pocket');
    const letterRect = letter.getBoundingClientRect();
    const pocketRect = pocket.getBoundingClientRect();
    const letterStyle = getComputedStyle(letter);
    // The card only shows in the band between its own top edge and the mouth.
    const visibleSamples = [
      [.3, .33], [.5, .33], [.7, .33], [.4, .38], [.6, .38],
    ].filter(([x, y]) => {
      const visibleElement = document.elementFromPoint(
        shellRect.left + shellRect.width * x,
        shellRect.top + shellRect.height * y,
      );
      return visibleElement?.closest('.envelope__letter') === letter;
    }).length;

    return {
      flapAngle: new DOMMatrix(getComputedStyle(shell.querySelector('.envelope__flap')).transform).m22,
      letterTopRatio: (letterRect.top - shellRect.top) / shellRect.height,
      pocketTopRatio: (pocketRect.top - shellRect.top) / shellRect.height,
      letterClipBottom: Number(letterStyle.clipPath.match(/[\d.]+%/)?.[0].replace('%', '')),
      letterOpacity: Number(letterStyle.opacity),
      letterZIndex: Number(letterStyle.zIndex),
      pocketZIndex: Number(getComputedStyle(pocket).zIndex),
      visibleSamples,
    };
  });

  expect(exposure.flapAngle).toBeLessThan(-.2);
  expect(exposure.letterTopRatio).toBeGreaterThan(.26);
  expect(exposure.letterTopRatio).toBeLessThan(.42);
  // The card has to clear the mouth to be seen at all.
  expect(exposure.letterTopRatio).toBeLessThan(exposure.pocketTopRatio);
  expect(exposure.letterClipBottom).toBeGreaterThan(30);
  expect(exposure.letterClipBottom).toBeLessThan(60);
  expect(exposure.letterOpacity).toBe(1);
  expect(exposure.letterZIndex).toBeLessThan(exposure.pocketZIndex);
  if (browserName !== 'webkit') {
    expect(exposure.visibleSamples).toBeGreaterThanOrEqual(2);
  }
});

test('uses contact shadows to separate the opened envelope layers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap', { timeout: 4000 });
  await expect(page.locator('.envelope__inner-shadow')).toHaveCount(1);
  await page.waitForFunction(() => {
    const shadow = document.querySelector('.envelope__inner-shadow');
    return shadow && Number(getComputedStyle(shadow).opacity) > .12;
  });

  const depth = await page.locator('.envelope-shell').evaluate((shell) => ({
    innerShadowOpacity: Number(getComputedStyle(shell.querySelector('.envelope__inner-shadow')).opacity),
    pocketShadow: getComputedStyle(shell.querySelector('.envelope__pocket')).boxShadow,
    flapShadow: getComputedStyle(shell.querySelector('.envelope__flap-face--inner')).boxShadow,
    cordShadow: getComputedStyle(shell.querySelector('.envelope__tie')).filter,
  }));

  expect(depth.innerShadowOpacity).toBeGreaterThan(.12);
  expect(depth.pocketShadow).not.toBe('none');
  expect(depth.flapShadow).not.toBe('none');
  expect(depth.cordShadow).toContain('drop-shadow');
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

  const innerShadowTransition = await page.locator('.envelope__inner-shadow').evaluate((element) => (
    getComputedStyle(element).transitionDuration
      .split(',')
      .map((duration) => Number.parseFloat(duration) * (duration.includes('ms') ? .001 : 1))
  ));
  expect(Math.max(...innerShadowTransition)).toBeLessThanOrEqual(.25);

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  // Shorter, but every beat still happens: untie, then lift, then extract.
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'unwind');
  await waitForOpeningTransition(page, 'cord', 'transitionend', 'unwind');

  await waitForOpeningTransition(page, 'flap', 'transitionend', 'flap');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'flap-open');

  await waitForOpeningTransition(page, 'letter', 'transitionstart', 'card');
  await expect(page.locator('html')).toHaveAttribute('data-opening-phase', 'card');
  await waitForOpeningTransition(page, 'letter', 'transitionend', 'card');

  const transitions = await page.evaluate(() => window.__openingTransitions);
  const elapsedFor = (stage, phase) => transitions.find(
    (event) => event.stage === stage
      && event.type === 'transitionend'
      && (!phase || event.phase === phase),
  ).elapsedTime;
  expect(elapsedFor('cord')).toBeGreaterThanOrEqual(.14);
  expect(elapsedFor('flap')).toBeGreaterThanOrEqual(.28);
  expect(elapsedFor('letter', 'card')).toBeGreaterThanOrEqual(.4);
  expect(elapsedFor('letter', 'card')).toBeLessThanOrEqual(.55);

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
