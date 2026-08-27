# Freentity Interactive Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a faithful, mobile-first Freentity invitation that opens from a sealed envelope and runs entirely as a static GitHub Pages site.

**Architecture:** Browser-native HTML, CSS, and JavaScript render a three-state invitation experience (`sealed`, `opening`, `open`). The exact invitation artwork is generated from the supplied PDF and stored locally; Playwright verifies interaction, accessibility, static utilities, responsive behavior, and `/Freentity/` subpath delivery.

**Tech Stack:** HTML5, CSS, ES modules, Node.js 24 test tooling, Playwright, Poppler, FFmpeg, GitHub Pages Actions

**Spec:** `docs/superpowers/specs/2026-08-27-freentity-invitation-design.md`

## Global Constraints

- Runtime code is static only: no backend, database, serverless function, CMS, authentication, analytics, cookies, or tracking.
- Do not add a custom domain, `CNAME`, DNS configuration, RSVP form, recipient personalization, embedded map, or background audio.
- Every page load starts in the `sealed` state and uses the generic wording `誠摯邀請您`.
- Preserve the supplied invitation at the exact 402:1404 aspect ratio without crop, stretch, recolor, or rewritten visible content.
- Store invitation assets in the repository; never ship a Figma MCP asset URL.
- Use repository-relative runtime paths that work under `/Freentity/`.
- Support viewport widths from 320 CSS pixels upward with zero unintended horizontal scrolling.
- Validate 320, 375, 390, 402, 768, and 1440 CSS pixel widths.
- Support pointer, touch, Enter, Space, reduced motion, no JavaScript, and image-load failure fallbacks.
- The only utilities are Google Maps navigation, a local `.ics` download, and native sharing with copy/manual-copy fallbacks.
- Preserve existing user work. `tmp/` is inspection scratch and must remain excluded from commits.
- Every commit command below is an approval checkpoint. Do not stage, commit, push, enable Pages, or make another external write unless the user explicitly authorizes that exact action.

## Planned File Structure

```text
.github/
  workflows/
    pages.yml                 # Test, assemble, and publish the static Pages artifact
assets/
  event.ics                  # Static calendar event
  invitation.png             # Lossless artwork fallback at 3x source size
  invitation.webp            # Lossless primary artwork at 3x source size
docs/superpowers/
  plans/
    2026-08-27-freentity-invitation.md
  specs/
    2026-08-27-freentity-invitation-design.md
tests/
  deployment.spec.js         # Pages workflow and subpath publication checks
  invitation.spec.js         # Shell, state machine, keyboard, and fallbacks
  responsive.spec.js         # Width matrix, aspect ratio, and overlap checks
  static-server.mjs          # Local `/Freentity/` test host
  utilities.spec.js          # Map, calendar, share, and copy behavior
  visual.spec.js             # Deterministic visual evidence captures
scripts/
  build-site.mjs             # Assemble the minimal GitHub Pages artifact
.gitignore                   # Dependencies, reports, scratch, and assembled site
index.html                   # Semantic invitation document and no-script fallback
package-lock.json            # Reproducible test dependency lock
package.json                 # Test scripts and Playwright development dependency
playwright.config.js         # Chromium test configuration
README.md                    # Local preview and GitHub Pages operating notes
script.js                    # Invitation state machine and sharing controller
styles.css                   # Tokens, envelope, motion, responsive rules, accessibility
```

---

### Task 1: Establish the static shell, exact artwork, and browser test harness

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `playwright.config.js`
- Create: `tests/static-server.mjs`
- Create: `tests/invitation.spec.js`
- Create: `index.html`
- Create: `assets/invitation.png`
- Create: `assets/invitation.webp`

**Interfaces:**
- Consumes: supplied PDF at `C:\Users\user\.codex\codex-remote-attachments\01a042fc-8700-7da3-8ce2-7ff9bb405054\3EF988D8-9E68-4F87-9B32-04664FEB776A\1-iPhone-17-2.pdf`
- Produces: `http://127.0.0.1:4173/Freentity/`, `[data-state]`, `#open-invitation`, `#invitation`, `.invitation__artwork`, and local 1206 by 4212 artwork files

- [ ] **Step 1: Create the ignored-output policy and Playwright package manifest**

```gitignore
node_modules/
playwright-report/
test-results/
_site/
tmp/
```

```json
{
  "name": "freentity-invitation",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:responsive": "playwright test tests/responsive.spec.js",
    "test:visual": "playwright test tests/visual.spec.js"
  },
  "devDependencies": {}
}
```

Run:

```powershell
npm install --save-dev '@playwright/test@latest'
npx playwright install chromium
```

Expected: `package-lock.json` records the resolved Playwright version and Chromium installation exits with code 0.

- [ ] **Step 2: Create the `/Freentity/` static test server and Playwright configuration**

