const root = document.documentElement;
const gate = document.querySelector('#invitation-gate');
const openButton = document.querySelector('#open-invitation');
const invitation = document.querySelector('#invitation');
const designPages = [...document.querySelectorAll('.design-page')];
const envelopeShell = document.querySelector('.envelope-shell');
const envelopeFlap = document.querySelector('.envelope__flap');
const envelopeLetter = document.querySelector('.envelope__letter');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const BACK_HOLD_DURATION = 140;
const FLAP_HOLD_DURATION = 140;
const OPENING_FALLBACK_DURATION = 10000;
const REDUCED_BACK_HOLD_DURATION = 180;
const REDUCED_FLAP_HOLD_DURATION = 180;
const REDUCED_OPENING_FALLBACK_DURATION = 4000;

let revealObserver;
let openingFallbackTimer;
let phaseTimer;

function resetScrollPosition() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function revealAllPages() {
  designPages.forEach((designPage) => designPage.classList.add('is-visible'));
}

function activatePageReveals() {
  designPages[0]?.classList.add('is-visible');

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealAllPages();
    return;
  }

  revealObserver ??= new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12,
    },
  );

  designPages.slice(1).forEach((designPage) => revealObserver.observe(designPage));
}

function clearOpeningTimers() {
  window.clearTimeout(openingFallbackTimer);
  window.clearTimeout(phaseTimer);
  openingFallbackTimer = undefined;
  phaseTimer = undefined;
}

function scheduleOpeningPhase(phase, delay) {
  window.clearTimeout(phaseTimer);
  phaseTimer = window.setTimeout(() => {
    phaseTimer = undefined;
    if (root.dataset.state === 'opening') {
      root.dataset.openingPhase = phase;
    }
  }, delay);
}

function finishOpening() {
  if (root.dataset.state === 'open') {
    return;
  }

  clearOpeningTimers();
  resetScrollPosition();
  root.dataset.state = 'open';
  delete root.dataset.openingPhase;
  gate.setAttribute('aria-hidden', 'true');
  gate.removeAttribute('aria-busy');
  invitation.setAttribute('aria-hidden', 'false');
  invitation.removeAttribute('inert');
  activatePageReveals();

  window.requestAnimationFrame(() => {
    resetScrollPosition();
    invitation.focus({ preventScroll: true });
  });
}

function advanceOpening(event) {
  if (event.propertyName !== 'transform' || root.dataset.state !== 'opening') {
    return;
  }

  if (event.currentTarget === envelopeShell && root.dataset.openingPhase === 'flip') {
    root.dataset.openingPhase = 'back';
    scheduleOpeningPhase(
      'flap',
      reducedMotion.matches ? REDUCED_BACK_HOLD_DURATION : BACK_HOLD_DURATION,
    );
    return;
  }

  if (event.currentTarget === envelopeFlap && root.dataset.openingPhase === 'flap') {
    root.dataset.openingPhase = 'flap-open';
    scheduleOpeningPhase(
      'card',
      reducedMotion.matches ? REDUCED_FLAP_HOLD_DURATION : FLAP_HOLD_DURATION,
    );
    return;
  }

  if (event.currentTarget === envelopeLetter && root.dataset.openingPhase === 'card') {
    root.dataset.openingPhase = 'departing';
  }
}

export function openInvitation() {
  if (root.dataset.state !== 'sealed') {
    return;
  }

  resetScrollPosition();
  root.dataset.openingPhase = 'flip';
  root.dataset.state = 'opening';
  gate.setAttribute('aria-busy', 'true');
  openButton.disabled = true;

  openingFallbackTimer = window.setTimeout(
    finishOpening,
    reducedMotion.matches ? REDUCED_OPENING_FALLBACK_DURATION : OPENING_FALLBACK_DURATION,
  );
}

openButton.addEventListener('click', openInvitation);
envelopeShell.addEventListener('transitionend', advanceOpening);
envelopeFlap.addEventListener('transitionend', advanceOpening);
envelopeLetter.addEventListener('transitionend', advanceOpening);
gate.addEventListener('animationend', (event) => {
  if (event.animationName === 'gate-departure' && root.dataset.openingPhase === 'departing') {
    finishOpening();
  }
});

if (root.dataset.state === 'open') {
  gate.setAttribute('aria-hidden', 'true');
  invitation.setAttribute('aria-hidden', 'false');
  invitation.removeAttribute('inert');
  revealAllPages();
} else {
  invitation.setAttribute('aria-hidden', 'true');
  invitation.setAttribute('inert', '');
  gate.setAttribute('aria-hidden', 'false');
}

root.dataset.invitationReady = 'true';
window.clearTimeout(window.__invitationFailOpenTimer);
delete window.__invitationFailOpenTimer;

reducedMotion.addEventListener('change', () => {
  if (!reducedMotion.matches) {
    return;
  }

  revealObserver?.disconnect();
  revealObserver = undefined;
  revealAllPages();
});
