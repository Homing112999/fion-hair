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

// 臉型輪廓 + 眼 鼻 口 嘅特徵點（MediaPipe face mesh 編號）
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const INNER = [33, 133, 362, 263, 1, 61, 291, 168, 6, 199, 105, 334];
// 眉毛以下嘅塊面（換髮型唔准郁）：右邊輪廓落到下巴再上返左邊 然後沿眉毛返嚟
// 眼以下嘅塊面（鼻 口 面頰 下巴）：沿下眼皮同鼻樑過
const LOWER_FACE = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 263, 249, 390, 373, 374, 380, 381, 382, 362, 168, 133, 155, 154, 153, 145, 144, 163, 7, 33];
const EYES = [
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
];
const FACE_CORE = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 300, 293, 334, 296, 336, 107, 66, 105, 63, 70];

// Delaunay 三角剖分（Bowyer–Watson） 回傳三角形嘅頂點編號
function delaunay(pts) {
  const n = pts.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const d = Math.max(maxX - minX, maxY - minY) * 20;
  const all = [...pts, [minX - d, minY - d], [minX + d * 2, minY - d], [minX - d, minY + d * 2]];
  const circ = (t) => {
    const [ax, ay] = all[t[0]], [bx, by] = all[t[1]], [cx, cy] = all[t[2]];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return { t, ux, uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [circ([n, n + 1, n + 2])];
  for (let i = 0; i < n; i++) {
    const [px, py] = all[i];
    const bad = [], keep = [];
    for (const c of tris) ((px - c.ux) ** 2 + (py - c.uy) ** 2 < c.r2 ? bad : keep).push(c);
    const edges = new Map();
    for (const { t } of bad) {
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(k, edges.has(k) ? null : [a, b]);
      }
    }
    for (const e of edges.values()) if (e) keep.push(circ([e[0], e[1], i]));
    tris = keep;
  }
  return tris.map((c) => c.t).filter((t) => t.every((k) => k < n));
}

// 逐個三角形將 img 由 src 點拉去 dst 點（畫落 ctx）
function warpTris(img, src, dst, ctx) {
  for (const t of delaunay(dst)) {
    const [[u0, v0], [u1, v1], [u2, v2]] = t.map((k) => dst[k]);
    const [[x0, y0], [x1, y1], [x2, y2]] = t.map((k) => src[k]);
    const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(den) < 1e-6) continue;
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den;
    const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den;
    const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den;
    const d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
    // 三角形放大一點點 避免接駁位出白線
    const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3;
    const grow = ([u, v]) => { const l = Math.hypot(u - mx, v - my) || 1; return [u + (u - mx) / l, v + (v - my) / l]; };
    ctx.save();
    ctx.beginPath();
    [[u0, v0], [u1, v1], [u2, v2]].map(grow).forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d, u0 - a * x0 - c * y0, v0 - b * x0 - d * y0);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

// AI 打側咗個頭：用 AI 圖做底（新髮型 頭型 背景都啱晒） 再將客人自己嘅眼 鼻 口
// 按 AI 塊面嘅角度逐點貼返上去 顏色光暗跟返 AI 圖 咁就唔會有雙重頭髮或者鬼影
async function swapFace(origCanvas, raw, pa, pr, w, h) {
  const P = (q, k) => [q[k].x * w, q[k].y * h];
  const keys = [...new Set([...FACE_CORE, ...INNER, 168, 6, 4, 0, 17, 13, 14, 159, 145, 386, 374])];
  const fc = document.createElement('canvas');
  fc.width = w; fc.height = h;
  const fctx = fc.getContext('2d');
  fctx.drawImage(raw, 0, 0);
  warpTris(origCanvas, keys.map((k) => P(pa, k)), keys.map((k) => P(pr, k)), fctx);
  // 原相嘅頭髮遮罩都拉去 AI 塊面位置 （幼髮絲 分割模型未必捉到 所以再放闊）
  const ma = await hairMask(origCanvas);
  const mc = document.createElement('canvas');
  mc.width = w; mc.height = h;
  const mctx = mc.getContext('2d');
  const md = mctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = Math.round(ma.data[i] * 255); md.data.set([v, v, v, 255], i * 4); }
  mctx.putImageData(md, 0, 0);
  const mw = document.createElement('canvas');
  mw.width = w; mw.height = h;
  const mwctx = mw.getContext('2d');
  mwctx.fillStyle = '#000';
  mwctx.fillRect(0, 0, w, h);
  warpTris(mc, keys.map((k) => P(pa, k)), keys.map((k) => P(pr, k)), mwctx);
  const mwd = mwctx.getImageData(0, 0, w, h).data;
  const hm = await hairMask(fc);
  const hair0 = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hair0[i] = Math.max(mwd[i * 4] / 255, hm.data[i]);
  const hair = boxBlur(hair0, w, h, Math.max(3, Math.round(Math.min(w, h) / 50)));
  // 鼻 口 面頰 下巴一定用客人自己；眼睛冇瀏海遮先貼 有遮就用 AI 畫嘅眼
  const lower = faceCoreMask(pr, w, h, LOWER_FACE, 0.92);
  const parts = [lower];
  for (const eye of EYES) {
    const em = faceCoreMask(pr, w, h, eye, 1.6);
    let s1 = 0, s0 = 0;
    for (let i = 0; i < w * h; i++) if (em[i] > 0.5) { s1 += hair[i]; s0++; }
    if (s0 && s1 / s0 < 0.04) parts.push(em);
  }
  const m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let v = 0;
    for (const q of parts) v = Math.max(v, q[i]);
    m[i] = smooth(0.3, 0.9, v) * (1 - smooth(0.04, 0.25, hair[i]));
  }
  const o = raw.getContext('2d').getImageData(0, 0, w, h);
  const f = fctx.getImageData(0, 0, w, h);
  // 低頻色差：貼上去嘅塊面跟返 AI 圖附近嘅膚色同光暗 接口唔會見到
  const R = Math.max(4, Math.round(Math.min(w, h) / 25));
  const blur2 = (a) => boxBlur(boxBlur(a, w, h, R), w, h, R);
  const mb = blur2(m);
  const ch = [0, 1, 2].map((k) => {
    const ga = new Float32Array(w * h), fa = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { ga[i] = o.data[i * 4 + k] * m[i]; fa[i] = f.data[i * 4 + k] * m[i]; }
    return [blur2(ga), blur2(fa)];
  });
  for (let i = 0; i < w * h; i++) {
    const a = m[i];
    if (!a) continue;
    for (let k = 0; k < 3; k++) {
      const d = mb[i] > 1e-4 ? Math.max(-50, Math.min(50, (ch[k][0][i] - ch[k][1][i]) / mb[i])) : 0;
      const fv = f.data[i * 4 + k] + d;
      o.data[i * 4 + k] = o.data[i * 4 + k] * (1 - a) + fv * a;
    }
  }
  return o;
}

