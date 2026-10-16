# Fion 髮型工作室網站

純靜態網站（GitHub Pages）。兩個 AI 功能全部喺用家手機瀏覽器行 相片唔會上傳 唔使月費：

- **AI 染髮**：MediaPipe 頭髮分割 → 換成揀咗嘅大熱色 按底色（3 / 6 / 9 度）模擬效果
- **AI 髮型速配**：MediaPipe 臉部點位 → 估面型 → 再答髮質同打理習慣 → 由 14 款熱門髮型揀最夾（配對方法同舊網站一樣）
- **AI 換髮型效果圖**：`worker.js` + `functions/api/preview.js`（Cloudflare）叫 Google Gemini 改相 呢個功能要伺服器 所以要放喺 Cloudflare 先用得

## 改內容
全部喺 `js/data.js`：
- `SHOP`：WhatsApp 號碼、Instagram、地址
- `COLOURS`：髮色（名、參考色碼、要幾多度底色先做到、一句講）
- `FACE_SHAPES`：每個面型推介嘅髮型

## 本機試
```
python3 -m http.server 8000
```
打開 http://localhost:8000

## 第三方
`vendor/mediapipe` 同 `models/` 係 Google MediaPipe（Apache 2.0）。

## 上線（Cloudflare Workers：連 AI 換髮型效果圖）
1. 去 https://aistudio.google.com/apikey 開一條 Gemini API key（AI 畫圖可能要開 billing）
2. Cloudflare → Workers & Pages → Create → Import a repository → 揀 `fion-hair`
   - 唔使填 build command：`wrangler.jsonc` 已經講咗 `worker.js` 負責 `/api/*` 其他檔案當靜態網站
3. 開好之後 fion-hair → Settings → Variables and Secrets → Add → Type 揀 Secret → Name `GEMINI_API_KEY` → 貼 key → Deploy
4. （建議）防人狂試：Workers KV 開一個 namespace 綁做 `LIMITS` 每個 IP 每日最多 8 張（可以用 `DAILY_LIMIT` 改）

（如果用 Cloudflare Pages 而唔係 Workers：`functions/api/preview.js` 會自動變 Pages Function 一樣用得。）

可選變數：`GEMINI_MODEL`（預設 `gemini-2.5-flash-image`）

淨係用 GitHub Pages 都得 但「AI 換髮型效果圖」會顯示「暫時未開放」 其他功能照用。
