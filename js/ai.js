// AI 部分：全部喺用家部機（瀏覽器）行 相片唔會上傳
import { FilesetResolver, ImageSegmenter, FaceLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';

const BASE = new URL('..', import.meta.url).href;
let filesetPromise, segmenterPromise, landmarkerPromise;

function fileset() {
  filesetPromise ??= FilesetResolver.forVisionTasks(BASE + 'vendor/mediapipe/wasm');
  return filesetPromise;
}

// 用 CPU 行：GPU 喺部分手機會出格仔噪點
async function create(Task, options) {
  const fs = await fileset();
  return Task.createFromOptions(fs, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
}

function segmenter() {
  segmenterPromise ??= create(ImageSegmenter, {
    baseOptions: { modelAssetPath: BASE + 'models/hair_segmenter.tflite' },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  return segmenterPromise;
}

function landmarker() {
  landmarkerPromise ??= create(FaceLandmarker, {
    baseOptions: { modelAssetPath: BASE + 'models/face_landmarker.task' },
    runningMode: 'IMAGE',
    numFaces: 1,
  });
  return landmarkerPromise;
}

export function preload() {
  segmenter();
  landmarker();
}

// 頭髮遮罩：回傳每個像素係頭髮嘅機會（0 至 1）
export async function hairMask(canvas) {
  const seg = await segmenter();
  const result = seg.segment(canvas);
  const masks = result.confidenceMasks;
  // hair_segmenter 有兩個 mask：0 = 背景 1 = 頭髮
  const m = masks[masks.length - 1];
  const raw = Float32Array.from(m.getAsFloat32Array());
  const { width, height } = m;
  masks.forEach((x) => x.close());
  return { data: refineMask(raw, canvas, width, height), width, height };
}

// 盒狀模糊（用積分圖 快）
function boxBlur(src, w, h, r) {
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

// Guided filter：等遮罩邊緣跟返髮絲 唔會一嚿嚿
function refineMask(p, canvas, w, h) {
  let src = canvas;
  if (canvas.width !== w || canvas.height !== h) {
    src = document.createElement('canvas');
    src.width = w; src.height = h;
    src.getContext('2d').drawImage(canvas, 0, 0, w, h);
  }
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  const n = w * h;
  const I = new Float32Array(n), Ip = new Float32Array(n), II = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
    I[i] = v; Ip[i] = v * p[i]; II[i] = v * v;
  }
  const r = Math.max(2, Math.round(Math.min(w, h) / 120));
  const eps = 0.0015;
  const mI = boxBlur(I, w, h, r), mp = boxBlur(p, w, h, r);
  const mIp = boxBlur(Ip, w, h, r), mII = boxBlur(II, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cov = mIp[i] - mI[i] * mp[i];
    const v = mII[i] - mI[i] * mI[i];
    a[i] = cov / (v + eps);
    b[i] = mp[i] - a[i] * mI[i];
  }
  const ma = boxBlur(a, w, h, r), mb = boxBlur(b, w, h, r);
  // 唔准離原本遮罩太遠 防止染到背景
  const near = boxBlur(p, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const q = ma[i] * I[i] + mb[i];
    out[i] = Math.max(0, Math.min(1, q, near[i] * 1.25));
  }
  return out;
}

// ---------- 色彩轉換（sRGB <-> CIELAB）----------
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);

function rgbToLab(r, g, b) {
  r = toLin(r / 255); g = toLin(g / 255); b = toLin(b / 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(L, a, bb) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const x = fi(fx) * 0.95047, y = fi(fy), z = fi(fz) * 1.08883;
  const r = x * 3.2406 - y * 1.5372 - z * 0.4986;
  const g = -x * 0.9689 + y * 1.8758 + z * 0.0415;
  const b = x * 0.0557 - y * 0.204 + z * 1.057;
  const c = (v) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, v)) * 255)));
  return [c(r), c(g), c(b)];
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// 每個底色最多做到幾光（L 值） 模擬現實：黑髮唔漂做唔到淺色
const BASE_MAX_L = { 3: 34, 6: 52, 9: 80 };

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// 估計頭髮而家係幾多度底色
export function estimateBase(imageData, mask) {
  const { data } = imageData;
  let sum = 0, n = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] < 0.6) continue;
    const p = i * 4;
    sum += rgbToLab(data[p], data[p + 1], data[p + 2])[0];
    n++;
  }
  if (n < 50) return null;
  const L = sum / n;
  return L < 30 ? 3 : L < 48 ? 6 : 9;
}