```js
// tests/static-server.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const basePath = '/Freentity/';
const port = Number(process.env.PORT ?? 4173);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ics', 'text/calendar; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const relativePath = decodeURIComponent(pathname.slice(basePath.length)) || 'index.html';
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let filePath = target;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(relativePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    filePath = resolve(root, 'index.html');
  }
  if (!existsSync(filePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Freentity test server: http://127.0.0.1:${port}${basePath}\n`);
});
```

```js
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/Freentity/',
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'zh-TW',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/static-server.mjs',
    port: 4173,
    reuseExistingServer: false,
  },
});
```

- [ ] **Step 3: Write the failing shell and artwork test**

```js
// tests/invitation.spec.js
import { expect, test } from '@playwright/test';

test('loads the sealed invitation shell and local artwork', async ({ page, request }) => {
  await page.goto('./');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'sealed');
  await expect(page.getByRole('button', { name: '開啟邀請' })).toBeVisible();
  await expect(page.locator('#invitation')).toBeAttached();

  const webp = await request.get('./assets/invitation.webp');
  const png = await request.get('./assets/invitation.png');
  expect(webp.ok()).toBe(true);
  expect(png.ok()).toBe(true);

  await expect(page.locator('.invitation__artwork')).toHaveJSProperty('complete', true);
  const dimensions = await page.locator('.invitation__artwork').evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  expect(dimensions).toEqual({ width: 1206, height: 4212 });
});
```

- [ ] **Step 4: Run the shell test and verify it fails**

Run:

```powershell
npx playwright test tests/invitation.spec.js
```

Expected: FAIL because `index.html` and repository-local invitation assets do not exist.

- [ ] **Step 5: Generate exact 3x invitation assets from the supplied PDF**

Run:

```powershell
$sourcePdf = 'C:\Users\user\.codex\codex-remote-attachments\01a042fc-8700-7da3-8ce2-7ff9bb405054\3EF988D8-9E68-4F87-9B32-04664FEB776A\1-iPhone-17-2.pdf'
New-Item -ItemType Directory -Force -Path 'assets' | Out-Null
pdftoppm -png -r 216 -singlefile $sourcePdf 'assets/invitation'
ffmpeg -y -i 'assets/invitation.png' -frames:v 1 -c:v libwebp -lossless 1 -compression_level 6 -preset picture 'assets/invitation.webp'
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 'assets/invitation.png'
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 'assets/invitation.webp'
```

Expected: both dimension probes print `1206x4212`.

- [ ] **Step 6: Create the semantic page shell**

```html
<!doctype html>
<html lang="zh-Hant" data-state="sealed">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#365f4d">
    <meta name="description" content="帆益科技新廠落成開幕暨技術發表邀請函">
    <title>帆益科技｜新廠落成開幕暨技術發表</title>
    <link rel="preload" href="./assets/invitation.webp" as="image" type="image/webp">
    <link rel="stylesheet" href="./styles.css">
    <noscript>
      <style>
        .envelope-stage { display: none !important; }
        .invitation { display: block !important; opacity: 1 !important; transform: none !important; }
      </style>
    </noscript>
  </head>
  <body>
    <main>
      <section class="envelope-stage" aria-labelledby="envelope-title">
        <div class="envelope-scene">
          <p class="envelope__brand" aria-hidden="true">FREENTITY</p>
          <h1 id="envelope-title">新廠落成開幕暨技術發表</h1>
          <p class="envelope__recipient">誠摯邀請您</p>
          <div class="envelope" aria-hidden="true">
            <div class="envelope__back"></div>
            <div class="envelope__paper-preview"></div>
            <div class="envelope__front"></div>
            <div class="envelope__flap"></div>
          </div>
          <button id="open-invitation" class="open-button" type="button">開啟邀請</button>
        </div>
      </section>

      <article id="invitation" class="invitation" aria-labelledby="invitation-title" tabindex="-1">
        <h2 id="invitation-title" class="sr-only">帆益科技新廠落成開幕暨技術發表邀請函</h2>
        <picture class="invitation__picture">
          <source srcset="./assets/invitation.webp" type="image/webp">
          <img class="invitation__artwork" src="./assets/invitation.png" width="1206" height="4212" alt="帆益科技新廠落成開幕暨技術發表完整邀請函">
        </picture>
        <section class="invitation__transcript sr-only" aria-label="邀請函文字內容">
          <h3>六年，我們創造了無限的可能</h3>
          <p>誠摯邀請你，與我們共同開啟嶄新篇章。</p>
          <p>時間：2026 年 10 月 4 日星期日，14:00 起自由入場。</p>
          <p>地點：320 桃園市中壢區中園路 192 號 5 樓之 1、2。</p>
          <h3>投入 15 年的研究，因為相信 3D 列印可以改變製造業</h3>
          <p>我一直深信厚植而萌發，實驗培育著我的底氣，也讓帆益的技術年年突破。2026 年，我們完成階段性的目標，站到了我們理想的高度。感謝一路相挺的夥伴、不吝支持的貴人前輩、相信我們的客戶。今天的帆益，因為有你。10 月 4 日，讓我們一起見證過去的累積，以及接下來走向哪裡。</p>
          <h3>現場首度公開</h3>
          <p>挑戰全台第一的高速度、高精度、高效率智慧製程。</p>
          <h3>當日流程</h3>
          <ol>
            <li>14:00 開放入場、迎賓；茶點備妥，歡迎隨到隨入。</li>
            <li>14:30 開幕儀式。</li>
            <li>15:00 新廠導覽、產線實機展示、技術發表；三場同步進行，不分梯次，皆可自由參與。</li>
            <li>16:00 交流時間。</li>
            <li>16:30 活動結束。</li>
          </ol>
          <h3>地點與交通</h3>
          <p>新廠地址：320 桃園市中壢區中園路 192 號 5 樓之 1、2。請直接開往地下室停車場，當天開放來賓臨停。本場為開放式茶會，自由入場，無須事先回覆。產線區域禁止攝影，敬請配合現場人員引導。</p>
          <p>順祝時祺，萬事勝意。帆益科技陳定閎、陳薇敬邀。</p>
        </section>

        <nav class="utility-tray" aria-label="邀請函工具">
          <a class="utility-button" data-action="map" href="https://www.google.com/maps/search/?api=1&amp;query=320%20桃園市中壢區中園路%20192%20號%205%20樓之%201%20、2" target="_blank" rel="noopener noreferrer">地圖導航</a>
          <a class="utility-button" data-action="calendar" href="./assets/event.ics" download="freentity-2026-10-04.ics">加入行事曆</a>
          <button class="utility-button" data-action="share" type="button">分享邀請</button>
        </nav>
        <p id="share-status" class="share-status" aria-live="polite"></p>
        <div id="manual-share" class="manual-share" hidden>
          <label for="share-url">請手動複製邀請函網址</label>
          <input id="share-url" type="text" readonly>
        </div>
      </article>
    </main>
    <script type="module" src="./script.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Run the shell test and verify it passes**

