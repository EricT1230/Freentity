# Freentity 互動邀請函

帆益科技新廠落成開幕暨技術發表的純靜態互動邀請函。

正式網址：<https://freentity.pages.dev/>

## 體驗流程

訪客先看到一封放在深綠場景上的霧灰礦物紙綁繩信封：兩顆同紙繫繩扣（中央嵌金屬雞眼圈）之間，繞著三圈八字形深綠棉繩，右下有壓凹的品牌線條，封口上是全彩 Logo。點擊後繩子由最外圈往內逐圈鬆開、鬆掉的長度轉成垂下的繩尾並在重力下擺正，封口沿頂緣向後翻開露出內襯與卡片，卡片抽出後進入邀請函本文；本文直接呈現客戶提供的新版完整長卷，閱讀時上方有進度線與頁首，行動裝置底部有工具列，寬螢幕左側則是導覽側欄。

- 桌機游標移動時信封會做輕微 3D 傾斜。
- 網站介面色調只有灰、白、深綠。方形 Logo 是不可更動的元素：圖檔本身沒有任何 filter、混合模式或透明度變化，維持全彩標準色；邀請函原稿內既有的色彩也完全不重繪。
- 拆繩符合物理：繩長守恆（鬆開多少就垂下多少），最外圈先鬆，任何一圈還綁著封口就不會動。
- 扣子本體是白色紙片，中央金屬圈只是固定紙片並把它墊高的鉚釘。繩子一端綁死在下方紙片底下的金屬環，往上繞過上方鈕扣、來回數趟把信封住；每一圈的轉折都從紙片底下通過，所以看得見的只有跨在兩扣之間的繩段，以及繩子沒入紙片邊緣的轉折點。兩顆扣子由信封尺寸換算，永遠一樣大。
- 信封尺寸由視窗高度推導（信封本身加上翻起的封口），因此任何視窗比例都不會被裁切。
- 側欄需要足夠高度才會出現；空間不足（例如瀏覽器放大到 150%）時自動改用頁首加底部工具列。
- 邀請函在手機保留 12px 邊距，在桌機放大到 820px 寬；瀏覽器會依顯示密度在 1170px 與 2340px 來源圖之間選擇，避免下載不必要的大圖。
- 尊重 `prefers-reduced-motion`，並在 JavaScript 載入失敗時直接顯示完整邀請函。

## 檔案

| 檔案 | 用途 |
|------|------|
| `index.html` | 頁面結構、Open Graph、失效備援 |
| `styles.css` | 設計 token、基底樣式、開場場景 |
| `envelope.css` | 綁繩信封本體與拆繩、掀封、抽卡動態 |
| `reader.css` | 邀請函閱讀區與導覽介面 |
| `script.js` | 開場狀態機、傾斜互動、閱讀進度與工具 |
| `assets/` | Logo、開信卡片、PDF 匯出長卷、社群預覽圖、行事曆檔 |

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

多尺寸視覺證據會寫入 `test-results/visual/`，此目錄不會納入 Git。`npm run build` 只會把公開網站需要的檔案組裝到 `_site/`。

邀請函內部使用新版 PDF 匯出的單一長卷圖檔，不切頁、不重排、不覆蓋任何設計內容。`tests/fidelity.spec.js` 驗證圖片沒有裁切、濾鏡、透明度或重建；`tests/utilities.spec.js` 另以 SHA-256 鎖定兩個解析度的來源資產。`#invitation-reader` 內只放長卷與不可見的段落定位點，所有導覽元件都在外層。動畫只作用在信封與紙張外層，抽出的卡片與社群預覽圖皆保留官方全彩標準色。另保留隱藏文字稿供輔助技術讀取。

## 部署

推送到 `main` 後由 Cloudflare Pages 自動重新部署。所有路徑皆為 repository-relative，因此同一份檔案在網域根目錄（`https://freentity.pages.dev/`）與子路徑（`https://<帳號>.github.io/Freentity/`）都能正常運作，`tests/deployment.spec.js` 會強制這一點。

`.github/workflows/pages.yml` 仍會在 `main` 更新後跑完整測試，並保留 GitHub Pages 發布作為備援。

此網站不使用自訂網域、後端、資料庫、表單、追蹤服務、分析服務、cookie 或 repository secret；專案也不包含 `CNAME`。外部連結只有三個，且都需要使用者主動點擊：兩個品牌標誌連往官網 <https://freentity.com/>，以及 Google 地圖地址查詢。其餘資源全部由本站提供。
