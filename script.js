const root = document.documentElement;
const gate = document.querySelector('#invitation-gate');
const openButton = document.querySelector('#open-invitation');
const invitation = document.querySelector('#invitation');
const designPages = [...document.querySelectorAll('.design-page')];
const envelopeStage = document.querySelector('.gate__stage');
const envelopeLift = document.querySelector('.envelope-lift');
const envelopeShell = document.querySelector('.envelope-shell');
// The innermost wrap is the last to come undone, so it gates the next phase.
const envelopeCord = document.querySelector('.tie__cord--wrap1');
const envelopeFlap = document.querySelector('.envelope__flap');
const envelopeLetter = document.querySelector('.envelope__letter');
const themeColor = document.querySelector('meta[name="theme-color"]');
const progress = document.querySelector('.reader-progress');
const rail = document.querySelector('.reader-rail');
const bar = document.querySelector('.reader-bar');
const sectionLabel = document.querySelector('[data-section-label]');
const navButtons = [...document.querySelectorAll('.rail__nav button')];
const shareButton = document.querySelector('#share-invitation');
const toast = document.querySelector('#reader-toast');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

const UNWIND_HOLD_DURATION = 180;
const FLAP_HOLD_DURATION = 140;
const OPENING_FALLBACK_DURATION = 10000;
const REDUCED_UNWIND_HOLD_DURATION = 180;
const REDUCED_FLAP_HOLD_DURATION = 180;
const REDUCED_OPENING_FALLBACK_DURATION = 4000;
const RAIL_REVEAL_DELAY = 900;
const BAR_REVEAL_SCROLL = 40;
const TOAST_DURATION = 2600;
const MAX_TILT_X = 7;
const MAX_TILT_Y = 10;
const THEME_OPEN = '#f2f4f2';

const sectionRatios = new Map();
// Single source of truth for section names: the rail's own navigation labels.
const sectionNames = new Map(
  navButtons.map((button) => [button.dataset.goto, button.querySelector('span').textContent.trim()]),
);

let revealObserver;
let sectionObserver;
let openingFallbackTimer;
let phaseTimer;
let railTimer;
let toastTimer;
let progressTicking = false;

function setThemeColor(value) {
  themeColor?.setAttribute('content', value);
}

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

/* ------------------------------------------------------------- envelope tilt */

function setTilt(tiltX, tiltY) {
  envelopeLift?.style.setProperty('--tilt-x', `${tiltX}deg`);
  envelopeLift?.style.setProperty('--tilt-y', `${tiltY}deg`);
}

function trackPointerTilt(event) {
  if (root.dataset.state !== 'sealed' || reducedMotion.matches || !finePointer.matches) {
    return;
  }

  const bounds = envelopeShell.getBoundingClientRect();
  const offsetX = (event.clientX - (bounds.left + bounds.width / 2)) / bounds.width;
  const offsetY = (event.clientY - (bounds.top + bounds.height / 2)) / bounds.height;
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  setTilt(-clamp(offsetY) * MAX_TILT_X, clamp(offsetX) * MAX_TILT_Y);
}

function releasePointerTilt() {
  setTilt(0, 0);
}

/* ----------------------------------------------------------------- reader UI */

function updateProgress() {
  progressTicking = false;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

  progress?.style.setProperty('--reading-progress', String(ratio));
  progress?.classList.toggle('is-active', window.scrollY > 8);
  // The header stays out of the way over the cover, then rides along.
  bar?.classList.toggle('is-visible', window.scrollY > BAR_REVEAL_SCROLL);
}

function requestProgressUpdate() {
  if (progressTicking) {
    return;
  }

  progressTicking = true;
  window.requestAnimationFrame(updateProgress);
}

function showToast(message) {
  if (!toast) {
    return;
  }

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), TOAST_DURATION);
}

async function shareInvitation() {
  const payload = {
    title: '帆益科技｜新廠落成開幕暨技術發表',
    text: '誠摯邀請您參與帆益科技新廠落成開幕暨技術發表。',
    url: window.location.href,
  };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    showToast('已複製邀請函連結');
  } catch {
    showToast('請手動複製網址列的連結');
  }
}

function markCurrentSection(pageNumber) {
  navButtons.forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.goto === pageNumber));
  });

  const name = sectionNames.get(pageNumber);
  if (sectionLabel && name) {
    sectionLabel.textContent = name;
  }
}

