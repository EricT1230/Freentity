const root = document.documentElement;
const openButton = document.querySelector('#open-invitation');
const invitation = document.querySelector('#invitation');
const shareButton = document.querySelector('[data-action="share"]');
const shareStatus = document.querySelector('#share-status');
const manualShare = document.querySelector('#manual-share');
const shareUrl = document.querySelector('#share-url');
const invitationArtwork = document.querySelector('.invitation__artwork');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const OPENING_DURATION = 1500;
const REDUCED_OPENING_DURATION = 80;

function setState(state) {
  root.dataset.state = state;
}

function finishOpening() {
  setState('open');
  root.removeAttribute('aria-busy');
  invitation.focus({ preventScroll: true });
}

export function openInvitation() {
  if (root.dataset.state !== 'sealed') {
    return;
  }

  setState('opening');
  root.setAttribute('aria-busy', 'true');
  openButton.disabled = true;

  invitation.scrollIntoView({
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
    block: 'start',
  });

  window.setTimeout(
    finishOpening,
    reducedMotion.matches ? REDUCED_OPENING_DURATION : OPENING_DURATION,
  );
}

openButton.addEventListener('click', openInvitation);

function revealManualShare() {
  manualShare.hidden = false;
  shareUrl.value = window.location.href;
  shareUrl.focus();
  shareUrl.select();
  shareStatus.textContent = '請複製下方網址分享邀請函。';
}

export async function shareInvitation() {
  const shareData = {
    title: document.title,
    text: '誠摯邀請您參加帆益科技新廠落成開幕暨技術發表。',
    url: window.location.href,
  };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      shareStatus.textContent = '分享視窗已開啟。';
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareData.url);
      shareStatus.textContent = '邀請函網址已複製。';
      return;
    } catch {
      // Continue to the visible manual-copy fallback.
    }
  }

  revealManualShare();
}

shareButton.addEventListener('click', shareInvitation);

function showArtworkFallback() {
  invitation.classList.add('invitation--artwork-missing');
}

invitationArtwork.addEventListener('error', showArtworkFallback);

if (invitationArtwork.complete && invitationArtwork.naturalWidth === 0) {
  showArtworkFallback();
}

let parallaxFrame = 0;

function syncParallax() {
  parallaxFrame = 0;

  if (reducedMotion.matches) {
    invitation.style.setProperty('--scroll-shift', '0px');
    return;
  }

  const invitationTop = invitation.offsetTop;
  const shift = Math.max(-10, Math.min(10, (window.scrollY - invitationTop) * 0.015));
  invitation.style.setProperty('--scroll-shift', `${shift}px`);
}

function requestParallaxSync() {
  if (parallaxFrame) {
    return;
  }

  parallaxFrame = window.requestAnimationFrame(syncParallax);
}

window.addEventListener('scroll', requestParallaxSync, { passive: true });
reducedMotion.addEventListener('change', syncParallax);
syncParallax();
