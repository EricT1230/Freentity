# Invitation Artwork and LINE Preview Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invitation reader artwork with the approved 2026-08-28 PDF export and make LINE fetch a fresh social preview without changing the envelope, animation, page slicing, layout, or brand colors.

**Architecture:** Keep the current one-image/four-crop reader and replace only its 1174 x 4096 source JPEG. Preserve the existing supplied social artwork, publish the same bytes at a versioned filename, and point OGP/Twitter metadata at that fresh path; the final handoff supplies a query-versioned page URL because LINE cached the root URL before OGP was deployed.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js build script, Playwright tests, Poppler `pdftoppm`, GitHub Pages.

**Spec:** `C:\Users\user\Downloads\iPhone 17 - 2.pdf` plus the user-approved bounded design in the current Codex thread.

## Global Constraints

- Preserve the existing envelope, opening sequence, four page crop boundaries, responsive layout, and all interaction code.
- Preserve the official full-color Freentity logo and the supplied social preview artwork without pixel changes.
- Use only static files compatible with GitHub Pages; add no server, API, database, custom domain, or paid service.
- Keep the invitation raster at exactly 1174 x 4096 pixels so existing desktop and mobile crop geometry remains unchanged.
- Deploy only after Chromium, WebKit, static build, asset hash, and live HTTP checks pass.

---

### Task 1: Lock the refreshed assets and metadata in tests

**Files:**
- Modify: `tests/utilities.spec.js`
- Modify: `tests/deployment.spec.js`

**Interfaces:**
- Consumes: `assets/figma-invitation.jpeg`, `assets/social-preview.jpg`, `index.html`, and `scripts/build-site.mjs`.
- Produces: Exact SHA-256 expectations and the public `assets/social-preview-20260828.jpg` metadata contract.

- [x] **Step 1: Write the failing invitation asset test**

Change `expectedFigmaAssetSha256` to:

~~~js
const expectedFigmaAssetSha256 = '61301fe1fff7623c45ac11e3c482663783337af6d284bb829f4627cd5e0f7f76';
~~~

- [x] **Step 2: Write the failing versioned preview tests**

Add `assets/social-preview-20260828.jpg` to the expected build file list and runtime URL list. Change the expected `og:image`, `og:image:secure_url`, and `twitter:image` URL to:

~~~js
const previewUrl = siteUrl + 'assets/social-preview-20260828.jpg';
~~~

Add a request assertion proving the versioned preview returns `image/jpeg`, and add a hash test proving it is byte-identical to the supplied social preview:

~~~js
const versionedAsset = await readFile('assets/social-preview-20260828.jpg');
expect(createHash('sha256').update(versionedAsset).digest('hex')).toBe(expectedSocialPreviewSha256);
~~~

- [x] **Step 3: Run the focused tests and verify RED**

Run: `npx playwright test tests/utilities.spec.js tests/deployment.spec.js`

Expected: FAIL because the invitation hash is still the previous export, the versioned social preview file is absent, and metadata still references `social-preview.jpg`.

### Task 2: Replace only the approved static assets and metadata

**Files:**
- Replace: `assets/figma-invitation.jpeg`
- Create: `assets/social-preview-20260828.jpg`
- Modify: `index.html`
- Modify: `scripts/build-site.mjs`

**Interfaces:**
- Consumes: the new 402 x 1404 PDF and the existing approved social artwork.
- Produces: a 1174 x 4096 JPEG and a fresh OGP image URL while retaining the old preview file for cached clients.

- [x] **Step 1: Render the approved PDF at the locked dimensions**

Run:

~~~powershell
pdftoppm -f 1 -singlefile -jpeg -jpegopt quality=95 -scale-to-x 1174 -scale-to-y 4096 "C:\Users\user\Downloads\iPhone 17 - 2.pdf" assets\figma-invitation
~~~

Expected: `assets/figma-invitation.jpg` with SHA-256 `61301fe1fff7623c45ac11e3c482663783337af6d284bb829f4627cd5e0f7f76`; move it over `assets/figma-invitation.jpeg` without touching CSS crop values.

- [x] **Step 2: Create the cache-busting social preview asset**

Copy `assets/social-preview.jpg` byte-for-byte to `assets/social-preview-20260828.jpg`. Keep the original file so previously cached metadata does not reference a deleted resource.

- [x] **Step 3: Point metadata and the build at the versioned asset**

Update `og:image`, `og:image:secure_url`, and `twitter:image` in `index.html` to the absolute versioned URL. Add the new asset to `runtimeFiles` in `scripts/build-site.mjs`.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run: `npx playwright test tests/utilities.spec.js tests/deployment.spec.js`

Expected: PASS.

### Task 3: Verify rendering, responsive behavior, and deployment output

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `script.js`
- Generated: `test-results/**`
- Generated: `_site/**`

**Interfaces:**
- Consumes: the integrated static site.
- Produces: test and visual evidence that the approved artwork changed while the reader and envelope did not.

- [x] **Step 1: Run Chromium coverage**

Run: `npm test`

Expected: all Chromium tests PASS.

- [x] **Step 2: Run WebKit coverage**

Run: `npm run test:webkit`

Expected: all WebKit tests PASS.

- [x] **Step 3: Build the GitHub Pages artifact**

Run: `npm run build`

Expected: exit 0 and `_site/assets/social-preview-20260828.jpg` exists.

- [x] **Step 4: Visually inspect the rendered invitation**

Open the site at desktop and iPhone widths, complete the envelope animation, and verify all four artwork sections remain full-width, uncropped outside the approved boundaries, and readable.

### Task 4: Review, publish, and verify the public cache-busted URL

**Files:**
- Review: all changed paths
- Publish: `main`

**Interfaces:**
- Consumes: reviewed passing diff.
- Produces: a successful GitHub Pages deployment and a LINE-ready URL.

- [x] **Step 1: Run independent code review**

Review the diff for scope adherence, static-host compatibility, test completeness, and accidental changes to animation or responsive CSS. Resolve every blocking finding and rerun affected tests.

- [x] **Step 2: Commit the exact approved scope**

Stage only the plan, tests, refreshed invitation JPEG, versioned preview JPEG, `index.html`, and `scripts/build-site.mjs`. Commit with:

~~~text
fix(invitation): refresh artwork and LINE preview
~~~

- [x] **Step 3: Push and wait for GitHub Pages**

Push `main`, wait for the matching GitHub Actions Pages run to succeed, and verify the deployed revision is the committed SHA.

- [x] **Step 4: Verify live crawler inputs**

Confirm the versioned page URL returns the three LINE-supported OGP tags and the versioned image returns HTTP 200, `image/jpeg`, the expected byte length, and the expected SHA-256:

~~~text
https://erict1230.github.io/Freentity/?v=20260828
https://erict1230.github.io/Freentity/assets/social-preview-20260828.jpg
~~~

Expected: both checks PASS. Advise the user to share the query-versioned page URL so LINE generates a new cache entry.