Run:

```powershell
npx playwright test tests/invitation.spec.js
```

Expected: PASS with the sealed shell and both local artwork formats available.

- [ ] **Step 8: Commit checkpoint**

After explicit commit authorization only:

```powershell
git add .gitignore package.json package-lock.json playwright.config.js tests/static-server.mjs tests/invitation.spec.js index.html assets/invitation.png assets/invitation.webp
git commit -m "feat(invitation): add static invitation shell"
```

---

### Task 2: Build the mobile-first envelope, paper layout, and responsive contract

**Files:**
- Create: `tests/responsive.spec.js`
- Create: `styles.css`
- Modify: `tests/invitation.spec.js`

**Interfaces:**
- Consumes: `html[data-state]`, `.envelope`, `.envelope__flap`, `.envelope__paper-preview`, `.invitation`, `.invitation__artwork`, and `.utility-tray`
- Produces: a stable 320px-up layout, 402:1404 paper ratio, safe-area gutters, state-driven envelope animations, and reduced-motion CSS

- [ ] **Step 1: Write the failing responsive contract tests**

```js
// tests/responsive.spec.js
import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 402, height: 874 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

for (const viewport of viewports) {
  test(`does not overflow or crop at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

    const metrics = await page.evaluate(() => {
      const artwork = document.querySelector('.invitation__artwork').getBoundingClientRect();
      const controls = [...document.querySelectorAll('.utility-button')].map((node) => node.getBoundingClientRect());
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        artworkWidth: artwork.width,
        artworkHeight: artwork.height,
        controls: controls.map(({ left, right, width, height }) => ({ left, right, width, height })),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.artworkWidth).toBeLessThanOrEqual(402.5);
    expect(metrics.artworkHeight / metrics.artworkWidth).toBeCloseTo(1404 / 402, 2);
    for (const control of metrics.controls) {
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(metrics.clientWidth);
      expect(control.width).toBeGreaterThanOrEqual(72);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('reflows from portrait to landscape and back without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      artworkWidth: document.querySelector('.invitation__artwork').getBoundingClientRect().width,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.artworkWidth).toBeLessThanOrEqual(402.5);
  }
});