// 將頭髮染成目標色 回傳新嘅 ImageData
// 做法似真染髮：保留原本髮絲明暗同反光 淺色會見到多啲層次 暗位同高光顏色會淡啲
export function recolour(imageData, mask, hex, baseLevel, chroma = 1) {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const o = out.data;
  const [tL, ta, tb] = rgbToLab(...hexToRgb(hex));
  const tC = Math.hypot(ta, tb);
  const hue = Math.atan2(tb, ta);

  const n = mask.data.length;
  const Ls = new Float32Array(n), As = new Float32Array(n), Bs = new Float32Array(n);
  let sum = 0, sum2 = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (mask.data[i] < 0.05) continue;
    const p = i * 4;
    const [L, A, B] = rgbToLab(data[p], data[p + 1], data[p + 2]);
    Ls[i] = L; As[i] = A; Bs[i] = B;
    if (mask.data[i] > 0.6) { sum += L; sum2 += L * L; cnt++; }
  }
  if (!cnt) return out;
  const meanL = sum / cnt;
  const sd = Math.sqrt(Math.max(1, sum2 / cnt - meanL * meanL));
  const goalL = Math.min(tL, BASE_MAX_L[baseLevel] ?? 80);
  // 染淺咗 髮絲層次會明顯啲；染深咗 層次會收埋啲
  const want = Math.max(5, Math.min(16, sd * (0.7 + goalL / 70)));
  const gain = Math.max(0.6, Math.min(2.4, want / sd));

  for (let i = 0; i < n; i++) {
    const alpha = smooth(0.06, 0.55, mask.data[i]);
    if (alpha <= 0) continue;
    const p = i * 4;
    const d = (Ls[i] - meanL) * gain;
    // 軟性壓頂 避免光位死白、暗位死黑
    let L = goalL + d;
    L = L > 88 ? 88 + (L - 88) * 0.3 : L < 6 ? 6 - (6 - L) * 0.3 : L;
    L = Math.max(2, Math.min(97, L));
    // 中間調最飽和 暗位同高光淡啲
    const rel = (L - goalL) / 25;
    const sat = chroma * Math.max(0.45, 1 - 0.35 * rel * rel) * Math.min(1.1, 0.5 + L / 40);
    // 高光帶少少暖 暗位少少冷 好似真頭髮
    const h = hue + Math.max(-0.12, Math.min(0.12, rel * 0.08));
    const C = tC * sat;
    const a = Math.cos(h) * C + As[i] * 0.08;
    const bb = Math.sin(h) * C + Bs[i] * 0.08;
    const [r, g, b] = labToRgb(L, a, bb);
    o[p] = data[p] + (r - data[p]) * alpha;
    o[p + 1] = data[p + 1] + (g - data[p + 1]) * alpha;
    o[p + 2] = data[p + 2] + (b - data[p + 2]) * alpha;
  }
  return out;
}

// ---------- 面型分析 ----------
const dist = (a, b, w, h) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);

export async function faceShape(canvas) {
  const lm = await landmarker();
  const res = lm.detect(canvas);
  const pts = res.faceLandmarks?.[0];
  if (!pts) return null;
  const { width: w, height: h } = canvas;
  const length = dist(pts[10], pts[152], w, h);
  const cheek = dist(pts[234], pts[454], w, h);
  const jaw = dist(pts[172], pts[397], w, h);
  const forehead = dist(pts[54], pts[284], w, h);
  const metrics = { ratio: length / cheek, jaw: jaw / cheek, forehead: forehead / cheek };
  return { shape: classify(metrics), metrics };
}

// 門檻係按 MediaPipe 嘅點位估 只作參考 用家可以自己改
export function classify({ ratio, jaw, forehead }) {
  if (ratio > 1.3) return 'long';
  if (forehead - jaw > 0.1) return 'heart';
  if (jaw > 0.86) return 'square';
  if (ratio < 1.08) return 'round';
  return 'oval';
}

// AI 真實染髮：淨係攞 AI 圖入面頭髮嗰部分 塊面 眼鏡 衫 背景全部用返原相
export function compositeHair(imageData, genImage, mask) {
  const { width: w, height: h } = imageData;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(genImage, 0, 0, w, h);
  const g = ctx.getImageData(0, 0, w, h).data;
  const out = new ImageData(new Uint8ClampedArray(imageData.data), w, h);
  const o = out.data, m = mask.data, n = w * h;
  // AI 有時會加咗曲或者改咗髮絲 所以只攞佢嘅顏色同大範圍光暗 髮絲紋理用返原相
  const ch = Array.from({ length: 6 }, () => new Float32Array(n));
  const wt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const lo = rgbToLab(o[j], o[j + 1], o[j + 2]);
    const lg = rgbToLab(g[j], g[j + 1], g[j + 2]);
    const mw = m[i];
    wt[i] = mw;
    for (let k = 0; k < 3; k++) { ch[k][i] = lo[k] * mw; ch[k + 3][i] = lg[k] * mw; }
  }
  const r = Math.max(2, Math.round(Math.min(w, h) / 50));
  const bw = boxBlur(wt, w, h, r);
  const bs = ch.map((x) => boxBlur(x, w, h, r));
  for (let i = 0; i < n; i++) {
    const a = smooth(0.08, 0.6, m[i]);
    if (!a || bw[i] < 1e-3) continue;
    const j = i * 4;
    const lo = rgbToLab(o[j], o[j + 1], o[j + 2]);
    const s = (k) => bs[k][i] / bw[i];
    const L = Math.max(0, Math.min(100, lo[0] + (s(3) - s(0))));
    const A = s(4) + 0.3 * (lo[1] - s(1));
    const B = s(5) + 0.3 * (lo[2] - s(2));
    const rgb = labToRgb(L, A, B);
    for (let k = 0; k < 3; k++) o[j + k] = o[j + k] * (1 - a) + rgb[k] * a;
  }
  return out;
}