// 原相塊面（眉毛以下）嘅遮罩 0 至 1
function faceCoreMask(pa, w, h, poly = FACE_CORE, scale = 0.9) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  let mx = 0, my = 0;
  for (const k of poly) { mx += pa[k].x * w; my += pa[k].y * h; }
  mx /= poly.length; my /= poly.length;
  ctx.beginPath();
  poly.forEach((k, i) => {
    // 縮入少少 留返位畀鬢角同兩邊頭髮
    const x = mx + (pa[k].x * w - mx) * scale, y = my + (pa[k].y * h - my) * scale;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] / 255;
  return boxBlur(m, w, h, Math.max(2, Math.round(Math.min(w, h) / 70)));
}

// AI 效果圖：新舊頭髮範圍（再放大少少）用 AI 圖 其他（塊面 眼鏡 衫 背景）用返原相
// 先試簡單對位（放大 縮細 轉角度）； warp = true 時 AI 打側咗個頭就用 AI 圖做底 貼返客人塊面
export async function compositeRestyle(origCanvas, genImage, { warp = false } = {}) {
  const w = origCanvas.width, h = origCanvas.height;
  const raw = document.createElement('canvas');
  raw.width = w; raw.height = h;
  raw.getContext('2d').drawImage(genImage, 0, 0, w, h);
  const lm = await landmarker();
  const pa = lm.detect(origCanvas).faceLandmarks?.[0];
  const pr = lm.detect(raw).faceLandmarks?.[0];
  if (!pa || !pr) return null;
  const P = (q, k) => [q[k].x * w, q[k].y * h];
  const [a1, a2, b1, b2] = [P(pa, 33), P(pa, 263), P(pr, 33), P(pr, 263)];
  const va = [a2[0] - a1[0], a2[1] - a1[1]], vb = [b2[0] - b1[0], b2[1] - b1[1]];
  const sc = Math.hypot(...va) / Math.hypot(...vb);
  const ang = Math.atan2(va[1], va[0]) - Math.atan2(vb[1], vb[0]);
  const gc = document.createElement('canvas');
  gc.width = w; gc.height = h;
  const gctx = gc.getContext('2d');
  gctx.drawImage(origCanvas, 0, 0);
  let aligned = false;
  if (sc >= 0.75 && sc <= 1.35 && Math.abs(ang) <= 0.25) {
    gctx.translate(a1[0], a1[1]);
    gctx.rotate(ang);
    gctx.scale(sc, sc);
    gctx.translate(-b1[0], -b1[1]);
    gctx.drawImage(raw, 0, 0);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    // 校正之後 鼻尖同下巴都要對得返 （打側太多就對唔到）
    const pb = lm.detect(gc).faceLandmarks?.[0];
    const faceW = dist(pa[234], pa[454], w, h);
    aligned = !!pb && Math.max(...[33, 263, 1, 152].map((k) => dist(pa[k], pb[k], w, h))) <= faceW * 0.06;
  }
  if (!aligned) {
    if (!warp || sc < 0.5 || sc > 2 || Math.abs(ang) > 0.6) return null;
    return swapFace(origCanvas, raw, pa, pr, w, h);
  }
  const [ma, mb] = [await hairMask(origCanvas), await hairMask(gc)];
  const union = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) union[i] = Math.max(ma.data[i], mb.data[i]);
  const gr = Math.max(3, Math.round(Math.min(w, h) / 60));
  const grown = boxBlur(union, w, h, gr);
  // 舊頭髮（例如蔭）要剪走嘅位 再闊少少 唔好留低髮尾邊
  const oldHair = boxBlur(ma.data, w, h, gr * 2);
  const core = faceCoreMask(pa, w, h);
  const o = origCanvas.getContext('2d').getImageData(0, 0, w, h);
  const g = gctx.getImageData(0, 0, w, h);
  let diff = 0, cnt = 0;
  const alpha = new Float32Array(w * h);
  // 局部色差：喺 AI 圖同原相都唔係頭髮嘅位（主要係塊面皮膚）量度色差 再向外擴散
  // 咁新露出嚟嘅額頭 鬢角就會跟返客人自己嘅膚色同光暗
  const wt = new Float32Array(w * h);
  const dch = [0, 1, 2].map(() => new Float32Array(w * h));
  for (let i = 0; i < w * h; i++) {
    alpha[i] = Math.max(smooth(0.03, 0.5, grown[i]), smooth(0.02, 0.25, oldHair[i]));
    const j = i * 4;
    if (alpha[i] === 0 && i % 7 === 0) {
      diff += Math.abs(o.data[j] - g.data[j]) + Math.abs(o.data[j + 1] - g.data[j + 1]) + Math.abs(o.data[j + 2] - g.data[j + 2]);
      cnt++;
    }
    if (alpha[i] < 0.01) {
      wt[i] = 0.05 + core[i];
      for (let k = 0; k < 3; k++) dch[k][i] = (o.data[j + k] - g.data[j + k]) * wt[i];
    }
  }
  if (!cnt || diff / cnt / 3 > 20) return null;
  const R = Math.max(4, Math.round(Math.min(w, h) / 10));
  const blur2 = (a) => boxBlur(boxBlur(a, w, h, R), w, h, R);
  const wb = blur2(wt);
  const off = dch.map(blur2);
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i];
    if (!a) continue;
    // 新頭髮保持 AI 原色 其餘（皮膚 背景）校正色差
    const fix = 1 - smooth(0.2, 0.7, mb.data[i]);
    for (let k = 0; k < 3; k++) {
      const d = wb[i] > 1e-4 ? Math.max(-60, Math.min(60, off[k][i] / wb[i])) : 0;
      const gv = g.data[i * 4 + k] + d * fix;
      o.data[i * 4 + k] = o.data[i * 4 + k] * (1 - a) + gv * a;
    }
  }
  return o;
}