test('keeps all utility labels usable with increased text size at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./');
  await page.addStyleTag({ content: ':root { font-size: 125% !important; }' });
  await page.evaluate(() => { document.documentElement.dataset.state = 'open'; });

  const controls = await page.locator('.utility-button').evaluateAll((nodes) => nodes.map((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    height: node.getBoundingClientRect().height,
  })));
  for (const control of controls) {
    expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
});
```

- [ ] **Step 2: Run the responsive suite and verify it fails**

Run:

```powershell
npx playwright test tests/responsive.spec.js
```

Expected: FAIL because the unstyled document does not satisfy envelope, visibility, aspect-ratio, or control-size assertions.

- [ ] **Step 3: Implement the design tokens and mobile-first layout**

Create `styles.css` with these exact foundations, then continue the same file with the state selectors and keyframes in Step 4:

```css
:root {
  color-scheme: light;
  --ink: #26352f;
  --green-900: #244f3e;
  --green-800: #365f4d;
  --green-600: #638775;
  --paper: #f7f5ef;
  --paper-bright: #ffffff;
  --silver: #c8cbc8;
  --gold: #e8ab18;
  --gutter: clamp(12px, 4vw, 24px);
  --paper-width: 402px;
  --opening-duration: 1500ms;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
  background: var(--paper);
  color: var(--ink);
}

* { box-sizing: border-box; }

html {
  min-width: 320px;
  overflow-x: clip;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  min-height: 100svh;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(255,255,255,.92), transparent 32%),
    linear-gradient(135deg, #f8f7f2 0%, #eceeea 52%, #f8f7f2 100%);
}

button, a, input { font: inherit; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.envelope-stage {
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding:
    max(var(--gutter), env(safe-area-inset-top))
    max(var(--gutter), env(safe-area-inset-right))
    max(var(--gutter), env(safe-area-inset-bottom))
    max(var(--gutter), env(safe-area-inset-left));
}

.envelope-scene {
  width: min(100%, 430px);
  text-align: center;
}

.envelope__brand {
  margin: 0 0 .5rem;
  color: var(--green-900);
  font-size: clamp(.78rem, 3vw, .95rem);
  font-weight: 700;
  letter-spacing: .22em;
}

#envelope-title {
  margin: 0;
  color: var(--green-900);
  font-size: clamp(1.2rem, 5.6vw, 1.75rem);
  line-height: 1.35;
}

.envelope__recipient {
  margin: .6rem 0 1.4rem;
  color: var(--green-600);
  letter-spacing: .14em;
}

.envelope {
  position: relative;
  isolation: isolate;
  width: min(calc(100vw - 24px), 380px);
  margin-inline: auto;
  aspect-ratio: 1.55;
  perspective: 1200px;
  filter: drop-shadow(0 22px 28px rgba(36, 79, 62, .18));
}

.envelope__back,
.envelope__front,
.envelope__flap,
.envelope__paper-preview {
  position: absolute;
  inset: 0;
}

.envelope__back {
  border-radius: 8px;
  background: linear-gradient(145deg, var(--green-600), var(--green-900));
}

.envelope__paper-preview {
  z-index: 1;
  inset: 9% 10% 4%;
  border-radius: 4px;
  background:
    linear-gradient(rgba(255,255,255,.08), rgba(255,255,255,.08)),
    url("./assets/invitation.webp") top center / 100% auto no-repeat,
    var(--paper-bright);
  box-shadow: 0 8px 20px rgba(0,0,0,.12);
  transform: translateY(24%);
}

.envelope__front {
  z-index: 2;
  border-radius: 8px;
  background: linear-gradient(155deg, #6f927f, var(--green-800));
  clip-path: polygon(0 22%, 50% 68%, 100% 22%, 100% 100%, 0 100%);
}

.envelope__flap {
  z-index: 3;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(165deg, #799988, var(--green-900));
  clip-path: polygon(0 0, 100% 0, 50% 70%);
  transform-origin: 50% 0;
  backface-visibility: hidden;
}

.open-button {
  min-width: 148px;
  min-height: 48px;
  margin-top: 1.5rem;
  padding: .75rem 1.25rem;
  border: 1px solid rgba(255,255,255,.6);
  border-radius: 999px;
  background: var(--green-900);
  color: white;
  box-shadow: 0 12px 28px rgba(36,79,62,.22);
  cursor: pointer;
}

.open-button:focus-visible,
.utility-button:focus-visible,
.invitation:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 4px;
}

.invitation {
  position: relative;
  isolation: isolate;
  --scroll-shift: 0px;
  display: none;
  width: min(100%, calc(var(--paper-width) + (2 * var(--gutter))));
  margin-inline: auto;
  padding: var(--gutter) var(--gutter) calc(88px + env(safe-area-inset-bottom));
  opacity: 0;
  transform: translateY(48px);
}

.invitation__picture {
  position: relative;
  z-index: 1;
  display: block;
  width: min(100%, var(--paper-width));
  margin-inline: auto;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(23, 49, 39, .2);
}

.invitation__artwork {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 402 / 1404;
}

.utility-tray {
  position: sticky;
  z-index: 10;
  bottom: max(10px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: min(100%, var(--paper-width));
  margin: 14px auto 0;
  padding: 6px;
  border: 1px solid rgba(255,255,255,.55);
  border-radius: 18px;
  background: rgba(36,79,62,.92);
  box-shadow: 0 14px 32px rgba(23,49,39,.22);
  backdrop-filter: blur(14px);
}

.invitation::before,
.invitation::after {
  content: "";
  position: absolute;
  z-index: 0;
  width: clamp(52px, 18vw, 92px);
  aspect-ratio: 1;
  border: 2px solid rgba(101, 113, 108, .35);
  border-radius: 43% 57% 61% 39% / 54% 42% 58% 46%;
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.8), rgba(116,135,126,.14) 48%, transparent 68%);
  filter: drop-shadow(0 8px 16px rgba(36,79,62,.08));
  pointer-events: none;
}

