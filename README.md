# Freentity 互動邀請函

帆益科技新廠落成開幕暨技術發表的純靜態互動邀請函。訪客開啟頁面後會先看到信封正面；點擊漂浮的 `Open` 字樣後，信封依序翻到背面、開封並抽出邀請卡，再從頂端閱讀四張由 Figma 原稿無損裁切的邀請函頁面。

## 本機預覽

```powershell
npm ci
npx playwright install chromium
node tests/static-server.mjs
```

瀏覽 `http://127.0.0.1:4173/Freentity/`。

## 驗證

```powershell
npm test
npm run test:responsive
npm run test:webkit
npm run test:visual
npm run build
```

多尺寸視覺證據會寫入 `test-results/visual/`，此目錄不會納入 Git。`npm run build` 只會把公開網站需要的七個檔案組裝到 `_site/`。邀請函內部使用 Figma 匯出的同一份原始圖檔，四段裁切完整覆蓋 402 × 1404 設計稿且不重疊；動畫只作用在信封與紙張外層。開信階段會以 CSS 將抽出的卡片暫時轉為灰階，以維持深綠、灰、白的入口配色，來源圖片檔不會被改寫。另保留隱藏文字稿供輔助技術讀取。

## GitHub Pages

`.github/workflows/pages.yml` 會在 `main` 分支更新後測試網站，接著透過 GitHub Pages 發布 `_site/`。所有路徑皆為 repository-relative，適合預設的 `https://<帳號>.github.io/Freentity/` 專案網址。

此網站不使用自訂網域、後端、資料庫、表單、追蹤服務、分析服務、cookie 或 repository secret；專案也不包含 `CNAME`。公開成品只有 HTML、CSS、JavaScript，以及存放於 repository 內的 Logo、開信卡片與 Figma 原始圖片。
