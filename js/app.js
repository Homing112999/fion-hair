import { SHOP, COLOURS, BASES, FACE_SHAPES } from './data.js';
import { preload, hairMask, recolour, estimateBase, faceShape } from './ai.js';

const $ = (id) => document.getElementById(id);
const MAX_SIDE = 1024;

const state = {
  colour: COLOURS[0],
  base: 3,
  photo: null, // 縮細咗嘅相（canvas）
  mask: null,
  original: null, // ImageData
  shape: null,
};

// ---------- 共用 ----------
function waLink(text) {
  if (!SHOP.whatsapp) return null;
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;
}

function setBook(el, text) {
  const href = waLink(text);
  el.hidden = !href;
  if (href) el.href = href;
}

function status(el, text) {
  el.hidden = !text;
  el.textContent = text || '';
}

async function loadPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

function pressed(container, match) {
  container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(match(b))));
}

// ---------- AI 染髮 ----------
const swatches = $('swatches');
COLOURS.forEach((c) => {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.dataset.id = c.id;
  b.innerHTML = `<i style="background:${c.hex}"></i>${c.name}`;
  b.onclick = () => { state.colour = c; renderDye(); };
  swatches.append(b);
});

const bases = $('bases');
BASES.forEach((x) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.level = x.level;
  b.innerHTML = `${x.name}<small>${x.note}</small>`;
  b.onclick = () => { state.base = x.level; $('base-hint').textContent = '已改為你揀嘅底色。'; renderDye(); };
  bases.append(b);
});

function colourNote() {
  const c = state.colour;
  let html = `<b>${c.name}</b> ${c.note}`;
  if (c.lift > state.base) {
    html += `<br>⚠️ ${state.base}度底色直接染做唔到咁淺 要先褪色或者漂 效果圖已經按你底色模擬。`;
  }
  $('colour-note').innerHTML = html;
}

function renderDye() {
  pressed(swatches, (b) => b.dataset.id === state.colour.id);
  pressed(bases, (b) => Number(b.dataset.level) === state.base);
  colourNote();
  setBook($('dye-book'), `你好 Fion 我想約染髮 想試「${state.colour.name}」（底色大約${state.base}度）`);
  if (!state.mask) return;
  // 底色唔夠淺嘅話 顏色會淡啲 似返現實
  const chroma = state.colour.lift > state.base ? 0.6 : 1;
  const out = recolour(state.original, state.mask, state.colour.hex, state.base, chroma);
  $('dye-after').getContext('2d').putImageData(out, 0, 0);
}

async function onDyeFile(file) {
  if (!file) return;
  const st = $('dye-status');
  try {
    status(st, '⏳ AI 認緊你啲頭髮…');
    const photo = await loadPhoto(file);
    state.photo = photo;
    const { width: w, height: h } = photo;
    for (const id of ['dye-before', 'dye-after']) {
      const c = $(id);
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(photo, 0, 0);
    }
    state.original = photo.getContext('2d').getImageData(0, 0, w, h);
    $('dye-drop').hidden = true;
    $('dye-compare').hidden = false;
    state.mask = await hairMask(photo);
    const guess = estimateBase(state.original, state.mask);
    if (guess === null) {
      status(st, '搵唔到頭髮 😅 試吓換張正面 光啲 見到頭髮嘅相。');
      state.mask = null;
    } else {
      state.base = guess;
      $('base-hint').textContent = `AI 估你而家大約係 ${guess}度底色 唔啱可以自己改。`;
      status(st, '');
    }
    $('dye-change').hidden = false;
    $('dye-save').hidden = !state.mask;
    $('style-reuse').hidden = false;
    renderDye();
  } catch (e) {
    console.error(e);
    status(st, '出咗少少問題 請再試一次或者換張相。');
  }
}

$('dye-file').onchange = (e) => onDyeFile(e.target.files[0]);
$('dye-change').onclick = () => $('dye-file').click();
$('dye-slider').oninput = (e) => {
  const v = e.target.value;
  $('dye-after-wrap').style.clipPath = `inset(0 0 0 ${v}%)`;
  $('dye-compare').style.setProperty('--pos', `${v}%`);
};
$('dye-save').onclick = () => {
  $('dye-after').toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fion-${state.colour.name}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/jpeg', 0.9);
};

// ---------- AI 髮型 ----------
const shapeChips = $('shape-chips');
Object.entries(FACE_SHAPES).forEach(([key, s]) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.shape = key;
  b.textContent = s.name;
  b.onclick = () => showShape(key);
  shapeChips.append(b);
});

function showShape(key) {
  state.shape = key;
  const s = FACE_SHAPES[key];
  $('shape-name').textContent = s.name;
  $('shape-intro').textContent = s.intro;
  $('shape-styles').innerHTML = s.styles.map((x) => `<li><strong>${x.name}</strong><span>${x.why}</span></li>`).join('');
  pressed(shapeChips, (b) => b.dataset.shape === key);
  setBook($('style-book'), `你好 Fion 我係${s.name} 想約剪髮 參考：${s.styles[0].name}`);
  $('style-result').hidden = false;
}

async function analyseFace(photo) {
  const st = $('style-status');
  try {
    status(st, '⏳ AI 量緊你個面型…');
    const r = await faceShape(photo);
    if (!r) {
      status(st, '搵唔到塊面 😅 試吓正面望鏡頭再影過 或者答下面 3 條問題。');
      return;
    }
    status(st, '');
    showShape(r.shape);
    $('style-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    status(st, '出咗少少問題 請再試一次或者答下面 3 條問題。');
  }
}

$('style-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (file) analyseFace(await loadPhoto(file));
};
$('style-reuse').onclick = () => state.photo && analyseFace(state.photo);

$('quiz-form').onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const q1 = f.get('q1'), q2 = f.get('q2'), q3 = f.get('q3');
  if (!q1 || !q2 || !q3) { alert('三條都要答呀'); return; }
  let key = 'oval';
  if (q1 === 'long') key = 'long';
  else if (q3 === 'forehead' && q2 === 'pointed') key = 'heart';
  else if (q2 === 'square' || q3 === 'jaw') key = 'square';
  else if (q1 === 'wide' || q2 === 'round') key = 'round';
  showShape(key);
};

// ---------- 預約 / 其他 ----------
setBook($('book-main'), '你好 Fion 我想預約');
if (SHOP.instagram) {
  $('ig-link').href = `https://instagram.com/${SHOP.instagram}`;
  $('ig-link').hidden = false;
}
if (SHOP.address) {
  $('addr').textContent = `📍 ${SHOP.address}`;
  $('addr').hidden = false;
}
$('year').textContent = new Date().getFullYear();

renderDye();

// 用家捲到工具位置先載入 AI 模型 慳流量
const io = new IntersectionObserver((entries) => {
  if (entries.some((x) => x.isIntersecting)) { preload(); io.disconnect(); }
}, { rootMargin: '200px' });
io.observe($('dye'));
io.observe($('style'));