.invitation::before {
  top: 7%;
  left: 0;
  transform: translate(-48%, var(--scroll-shift)) rotate(18deg);
}

.invitation::after {
  top: 58%;
  right: 0;
  transform: translate(48%, calc(0px - var(--scroll-shift))) rotate(-22deg);
}

.utility-button {
  min-width: 0;
  min-height: 48px;
  display: grid;
  place-items: center;
  padding: .55rem .3rem;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: white;
  font-size: clamp(.72rem, 3vw, .86rem);
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.utility-button:hover { background: rgba(255,255,255,.12); }
.share-status, .manual-share { width: min(100%, var(--paper-width)); margin: .75rem auto; }
.manual-share input { width: 100%; min-height: 44px; margin-top: .35rem; }

@media (min-width: 768px) {
  .envelope-stage { padding-block: 48px; }
  .invitation { padding-top: 36px; }
}
```

- [ ] **Step 4: Add state-driven motion and reduced-motion overrides**

Append to `styles.css`:

```css
html[data-state="sealed"] { overflow-y: hidden; }

html[data-state="opening"] { overflow-y: hidden; }
html[data-state="opening"] .envelope__flap { animation: flap-open 520ms cubic-bezier(.3,.7,.2,1) forwards; }
html[data-state="opening"] .envelope__paper-preview { animation: preview-rise 980ms 260ms cubic-bezier(.2,.8,.2,1) forwards; }
html[data-state="opening"] .envelope-stage { animation: stage-recede 420ms 1080ms ease forwards; }
html[data-state="opening"] .invitation { display: block; }

html[data-state="open"] .envelope-stage { display: none; }
html[data-state="open"] .invitation {
  display: block;
  opacity: 1;
  transform: none;
  animation: paper-settle 520ms cubic-bezier(.2,.8,.2,1) both;
}

@keyframes flap-open {
  0% { transform: rotateX(0); z-index: 3; }
  55% { z-index: 3; }
  100% { transform: rotateX(180deg); z-index: 0; }
}

@keyframes preview-rise {
  0% { transform: translateY(24%); }
  70% { transform: translateY(-78%); }
  100% { transform: translateY(-64%); }
}

@keyframes stage-recede {
  to { opacity: 0; transform: translateY(24px) scale(.98); }
}

@keyframes paper-settle {
  from { opacity: 0; transform: translateY(48px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 5: Run the responsive suite and inspect narrow-width evidence**

Run:

```powershell
npx playwright test tests/responsive.spec.js
```

Expected: PASS at all six viewport widths with no horizontal overflow, correct artwork ratio, and all three controls inside the viewport.

- [ ] **Step 6: Commit checkpoint**

After explicit commit authorization only:

```powershell
git add styles.css tests/responsive.spec.js tests/invitation.spec.js
git commit -m "feat(invitation): add responsive envelope layout"
```

---

### Task 3: Implement deterministic opening behavior and motion preferences

**Files:**
- Modify: `tests/invitation.spec.js`
- Create: `script.js`

**Interfaces:**
- Consumes: `html[data-state="sealed"]`, `#open-invitation`, `#invitation`, and `--opening-duration`
- Produces: `openInvitation(): void`, sealed/opening/open transitions, duplicate-activation protection, and post-open focus placement

- [ ] **Step 1: Add failing state-machine and keyboard tests**

Append to `tests/invitation.spec.js`:

```js
test('opens once, locks repeated activation, and focuses the invitation', async ({ page }) => {
  await page.goto('./');
  const openButton = page.getByRole('button', { name: '開啟邀請' });

  await openButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');
  await expect(openButton).toBeDisabled();
  await page.evaluate(() => document.querySelector('#open-invitation').click());
  await expect(page.locator('html')).toHaveAttribute('data-state', 'opening');

  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await expect(page.locator('#invitation')).toBeFocused();
});

test('opens from the keyboard', async ({ page }) => {
  await page.goto('./');
  const openButton = page.getByRole('button', { name: '開啟邀請' });
  await openButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
});

test('uses a short transition when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 500 });
});

test('updates edge parallax during scroll and suppresses it for reduced motion', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(50);
  await expect(page.locator('#invitation')).not.toHaveCSS('--scroll-shift', '0px');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(50);
  await expect(page.locator('#invitation')).toHaveCSS('--scroll-shift', '0px');
});
```

- [ ] **Step 2: Run the interaction tests and verify they fail**

Run:

```powershell
npx playwright test tests/invitation.spec.js
```

Expected: FAIL because `script.js` does not yet transition state or focus the invitation.

- [ ] **Step 3: Implement the three-state controller**

```js
// script.js
const root = document.documentElement;
const openButton = document.querySelector('#open-invitation');
const invitation = document.querySelector('#invitation');
const shareButton = document.querySelector('[data-action="share"]');
const shareStatus = document.querySelector('#share-status');
const manualShare = document.querySelector('#manual-share');
const shareUrl = document.querySelector('#share-url');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const OPENING_MS = 1500;
const REDUCED_OPENING_MS = 80;
let parallaxFrame = 0;

function setState(state) {
  root.dataset.state = state;
}

export function openInvitation() {
  if (root.dataset.state !== 'sealed') return;

  setState('opening');
  openButton.disabled = true;
  openButton.setAttribute('aria-busy', 'true');

  window.setTimeout(() => {
    setState('open');
    openButton.removeAttribute('aria-busy');
    invitation.focus({ preventScroll: true });
    invitation.scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, reducedMotion.matches ? REDUCED_OPENING_MS : OPENING_MS);
}

openButton.addEventListener('click', openInvitation);

export async function shareInvitation() {
  const url = window.location.href;
  const data = {
    title: document.title,
    text: '誠摯邀請您參加帆益科技新廠落成開幕暨技術發表。',
    url,
  };

  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(data);
      shareStatus.textContent = '已開啟分享選單。';
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = '邀請函網址已複製。';
      return;
    }

    throw new Error('Clipboard unavailable');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    shareUrl.value = url;
    manualShare.hidden = false;
    shareUrl.focus();
    shareUrl.select();
    shareStatus.textContent = '請手動複製下方網址。';
  }
}

shareButton.addEventListener('click', shareInvitation);

function syncParallax() {
  parallaxFrame = 0;
  if (reducedMotion.matches) {
    invitation.style.setProperty('--scroll-shift', '0px');
    return;
  }

  const relativeScroll = window.scrollY - invitation.offsetTop;
  const shift = Math.max(-10, Math.min(10, relativeScroll * 0.015));
  invitation.style.setProperty('--scroll-shift', `${shift.toFixed(2)}px`);
}

function requestParallaxUpdate() {
  if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(syncParallax);
}

window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
reducedMotion.addEventListener('change', syncParallax);

document.querySelector('.invitation__artwork').addEventListener('error', () => {
  invitation.classList.add('invitation--artwork-missing');
});
```

- [ ] **Step 4: Run interaction and responsive regression tests**

Run:

```powershell
npx playwright test tests/invitation.spec.js tests/responsive.spec.js
```

Expected: PASS for pointer, keyboard, duplicate activation, reduced motion, focus, and every viewport width.

- [ ] **Step 5: Commit checkpoint**

After explicit commit authorization only:

```powershell
git add script.js tests/invitation.spec.js
git commit -m "feat(invitation): add opening interaction"
```

---

### Task 4: Add static calendar, navigation, sharing, and resilience checks

**Files:**
- Create: `assets/event.ics`
- Create: `tests/utilities.spec.js`
- Modify: `tests/invitation.spec.js`
- Modify: `styles.css`
- Verify: `index.html`
- Verify: `script.js`

**Interfaces:**
- Consumes: `[data-action="map"]`, `[data-action="calendar"]`, `[data-action="share"]`, `#share-status`, `#manual-share`, and `.invitation__transcript`
- Produces: valid static calendar data, exact venue navigation, native share, copy fallback, manual-copy fallback, visible transcript on total artwork failure, and no-JavaScript readability

- [ ] **Step 1: Write failing utility and fallback tests**

```js
// tests/utilities.spec.js
import { expect, test } from '@playwright/test';

test('uses the exact venue and repository-local calendar', async ({ page, request }) => {
  await page.goto('./');

  const mapHref = await page.locator('[data-action="map"]').getAttribute('href');
  expect(decodeURIComponent(mapHref)).toContain('320 桃園市中壢區中園路 192 號 5 樓之 1 、2');

  await expect(page.locator('[data-action="calendar"]')).toHaveAttribute('href', './assets/event.ics');
  const calendar = await request.get('./assets/event.ics');
  expect(calendar.ok()).toBe(true);
  const body = await calendar.text();
  expect(body).toContain('DTSTART;TZID=Asia/Taipei:20261004T140000');
  expect(body).toContain('DTEND;TZID=Asia/Taipei:20261004T163000');
  expect(body).toContain('LOCATION:320 桃園市中壢區中園路 192 號 5 樓之 1、2');
});

test('copies the URL when native sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (value) => { window.__copiedInvitationUrl = value; } },
      configurable: true,
    });
  });
  await page.goto('./');
  await page.getByRole('button', { name: '分享邀請' }).click();
  await expect(page.locator('#share-status')).toHaveText('邀請函網址已複製。');
  expect(await page.evaluate(() => window.__copiedInvitationUrl)).toBe(page.url());
});

test('reveals a manual URL when share and clipboard both fail', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.goto('./');
  await page.getByRole('button', { name: '分享邀請' }).click();
  await expect(page.locator('#manual-share')).toBeVisible();
  await expect(page.locator('#share-url')).toHaveValue(page.url());
});

test('shows readable event text when artwork cannot load', async ({ page }) => {
  await page.route('**/assets/invitation.*', (route) => route.abort());
  await page.goto('./');
  await page.getByRole('button', { name: '開啟邀請' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
  await expect(page.locator('.invitation__transcript')).toBeVisible();
  await expect(page.getByText('2026 年 10 月 4 日星期日')).toBeVisible();
});

test('shows the invitation when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/Freentity/');
  await expect(page.locator('#invitation')).toBeVisible();
  await context.close();
});
```

Append to `tests/invitation.spec.js`:

```js
test('exposes complete event details to assistive technology', async ({ page }) => {
  await page.goto('./');
  const transcript = page.locator('.invitation__transcript');
  await expect(transcript).toContainText('14:00 開放入場');
  await expect(transcript).toContainText('16:30 活動結束');
  await expect(transcript).toContainText('產線區域禁止攝影');
});
```

- [ ] **Step 2: Run the utility tests and verify the missing calendar and visible-fallback failures**

Run:

```powershell
npx playwright test tests/utilities.spec.js tests/invitation.spec.js
```

Expected: FAIL because `assets/event.ics` does not exist and artwork-failure styling does not reveal the transcript.

- [ ] **Step 3: Create the exact static calendar file**

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Freentity//Factory Opening Invitation//ZH-TW
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VTIMEZONE
TZID:Asia/Taipei
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:20261004T140000-freentity@github.io
DTSTAMP:20260827T000000Z
DTSTART;TZID=Asia/Taipei:20261004T140000
DTEND;TZID=Asia/Taipei:20261004T163000
SUMMARY:帆益科技新廠落成開幕暨技術發表
LOCATION:320 桃園市中壢區中園路 192 號 5 樓之 1、2
DESCRIPTION:誠摯邀請您參加帆益科技新廠落成開幕暨技術發表。14:00 起自由入場。
END:VEVENT
END:VCALENDAR
```

- [ ] **Step 4: Add visible total-image-failure styling**

Append to `styles.css`:

```css
.invitation--artwork-missing .invitation__picture { display: none; }

.invitation--artwork-missing .invitation__transcript {
  position: static;
  width: min(100%, var(--paper-width));
  height: auto;
  margin: 0 auto;
  padding: clamp(20px, 6vw, 38px);
  overflow: visible;
  clip: auto;
  white-space: normal;
  border-radius: 2px;
  background: var(--paper-bright);
  box-shadow: 0 24px 60px rgba(23,49,39,.2);
  line-height: 1.8;
}
```

- [ ] **Step 5: Run utilities, accessibility, and responsive regression**

Run:

```powershell
npx playwright test tests/utilities.spec.js tests/invitation.spec.js tests/responsive.spec.js
```

Expected: PASS for calendar content, map target, copy/manual-copy paths, no-JavaScript rendering, image failure, semantics, and mobile widths.

- [ ] **Step 6: Commit checkpoint**

After explicit commit authorization only:

```powershell
git add assets/event.ics tests/utilities.spec.js tests/invitation.spec.js styles.css index.html script.js
git commit -m "feat(invitation): add static invitation utilities"
```

---

### Task 5: Add visual evidence, GitHub Pages delivery, and final verification

**Files:**
- Create: `tests/visual.spec.js`
- Create: `tests/deployment.spec.js`
- Create: `scripts/build-site.mjs`
- Create: `.github/workflows/pages.yml`
- Create: `README.md`
- Modify: `package.json`
- Verify: all runtime files and tests

**Interfaces:**
- Consumes: all runtime assets and Playwright suites from Tasks 1-4
- Produces: six-width visual evidence, tested `_site` assembly, GitHub Pages workflow, documented local preview, and a final verification record

- [ ] **Step 1: Write the visual evidence and deployment contract tests**

```js
// tests/visual.spec.js
import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 402, 768, 1440];

for (const width of widths) {
  test(`captures sealed and open states at ${width}px`, async ({ page }) => {
    await mkdir('test-results/visual', { recursive: true });
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.goto('./');
    await page.screenshot({ path: `test-results/visual/${width}-sealed.png`, fullPage: true });

    await page.getByRole('button', { name: '開啟邀請' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-state', 'open', { timeout: 2500 });
    await page.screenshot({ path: `test-results/visual/${width}-open.png`, fullPage: true });
  });
}
```

```js
// tests/deployment.spec.js
import { execFile as execFileCallback } from 'node:child_process';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execFile = promisify(execFileCallback);

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

test.afterEach(async () => {
  await rm('_site', { recursive: true, force: true });
});

test('builds a minimal Pages artifact with no custom-domain or test files', async () => {
  await execFile(process.execPath, ['scripts/build-site.mjs']);
  expect(await listFiles('_site')).toEqual([
    '.nojekyll',
    'assets/event.ics',
    'assets/invitation.png',
    'assets/invitation.webp',
    'index.html',
    'script.js',
    'styles.css',
  ]);

  const html = await readFile('_site/index.html', 'utf8');
  expect(html).not.toContain('figma.com/api/mcp/asset');
  expect(html).not.toContain('CNAME');
});

test('all runtime assets resolve below the repository path', async ({ request }) => {
  for (const path of ['./', './styles.css', './script.js', './assets/invitation.webp', './assets/invitation.png', './assets/event.ics']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
});
```

- [ ] **Step 2: Run the deployment test and verify it fails**

Run:

```powershell
npx playwright test tests/deployment.spec.js
```

Expected: FAIL because `scripts/build-site.mjs` does not exist.

- [ ] **Step 3: Create the static artifact builder**

```js
// scripts/build-site.mjs
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outputRoot = '_site';
const runtimeFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'assets/invitation.webp',
  'assets/invitation.png',
  'assets/event.ics',
];

await rm(outputRoot, { recursive: true, force: true });
for (const source of runtimeFiles) {
  const destination = join(outputRoot, source);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
await writeFile(join(outputRoot, '.nojekyll'), '', 'utf8');
```

- [ ] **Step 4: Create the GitHub Pages workflow using the current official Pages actions**

```yaml
name: Deploy Freentity invitation

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v5

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm

      - name: Install test dependencies
        run: npm ci

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: Test static invitation
        run: npm test

      - name: Configure GitHub Pages
        uses: actions/configure-pages@v5

      - name: Assemble static site
        run: node scripts/build-site.mjs

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: _site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 5: Document the exact local and Pages workflow**

````markdown
# Freentity Interactive Invitation

Pure static invitation website for the Freentity new factory opening and technology presentation.

## Local preview

```powershell
npm ci
npx playwright install chromium
node tests/static-server.mjs
```

Open `http://127.0.0.1:4173/Freentity/`.

## Verification

```powershell
npm test
npm run test:responsive
npm run test:visual
```

Visual evidence is written to `test-results/visual/` and is intentionally ignored by Git.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the site and publishes only `index.html`, `styles.css`, `script.js`, and the three runtime assets. The site uses repository-relative paths and requires no custom domain, backend, repository secret, or analytics service.
````

- [ ] **Step 6: Run the complete automated suite**

Run:

```powershell
npm test
```

Expected: every Playwright test passes with exit code 0.

- [ ] **Step 7: Inspect every mobile and desktop evidence image**

Run:

```powershell
npm run test:visual
Get-ChildItem -LiteralPath 'test-results\visual' | Select-Object Name,Length
```

Inspect all twelve images and require:

- no horizontal overflow at 320, 375, 390, or 402 pixels;
- no detached flap, sideways paper drift, clipped open control, or tool-label collision;
- exact uncropped invitation artwork at every width;
- centered, restrained 402-pixel paper width on tablet and desktop;
- no utility tray overlap with invitation content;
- consistent Freentity palette and readable interface text.

- [ ] **Step 8: Verify the generated calendar and static artifact contents**

Run:

```powershell
Get-Content -Raw 'assets\event.ics'
rg -n 'https?://' index.html styles.css script.js
git status --short
```

Expected:

- the calendar contains the approved date, 14:00 start, 16:30 end, Asia/Taipei timezone, and exact venue;
- runtime URLs contain only the Google Maps link and no tracking or expired Figma asset URL;
- `_site`, `tmp`, `node_modules`, reports, and test results remain ignored;
- changed paths match the planned file structure.

- [ ] **Step 9: Commit checkpoint**

After explicit commit authorization only:

```powershell
git add .github/workflows/pages.yml README.md scripts/build-site.mjs tests/visual.spec.js tests/deployment.spec.js package.json package-lock.json
git commit -m "ci(pages): verify and deploy static invitation"
```

- [ ] **Step 10: Publication checkpoint**

Do not push or enable GitHub Pages without explicit publication authorization. After authorization, verify the exact remote and branch before running:

```powershell
git remote -v
git branch --show-current
git push -u origin main
```

After the workflow completes, verify the returned Pages URL on a mobile viewport and confirm the same automated checks against the deployed site.
