# Freentity 互動邀請函

帆益科技新廠落成開幕暨技術發表的純靜態互動邀請函。訪客開啟頁面後可點擊信封閱讀邀請，並可使用地圖導航、下載行事曆或分享網址。

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
npm run test:visual
npm run build
```

多尺寸視覺證據會寫入 `test-results/visual/`，此目錄不會納入 Git。`npm run build` 只會把公開網站需要的七個檔案組裝到 `_site/`。

## GitHub Pages

`.github/workflows/pages.yml` 會在 `main` 分支更新後測試網站，接著透過 GitHub Pages 發布 `_site/`。所有路徑皆為 repository-relative，適合預設的 `https://<帳號>.github.io/Freentity/` 專案網址。

此網站不使用自訂網域、後端、資料庫、表單、追蹤服務、分析服務、cookie 或 repository secret；專案也不包含 `CNAME`。
