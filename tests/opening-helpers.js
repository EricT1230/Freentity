/* Shared instrumentation for the string-tie opening sequence.
   Imported by invitation.spec.js and iphone.spec.js; Playwright collects only
   *.spec.js, so this module is never run as a suite of its own. */

// The three stages of the sequence and the property each one animates.
export const OPENING_STAGES = {
  cord: { selector: '.tie__cord--wrap1', property: 'stroke-dashoffset' },
  flap: { selector: '.envelope__flap', property: 'transform' },
  letter: { selector: '.envelope__letter', property: 'transform' },
};

export async function observeOpeningTransitions(page) {
  await page.evaluate((stageMap) => {
    window.__openingTransitions = [];
    window.__untiedSnapshot = null;
    const activePhases = {};
    const root = document.documentElement;
    const stages = Object.fromEntries(
      Object.entries(stageMap).map(([name, { selector }]) => [name, document.querySelector(selector)]),
    );

    // Snapshot the moment the flap is released: nothing may still be wound, and
    // the card must not yet be poking out of the bottom of the envelope.
    const phaseObserver = new MutationObserver(() => {
      if (root.dataset.openingPhase !== 'flap' || window.__untiedSnapshot) {
        return;
      }

      const shell = document.querySelector('.envelope-shell').getBoundingClientRect();
      window.__untiedSnapshot = {
        stillWound: [...document.querySelectorAll('.tie__cord--wrap')].filter((cord) => (
          Number.parseFloat(getComputedStyle(cord).strokeDashoffset) > -99
        )).length,
        tailOffset: Number.parseFloat(
          getComputedStyle(document.querySelector('.tie__cord--tail')).strokeDashoffset,
        ),
        flapAngle: new DOMMatrix(getComputedStyle(stages.flap).transform).m22,
        exposedBelowEnvelope: [.2, .5, .8].filter((xRatio) => {
          const topElement = document.elementFromPoint(
            shell.left + shell.width * xRatio,
            shell.bottom + 2,
          );
          return topElement?.closest('.envelope__letter') === stages.letter;
        }).length,
      };
      phaseObserver.disconnect();
    });
    phaseObserver.observe(root, { attributes: true, attributeFilter: ['data-opening-phase'] });

    for (const [stage, element] of Object.entries(stages)) {
      for (const type of ['transitionstart', 'transitionend']) {
        element.addEventListener(type, (event) => {
          if (event.propertyName !== stageMap[stage].property) {
            return;
          }

          if (type === 'transitionstart') {
            activePhases[stage] = root.dataset.openingPhase;
          }
          window.__openingTransitions.push({
            stage,
            type,
            phase: activePhases[stage],
            at: performance.now(),
            elapsedTime: event.elapsedTime,
          });
        });
      }
    }
  }, OPENING_STAGES);
}

export async function waitForOpeningTransition(page, stage, type, phase) {
  await page.waitForFunction(
    ([expectedStage, expectedType, expectedPhase]) => window.__openingTransitions?.some(
      (event) => event.stage === expectedStage
        && event.type === expectedType
        && (!expectedPhase || event.phase === expectedPhase),
    ),
    [stage, type, phase],
    { timeout: 8000 },
  );
}

// The pocket front must keep the card covered below the envelope mouth.
export async function inspectPocketCoverage(letter) {
  return letter.evaluate((element) => {
    const shell = element.closest('.envelope-shell').getBoundingClientRect();
    const coveredPoints = [.7, .8, .9].flatMap((yRatio) => (
      [.2, .5, .8].map((xRatio) => [xRatio, yRatio])
    ));

    return {
      exposedSamples: coveredPoints.filter(([xRatio, yRatio]) => {
        const topElement = document.elementFromPoint(
          shell.left + shell.width * xRatio,
          shell.top + shell.height * yRatio,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
      exposedBelowEnvelope: [.2, .5, .8].filter((xRatio) => {
        const topElement = document.elementFromPoint(
          shell.left + shell.width * xRatio,
          shell.bottom + 2,
        );
        return topElement?.closest('.envelope__letter') === element;
      }).length,
    };
  });
}
