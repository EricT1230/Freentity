# Freentity Interactive Invitation Design

Date: 2026-08-27
Status: Approved for implementation planning
Delivery target: GitHub Pages for `EricT1230/Freentity`

## 1. Purpose

Build a mobile-first static invitation website for Freentity's new factory opening and technology presentation. The site must preserve the supplied PDF and Figma invitation's layout, wording, colors, and decorative treatment while adding the feeling of receiving, opening, and reading a physical invitation.

The experience begins with a closed envelope. The visitor explicitly opens it, watches the invitation emerge, then reads the original invitation and may use three static utilities: map navigation, calendar download, and link sharing.

## 2. Sources of truth

Visual and content fidelity is governed by these sources, in order:

1. The supplied one-page PDF, sized 402 by 1404 points.
2. Figma file `xBwZmsB1yb6n4bB6s2GP46`, frame `1:2` (`iPhone 17 - 2`).
3. The approved interaction decisions in this document.

The Figma frame is a flattened invitation image rather than editable text and decoration layers. The implementation will therefore store an exact local export of the invitation and treat it as the visible paper artwork. It must not depend on Figma's expiring asset URL at runtime.

## 3. Scope

### Included

- Closed-envelope landing state.
- Explicit click, tap, Enter, or Space action to open the invitation.
- Envelope-flap and paper-extraction animation.
- Faithful presentation of the supplied invitation artwork.
- Subtle paper elevation, shadow, and edge-decoration movement while reading.
- Google Maps navigation link for the venue.
- Static `.ics` calendar download for 2026-10-04, 14:00-16:30, Asia/Taipei.
- Native browser sharing with a copy-link fallback.
- Mobile-first responsive behavior from 320 CSS pixels upward.
- Keyboard access, reduced-motion support, and a semantic text equivalent.
- GitHub Pages deployment configuration using repository-relative paths.

### Excluded

- A purchased or custom domain.
- Backend code, serverless functions, databases, or APIs owned by the site.
- RSVP forms, attendance storage, authentication, or recipient management.
- Recipient personalization or URL parameters. The envelope uses the generic wording `誠摯邀請您`.
- Analytics, tracking pixels, cookies, or visitor persistence.
- Embedded maps, background music, or autoplay audio.
- CMS, admin screens, or editing tools.

## 4. Visitor experience

### 4.1 Sealed state

- The first viewport uses a restrained warm-white paper texture derived from the invitation palette.
- A dark green envelope is centered in the safe viewport.
- The envelope front shows the Freentity identity, the event title, and `誠摯邀請您`.
- A clearly labeled `開啟邀請` control is visible and keyboard focusable.
- Every page load begins in this sealed state. No cookie, local storage, or session storage records prior visits.

### 4.2 Opening state

One user activation starts a single bounded sequence:

1. The envelope gains slight depth.
2. The flap rotates open.
3. The invitation paper rises from the envelope.
4. The envelope lowers visually while the paper settles into the reading layout.
5. The document enters the open state and exposes the utility tray.

The complete sequence targets approximately 1.5 seconds. Repeated activation is ignored while the sequence is running. The controls remain deterministic and do not replay unless the page is reloaded.

### 4.3 Reading state

- The complete invitation is shown without cropping, distortion, text replacement, or recoloring.
- The paper is centered with a quiet shadow and restrained elevation change during scroll.
- Decorative motion is limited to low-amplitude edge parallax and must never move the printed invitation content independently.
- The utility tray remains outside the paper artwork and must not obscure it.

### 4.4 Static utilities

- `地圖導航` opens a new Google Maps query for `320 桃園市中壢區中園路 192 號 5 樓之 1、2`.
- `加入行事曆` downloads a repository-local `.ics` file. The event begins at 14:00 and ends at 16:30 on 2026-10-04 in Asia/Taipei.
- `分享邀請` uses `navigator.share` when available. Otherwise it copies the current canonical GitHub Pages URL. If clipboard access is unavailable, it presents a selectable URL with clear manual-copy instructions.

## 5. Visual direction

