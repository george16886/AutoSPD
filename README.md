# AutoSPD — YouTube 智慧播放速度控制器

AutoSPD 是一個 YouTube 播放速度控制產品原型，包含設定網站、Chrome 擴充功能背景程式碼，以及產品系統設計提案。產品目標是依影片類型套用播放速度，並讓使用者自訂分類和規則。

> **目前狀態：原型／開發中。** 網站需要先設定自己的 Firebase 專案才能使用 Google 登入與 Firestore；瀏覽器擴充功能也尚未包含 manifest 所引用的部分必要檔案，尚不能直接安裝使用。

## 功能概覽

- 管理影片分類、分類關鍵字及預設播放速度。
- 網站提供 Google 登入、設定介面、觀看紀錄與統計儀表板原型。
- 擴充功能背景程式碼包含分類比對、Chrome Storage 設定同步及本機歷史紀錄處理。
- 產品架構、影片分類策略、行動 App 方案與風險評估詳見 [`youtube-speed-controller-proposal.md`](./youtube-speed-controller-proposal.md)。

## 專案結構

```text
.
├── extension/
│   ├── background.js     # 擴充功能背景服務工作者與分類邏輯
│   ├── content.js        # YouTube 影片偵測與播放速度套用
│   ├── content.css       # 播放頁提示樣式
│   ├── popup.html        # 擴充功能操作介面
│   ├── popup.css
│   ├── popup.js
│   └── manifest.json     # Chrome Manifest V3 設定
├── webapp/
│   ├── index.html        # 設定網站與儀表板介面
│   ├── css/              # 網站樣式
│   └── js/               # Firebase、登入、狀態、UI 與應用程式邏輯
├── goal.md               # 原始產品需求與設計提示
└── youtube-speed-controller-proposal.md
                          # 系統設計與開發提案
```

## 網站本機預覽

網站是靜態 HTML、CSS 與 JavaScript，使用 Firebase JavaScript SDK。建議透過本機 HTTP 靜態伺服器開啟 `webapp/`，不要直接以 `file://` 開啟；可使用 VS Code Live Server 等工具。

### 設定 Firebase

1. 建立 Firebase 專案。
2. 在 Firebase Authentication 啟用 Google 登入，並設定本機及正式網站的授權網域。
3. 啟用 Cloud Firestore，並為使用者資料設定符合需求的 Firestore Security Rules。
4. 將 Firebase Web app 設定值填入 [`webapp/js/config.js`](./webapp/js/config.js)：

   ```js
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT.appspot.com",
       messagingSenderId: "YOUR_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

5. 以本機 HTTP 伺服器提供 `webapp/` 目錄，然後在瀏覽器開啟伺服器網址。

Firebase Web 設定值會出現在用戶端，不能取代資料庫安全規則。請勿把服務帳戶私鑰或其他伺服器端憑證放入前端程式碼或提交到 Git。

## Chrome 擴充功能

目前擴充功能提供依影片標題／頻道關鍵字比對分類、自動調速、調速開關、未分類影片預設速度，以及只套用到目前影片的手動速度。分類與設定透過 Chrome Storage Sync 儲存，套用速度直接作用在目前 YouTube 頁面的影片播放器上。

### 載入未封裝項目

1. 使用 Chrome 開啟 `chrome://extensions`。
2. 開啟右上角的「開發人員模式」。
3. 選擇「載入未封裝項目」，並選取專案的 `extension/` 資料夾。
4. 開啟或重新整理 YouTube 影片頁面，再按工具列上的 AutoSPD 圖示操作。

擴充功能目前尚未提供自訂分類管理介面、Google 登入／跨產品帳號同步或 Safari 封裝。Chrome Storage Sync 可在使用者已登入並啟用同步的 Chrome 設定檔之間同步瀏覽器資料，但不等同於 AutoSPD Google 登入。

## 行動 App 與 YouTube 資料

目前沒有 iOS 或 Android App 實作。請參考提案中的行動端方案：companion app 可管理設定並開啟官方 YouTube App，但不能宣稱能控制官方 App 內的播放器。使用 Google 登入 AutoSPD 也不會自動登入 YouTube。

## 技術與相容性

- 網站：HTML、CSS、原生 JavaScript
- 登入與資料：Firebase Authentication、Cloud Firestore
- 擴充功能原型：Chrome Manifest V3、Chrome Storage API
- 目標瀏覽器：網站可在現代瀏覽器瀏覽；擴充功能目前只包含 Chrome/Chromium Manifest V3 的初始設定，其他瀏覽器尚未驗證。

## 測試

擴充功能的分類邏輯測試使用 Node.js 內建測試執行器，不需要安裝套件：

```sh
node --test extension/tests/background.test.cjs extension/tests/content.test.cjs
```

另外請在 Chrome 手動驗證 YouTube 影片導覽、自動調速、設定開關、預設速度、影片手動調速，以及非 YouTube 分頁的提示。網站端仍需設定 Firebase 後手動驗證登入、登出及資料儲存。

## 隱私與 YouTube 體驗

產品設計目標是透過瀏覽器擴充功能在使用者原本的 YouTube 網頁調整播放速度，不讀取或寫入 YouTube 觀看紀錄。但 YouTube 的推薦結果仍由 YouTube 自身系統決定，不能保證觀看行為對推薦結果完全沒有影響。請在正式發布前補齊隱私政策、資料保留／刪除方式及必要的第三方服務揭露。

## 文件

- [系統設計與開發提案](./youtube-speed-controller-proposal.md)
- [原始需求與設計提示](./goal.md)
