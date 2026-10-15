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
  const data = Float32Array.from(m.getAsFloat32Array());
  const out = { data, width: m.width, height: m.height };
  masks.forEach((x) => x.close());
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
export function recolour(imageData, mask, hex, baseLevel, chroma = 1) {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const o = out.data;
  const [tL, ta, tb] = rgbToLab(...hexToRgb(hex));

  // 頭髮平均光暗 用嚟保留原本嘅紋理同光影
  let sum = 0, n = 0;
  const Ls = new Float32Array(mask.data.length);
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] < 0.15) continue;
    const p = i * 4;
    Ls[i] = rgbToLab(data[p], data[p + 1], data[p + 2])[0];
    if (mask.data[i] > 0.6) { sum += Ls[i]; n++; }
  }
  if (!n) return out;
  const meanL = sum / n;
  const goalL = Math.min(tL, BASE_MAX_L[baseLevel] ?? 80);

  for (let i = 0; i < mask.data.length; i++) {
    const alpha = smooth(0.15, 0.75, mask.data[i]);
    if (alpha <= 0) continue;
    const p = i * 4;
    const L = Math.max(2, Math.min(98, goalL + (Ls[i] - meanL) * 0.85));
    const k = chroma * Math.max(0.35, Math.min(1.25, L / Math.max(goalL, 1)));
    const [r, g, b] = labToRgb(L, ta * k, tb * k);
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