- Preserve the source palette: warm white, silver-gray, dark Freentity green, muted green, and the existing small yellow brand accent.
- Preserve the source's corporate, refined tone. Motion should feel ceremonial but not wedding-like or playful.
- The invitation artwork is the only source for its printed typography and liquid-metal decorations; the website does not redraw or reinterpret them.
- Interface text outside the artwork uses a local system CJK sans-serif stack to avoid web-font loading or licensing dependencies.
- Shadows, gradients, and textures remain subtle enough that the invitation artwork is always the visual focus.

## 6. Responsive contract

Responsive behavior is a release-blocking requirement, with mobile as the primary target.

### 6.1 Global rules

- Use mobile-first CSS and fluid sizing rather than desktop coordinates scaled down afterward.
- Support viewport widths from 320 CSS pixels upward.
- Produce zero unintended horizontal scrolling at every tested width.
- Account for `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, and `env(safe-area-inset-left)`.
- Use `svh`/`dvh` with a compatible fallback so mobile browser chrome cannot clip the envelope or primary control.
- Reflow correctly after portrait/landscape orientation changes without requiring reload.

### 6.2 Envelope stage

- The stage has a minimum height equal to the safe visible viewport.
- The envelope width is fluid and capped; it must fit inside the viewport with at least 12 pixels of side clearance at 320 pixels.
- Its aspect ratio remains constant, and flap/paper geometry is expressed relative to the envelope rather than with viewport-specific pixel offsets.
- Opening animation transforms use percentages and element bounds so the paper cannot jump sideways between breakpoints.
- The open button has a minimum 44 by 44 CSS pixel hit area.

### 6.3 Invitation paper

- The artwork retains its exact 402:1404 aspect ratio.
- Its rendered width is `min(100%, 402px)` inside a container with fluid gutters.
- It is never cropped, stretched, or rendered with `object-fit: cover`.
- At widths below 402 pixels, it scales down uniformly.
- At tablet and desktop widths, it remains centered at its source design width rather than expanding into a blurry poster.
- The image uses intrinsic dimensions to reserve layout space before loading and avoid content shift.

### 6.4 Utility tray

- Three actions remain usable at 320 pixels without text collision.
- The tray may become compact, but labels cannot be reduced below a readable size or replaced with ambiguous icon-only controls.
- If the tray uses sticky positioning, the document reserves equivalent bottom space so no invitation content is hidden beneath it.
- Bottom spacing includes the device safe-area inset.

### 6.5 Mobile acceptance matrix

The following widths must each receive a visual and interaction check:

| Width | Primary risk to verify |
| --- | --- |
| 320px | Side overflow, action-label collision, envelope clipping |
| 375px | Common iPhone viewport and safe-area spacing |
| 390px | Modern iPhone viewport and address-bar height changes |
| 402px | Exact Figma design width |
| 768px | Tablet centering and excessive empty space |
| 1440px | Desktop centering, scale restraint, and background balance |

## 7. Technical architecture

The implementation uses browser-native static files with no application framework and no runtime package dependency.

```text
index.html
styles.css
script.js
assets/
  invitation.webp
  invitation.png
  event.ics
.github/
  workflows/
    pages.yml
docs/
  superpowers/
    specs/