// AI 效果圖：新舊頭髮範圍（再放大少少）用 AI 圖 其他（塊面 眼鏡 衫 背景）用返原相
// AI 如果將成張相重新構圖 就對唔齊 嗰陣直接用 AI 原圖
export async function compositeRestyle(origCanvas, genImage) {
  const w = origCanvas.width, h = origCanvas.height;
  const raw = document.createElement('canvas');
  raw.width = w; raw.height = h;
  raw.getContext('2d').drawImage(genImage, 0, 0, w, h);
  // 對位：用兩邊眼角計 AI 圖有冇放大 縮細 移位 或者打側 再校返正
  const lm = await landmarker();
  const pa = lm.detect(origCanvas).faceLandmarks?.[0];
  const pr = lm.detect(raw).faceLandmarks?.[0];
  if (!pa || !pr) return null;
  const P = (q, k) => [q[k].x * w, q[k].y * h];
  const [a1, a2, b1, b2] = [P(pa, 33), P(pa, 263), P(pr, 33), P(pr, 263)];
  const va = [a2[0] - a1[0], a2[1] - a1[1]], vb = [b2[0] - b1[0], b2[1] - b1[1]];
  const sc = Math.hypot(...va) / Math.hypot(...vb);
  const ang = Math.atan2(va[1], va[0]) - Math.atan2(vb[1], vb[0]);
  if (sc < 0.75 || sc > 1.35 || Math.abs(ang) > 0.25) return null;
  const gc = document.createElement('canvas');
  gc.width = w; gc.height = h;
  const gctx = gc.getContext('2d');
  gctx.drawImage(origCanvas, 0, 0);
  gctx.translate(a1[0], a1[1]);
  gctx.rotate(ang);
  gctx.scale(sc, sc);
  gctx.translate(-b1[0], -b1[1]);
  gctx.drawImage(raw, 0, 0);
  gctx.setTransform(1, 0, 0, 1, 0, 0);
  // 校正之後 鼻尖同下巴都要對得返 （打側太多就對唔到）
  const pb = lm.detect(gc).faceLandmarks?.[0];
  if (!pb) return null;
  const faceW = dist(pa[234], pa[454], w, h);
  const shift = Math.max(...[33, 263, 1, 152].map((k) => dist(pa[k], pb[k], w, h)));
  if (shift > faceW * 0.06) return null;
  const [ma, mb] = [await hairMask(origCanvas), await hairMask(gc)];
  const union = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) union[i] = Math.max(ma.data[i], mb.data[i]);
  const grown = boxBlur(union, w, h, Math.max(3, Math.round(Math.min(w, h) / 60)));
  const o = origCanvas.getContext('2d').getImageData(0, 0, w, h);
  const g = gctx.getImageData(0, 0, w, h);
  let diff = 0, cnt = 0;
  // 頭髮範圍外圍一圈 用嚟校正 AI 圖嘅膚色同光暗 避免舊頭髮位出現色差
  const off = [0, 0, 0];
  let ring = 0;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = smooth(0.03, 0.5, grown[i]);
    const j = i * 4;
    if (alpha[i] === 0 && i % 7 === 0) {
      diff += Math.abs(o.data[j] - g.data[j]) + Math.abs(o.data[j + 1] - g.data[j + 1]) + Math.abs(o.data[j + 2] - g.data[j + 2]);
      cnt++;
    }
    if (grown[i] > 0.005 && grown[i] < 0.06) {
      for (let k = 0; k < 3; k++) off[k] += o.data[j + k] - g.data[j + k];
      ring++;
    }
  }
  if (!cnt || diff / cnt / 3 > 20) return null;
  if (ring) for (let k = 0; k < 3; k++) off[k] = Math.max(-40, Math.min(40, off[k] / ring));
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i];
    if (!a) continue;
    // 新頭髮保持 AI 原色 其餘（皮膚 背景）校正色差
    const fix = 1 - smooth(0.2, 0.7, mb.data[i]);
    for (let k = 0; k < 3; k++) {
      const gv = g.data[i * 4 + k] + off[k] * fix;
      o.data[i * 4 + k] = o.data[i * 4 + k] * (1 - a) + gv * a;
    }
  }
  return o;
}
