# Chrome 線上應用程式商店：上架資料

送審時把下面的內容貼進開發者後台對應的欄位。圖片都在這個資料夾，由 `python tools/make-store-images.py` 產生；上傳用的 ZIP 由 `python tools/package.py` 產生在 `dist/`。

## 商店資訊（Store listing）

**名稱**（manifest 的 `name`，最多 75 字）

> AutoSPD for YouTube — AI 智慧播放速度

**摘要**（manifest 的 `description`，最多 132 字，會自動帶入）

> 依影片內容自動調整 YouTube 播放速度：用關鍵字、YouTube 分類或本機 AI 判斷，支援頻道規則，直播與音樂固定 1x。

**詳細說明**

```
看說書、案件解說、新聞評論時想開 1.5 倍速，聽音樂、看直播時又要切回 1 倍速？AutoSPD 會依影片內容自動幫你調整 YouTube 的播放速度，不必每支影片都手動切換。

■ 三種分類方式，自己選
・關鍵字分類：依標題、標籤、頻道名稱比對你設定的分類與關鍵字，可以細分到你常看的內容類型。
・YouTube 分類：使用上傳者選的影片分類，每種分類各自設定速度，結果穩定可預期。
・AI 內容分析（實驗性）：使用 Chrome 內建的 AI 模型，判斷影片實際在講什麼，不被聳動的標題誤導。模型在你的電腦上執行，資料不會上傳。

■ 依頻道指定速度
常看的頻道可以直接指定速度，在影片頁打開 AutoSPD 就能設定，優先於所有分類。

■ 直播與音樂
・正在直播的影片、音樂與 MV 固定 1 倍速。
・直播結束後的長篇重播，沒有符合分類時自動加速（預設 1.5 倍）。

■ 其他
・換影片、廣告結束後自動維持你的速度；用 YouTube 選單或快捷鍵手動調速時，會尊重你的選擇。
・與 YouTube 播放器的速度選單同步。
・可自動關閉 YouTube 自動開啟的 CC 字幕。
・速度提示可開關。

■ 隱私
AutoSPD 不會傳送任何資料給開發者或第三方，沒有追蹤或廣告。設定存在你的瀏覽器裡，AI 分析也在本機完成。

AI 內容分析需要 Chrome 138 以上版本，並符合 Chrome 內建 AI 的硬體需求（約 4GB 以上顯示記憶體或 16GB 記憶體，以及約 22GB 可用空間）；不符合時仍可使用其他兩種分類方式。
```

**類別**：工具（Tools）

**語言**：中文（繁體）

**圖片**

| 欄位 | 檔案 | 尺寸 |
|---|---|---|
| 商店圖示 | `extension/icons/icon128.png`（已包含在 ZIP 中） | 128×128，圖案 96×96 加 16px 透明邊 |
| 螢幕截圖 1 | `screenshot-1-popup.png` | 1280×800 |
| 螢幕截圖 2 | `screenshot-2-ai-mode.png` | 1280×800 |
| 螢幕截圖 3 | `screenshot-3-youtube-mode.png` | 1280×800 |
| 螢幕截圖 4 | `screenshot-4-live-and-channels.png` | 1280×800 |
| 小型宣傳圖塊 | `promo-small.png` | 440×280 |

截圖最多 5 張。建議第 5 張用實際的 YouTube 播放畫面加上 AutoSPD 彈出視窗，需要在 Chrome 中手動截圖並裁成 1280×800。

## 隱私權做法（Privacy practices）

**單一用途說明**

```
依影片內容自動調整 YouTube 的播放速度。擴充功能讀取目前 YouTube 影片的標題、標籤、頻道與分類，依使用者設定的規則（關鍵字、YouTube 分類、頻道規則或本機 AI 判斷）決定並套用播放速度。
```

**權限理由**

- `storage`

```
儲存使用者的分類、關鍵字、頻道規則與開關設定，以及 AI 判斷結果的快取（影片 ID 與分類），避免同一支影片重複分析。不保存觀看紀錄。
```

- 主機權限（`https://www.youtube.com/*`、`https://youtube.com/*`）

```
擴充功能只在 YouTube 上運作：需要在 YouTube 影片頁面讀取目前影片的標題、標籤、頻道與分類，並透過播放器調整播放速度與字幕；彈出視窗也用它確認目前分頁是否為 YouTube 影片。
```

**是否使用遠端程式碼**：否

```
所有程式碼都包含在擴充功能套件中，不會載入或執行遠端程式碼。AI 內容分析使用 Chrome 瀏覽器內建的 Prompt API（LanguageModel），模型由 Chrome 提供並在本機執行。
```

**資料使用聲明**

擴充功能不會把任何資料傳出使用者的裝置（沒有任何網路請求），也不保存觀看紀錄，所以「蒐集的使用者資料」全部不勾選，並勾選三項有限用途聲明。

**隱私權政策網址**

repo 目前是 private，GitHub 上的 `PRIVACY.md` 外人打不開。上架前需要擇一：

- 把 repo 改成 public，使用 `https://github.com/george16886/AutoSPD/blob/main/PRIVACY.md`
- 或把 `PRIVACY.md` 的內容放到其他公開網址（例如 GitHub Pages、Google 協作平台）

## 送審前檢查

- [ ] `python tools/package.py` 產生最新的 ZIP
- [ ] 在 Chrome 實測：一般影片、廣告前後、YouTube 選單手動調速、AI 模式、直播固定 1x、MV 固定 1x、直播重播、自動關閉字幕
- [ ] 隱私權政策已有公開網址，且 `PRIVACY.md` 的聯絡方式可公開存取
