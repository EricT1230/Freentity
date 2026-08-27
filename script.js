const root = document.documentElement;
const gate = document.querySelector('#invitation-gate');
const openButton = document.querySelector('#open-invitation');
const invitation = document.querySelector('#invitation');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const shareButton = document.querySelector('[data-action="share"]');
const shareStatus = document.querySelector('#share-status');
const manualShare = document.querySelector('#manual-share');
const shareUrl = document.querySelector('#share-url');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const OPENING_DURATION = 1550;
const REDUCED_OPENING_DURATION = 40;

let revealObserver;
let openingTimer;

function resetScrollPosition() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function revealAllChapters() {
  chapters.forEach((chapter) => chapter.classList.add('is-visible'));
}

function activateChapterReveals() {
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealAllChapters();
    return;
  }

  chapters[0]?.classList.add('is-visible');

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
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.14,
    },
  );

  chapters.slice(1).forEach((chapter) => revealObserver.observe(chapter));
}

function finishOpening() {
  openingTimer = undefined;
  resetScrollPosition();
  root.dataset.state = 'open';
  gate.setAttribute('aria-hidden', 'true');
  gate.removeAttribute('aria-busy');
  invitation.setAttribute('aria-hidden', 'false');
  invitation.removeAttribute('inert');
  activateChapterReveals();

  window.requestAnimationFrame(() => {
    resetScrollPosition();
    invitation.focus({ preventScroll: true });
  });
}

export function openInvitation() {
  if (root.dataset.state !== 'sealed') {
    return;
  }

  resetScrollPosition();
  root.dataset.state = 'opening';
  gate.setAttribute('aria-busy', 'true');
  openButton.disabled = true;

  openingTimer = window.setTimeout(
    finishOpening,
    reducedMotion.matches ? REDUCED_OPENING_DURATION : OPENING_DURATION,
  );
}

function getInvitationUrl() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.href;
}

function revealManualShare() {
  manualShare.hidden = false;
  shareUrl.value = getInvitationUrl();
  shareUrl.focus();
  shareUrl.select();
  shareStatus.textContent = '請複製下方網址分享邀請函。';
}

export async function shareInvitation() {
  const shareData = {
    title: document.title,
    text: '誠摯邀請您參加帆益科技新廠落成開幕暨技術發表。',
    url: getInvitationUrl(),
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

invitation.setAttribute('aria-hidden', 'true');
invitation.setAttribute('inert', '');
gate.setAttribute('aria-hidden', 'false');
openButton.addEventListener('click', openInvitation);
shareButton.addEventListener('click', shareInvitation);

reducedMotion.addEventListener('change', () => {
  if (!reducedMotion.matches) {
    return;
  }

  revealObserver?.disconnect();
  revealObserver = undefined;
  revealAllChapters();

  if (root.dataset.state === 'opening' && openingTimer) {
    window.clearTimeout(openingTimer);
    finishOpening();
  }
});
