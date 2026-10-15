# Fion 髮型工作室網站

純靜態網站（GitHub Pages）。兩個 AI 功能全部喺用家手機瀏覽器行 相片唔會上傳 唔使月費：

- **AI 染髮**：MediaPipe 頭髮分割 → 換成揀咗嘅大熱色 按底色（3 / 6 / 9 度）模擬效果
- **AI 髮型**：MediaPipe 臉部點位 → 估面型 → 推介髮型（另有 3 條問題嘅小測驗）

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