function scrollToPage(pageNumber) {
  const target = designPages.find((designPage) => designPage.dataset.page === pageNumber);

  if (!target) {
    return;
  }

  markCurrentSection(pageNumber);
  target.scrollIntoView({
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function markLeadingSection() {
  let leadingPage;
  let leadingRatio = 0;

  // sectionRatios keeps document order, so ties resolve to the higher page.
  for (const [pageNumber, ratio] of sectionRatios) {
    if (ratio > leadingRatio) {
      leadingRatio = ratio;
      leadingPage = pageNumber;
    }
  }

  if (leadingPage) {
    markCurrentSection(leadingPage);
  }
}

function activateSectionTracking() {
  if (!navButtons.length || !('IntersectionObserver' in window)) {
    return;
  }

  designPages.forEach((designPage) => sectionRatios.set(designPage.dataset.page, 0));

  sectionObserver ??= new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        sectionRatios.set(entry.target.dataset.page, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      markLeadingSection();
    },
    // Pages are aligned to the top of the viewport when jumped to, so the current
    // section is the one filling the top band rather than the vertical middle.
    { rootMargin: '0px 0px -74% 0px', threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
  );

  designPages.forEach((designPage) => sectionObserver.observe(designPage));
  markCurrentSection('1');
}

function activateReaderChrome() {
  updateProgress();
  activateSectionTracking();
  window.addEventListener('scroll', requestProgressUpdate, { passive: true });
  window.addEventListener('resize', requestProgressUpdate);

  railTimer = window.setTimeout(
    () => rail?.classList.add('is-visible'),
    reducedMotion.matches ? 0 : RAIL_REVEAL_DELAY,
  );
}

/* -------------------------------------------------------------- opening flow */

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
  setThemeColor(THEME_OPEN);
  gate.setAttribute('aria-hidden', 'true');
  gate.removeAttribute('aria-busy');
  invitation.setAttribute('aria-hidden', 'false');
  invitation.removeAttribute('inert');
  activatePageReveals();
  activateReaderChrome();

  window.requestAnimationFrame(() => {
    resetScrollPosition();
    invitation.focus({ preventScroll: true });
  });
}

function advanceUnwinding(event) {
  // The cord finishes coming undone before the freed flap is allowed to move.
  if (event.propertyName !== 'stroke-dashoffset' || root.dataset.state !== 'opening') {
    return;
  }

  if (root.dataset.openingPhase === 'unwind') {
    scheduleOpeningPhase(
      'flap',
      reducedMotion.matches ? REDUCED_UNWIND_HOLD_DURATION : UNWIND_HOLD_DURATION,
    );
  }
}

function advanceOpening(event) {
  if (event.propertyName !== 'transform' || root.dataset.state !== 'opening') {
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
  releasePointerTilt();
  root.dataset.openingPhase = 'unwind';
  root.dataset.state = 'opening';
  gate.setAttribute('aria-busy', 'true');
  openButton.disabled = true;

  openingFallbackTimer = window.setTimeout(
    finishOpening,
    reducedMotion.matches ? REDUCED_OPENING_FALLBACK_DURATION : OPENING_FALLBACK_DURATION,
  );
}

/* ----------------------------------------------------------------- listeners */

openButton.addEventListener('click', openInvitation);
envelopeCord.addEventListener('transitionend', advanceUnwinding);
envelopeFlap.addEventListener('transitionend', advanceOpening);
envelopeLetter.addEventListener('transitionend', advanceOpening);
gate.addEventListener('animationend', (event) => {
  if (event.animationName === 'gate-departure' && root.dataset.openingPhase === 'departing') {
    finishOpening();
  }
});

envelopeStage.addEventListener('pointermove', trackPointerTilt);
envelopeStage.addEventListener('pointerleave', releasePointerTilt);
openButton.addEventListener('blur', releasePointerTilt);

shareButton?.addEventListener('click', shareInvitation);
navButtons.forEach((button) => {
  button.addEventListener('click', () => scrollToPage(button.dataset.goto));
});

if (root.dataset.state === 'open') {
  setThemeColor(THEME_OPEN);
  gate.setAttribute('aria-hidden', 'true');
  invitation.setAttribute('aria-hidden', 'false');
  invitation.removeAttribute('inert');
  revealAllPages();
  activateReaderChrome();
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

  releasePointerTilt();
  revealObserver?.disconnect();
  revealObserver = undefined;
  revealAllPages();
});

window.addEventListener('pagehide', () => {
  window.clearTimeout(railTimer);
  window.clearTimeout(toastTimer);
});