```

### 7.1 Responsibilities

- `index.html`: semantic document structure, envelope controls, invitation image, accessible transcript, utility links, and no-JavaScript fallback.
- `styles.css`: design tokens, layout, envelope construction, motion, responsive rules, focus styles, safe-area behavior, and reduced-motion overrides.
- `script.js`: the sealed/opening/open state machine, duplicate-activation guard, share capability detection, and copy fallback.
- `assets/invitation.webp`: optimized primary artwork.
- `assets/invitation.png`: lossless fallback and fidelity reference.
- `assets/event.ics`: static event calendar data.
- `.github/workflows/pages.yml`: deployment of the repository's static contents to GitHub Pages.

### 7.2 State model

The page has exactly three runtime states:

```text
sealed --activate--> opening --animation-complete--> open
```

- `sealed`: the open control is enabled and reading content is not yet the visual focus.
- `opening`: duplicate activation is ignored and animation semantics are marked busy.
- `open`: the invitation and utilities are available; no automatic transition returns to sealed.

Reduced-motion mode uses the same state transitions but replaces the physical sequence with a short opacity transition.

## 8. Accessibility and progressive fallback

- The open interaction is a real button, not a clickable `div`.
- The page uses semantic landmarks and a meaningful heading order.
- The invitation image has concise alternative text, while a visually hidden transcript supplies every printed event detail.
- Focus remains visible and moves to the invitation heading only after the opening transition completes.
- Status feedback for successful sharing or copying uses an `aria-live` region.
- Color contrast for all interface controls outside the artwork meets WCAG AA.
- `prefers-reduced-motion: reduce` disables flap rotation, parallax, and long travel.
- With JavaScript disabled, the invitation and static map/calendar links render directly through a no-script-safe presentation.
- The primary artwork uses `<picture>` with WebP and PNG fallback.

## 9. Failure handling

- If WebP cannot load, the browser uses the local PNG fallback.
- If the invitation image fails entirely, the semantic event transcript remains visible rather than leaving an empty page.
- If native sharing rejects or is unavailable, the flow falls back to copying without treating user cancellation as an error.
- If clipboard access is denied, the site reveals a selectable URL and manual-copy message.
- External map navigation opens separately so the invitation page remains available.
- No error path sends data to an external logging service.

## 10. Performance constraints

- Keep the first screen self-contained and avoid third-party JavaScript.
- Store all visual assets locally in the repository.
- Preload only the invitation's primary image; do not preload unused formats.
- Use transform and opacity for animation to avoid layout thrashing.
- Reserve intrinsic image dimensions to minimize cumulative layout shift.
- Avoid continuous animation after the page settles. Scroll effects must be frame-budgeted and disabled in reduced-motion mode.

## 11. GitHub Pages delivery

- All internal URLs and asset references are repository-relative.
- The site must work under the `/Freentity/` project path and must not assume origin-root deployment.
- The workflow publishes only static repository content.
- No custom-domain file or DNS configuration is included.
- Deployment configuration must not require repository secrets for ordinary GitHub Pages publication.

## 12. Verification plan

### 12.1 Automated checks

- Validate JavaScript syntax and page loading from a local static server.
- Exercise sealed, opening, and open states.
- Verify duplicate activation does not restart or corrupt the animation.
- Verify keyboard opening and focus placement.
- Verify reduced-motion behavior.
- Verify native-share capability branching and copy/manual-copy fallbacks.
- Parse `event.ics` and confirm title, venue, date, start time, end time, and Asia/Taipei semantics.
- Request every internal asset through a `/Freentity/`-style base path and require no 404 response.
- Assert no horizontal overflow at every width in the mobile acceptance matrix.

### 12.2 Visual checks

- Capture sealed and open states at 320, 375, 390, 402, 768, and 1440 pixels.
- Compare the visible invitation against the source PDF for aspect ratio, cropping, content, colors, and sharpness.
- Inspect the complete mobile opening sequence for flap detachment, sideways paper drift, clipped controls, layout jumps, and toolbar overlap.
- Inspect portrait-to-landscape and landscape-to-portrait reflow.
- Inspect with increased text size to ensure interface labels remain usable.

### 12.3 Manual checks

- Open the map target and confirm the displayed address.
- Import the `.ics` file into a calendar and confirm local event time.
- Test sharing on a supported mobile browser and the fallback on a desktop browser.
- Test touch behavior on a narrow mobile viewport.

## 13. Definition of done

The site is complete only when:

1. The approved closed-envelope flow works with pointer and keyboard input.
2. The invitation matches the supplied visual source without cropping or content changes.
3. Map, calendar, and share utilities work without a backend.
4. No excluded feature or external tracking is present.
5. Every responsive viewport passes without unintended horizontal overflow or obscured content.
6. Reduced-motion and no-JavaScript fallbacks remain usable.
7. All automated and visual checks pass against the final integrated files.
8. The repository is ready for GitHub Pages under `/Freentity/` with no custom domain.
