import { SHOP, COLOURS, BASES, FACE_SHAPES, TEXTURES, MAINTENANCE, STYLES } from './data.js';
import { preload, hairMask, recolour, estimateBase, faceShape, compositeHair, compositeRestyle } from './ai.js';

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
  $('gen-colour-name').textContent = state.colour.name;
  setBook($('dye-book'), `你好 Fion 我想約染髮 想試「${state.colour.name}」（底色大約${state.base}度）`);
  if (!state.mask) return;
  // 底色唔夠淺嘅話 顏色會淡啲 似返現實
  const chroma = state.colour.lift > state.base ? 0.6 : 1;
  const out = recolour(state.original, state.mask, state.colour.hex, state.base, chroma);
  $('dye-after').getContext('2d').putImageData(out, 0, 0);
  scheduleDyeAI();
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
    dyeCache.clear();
    $('dye-ai').hidden = false;
    $('style-reuse').hidden = false;
    if (!gen.photo) $('gen-reuse').hidden = false;
    renderDye();
  } catch (e) {
    console.error(e);
    status(st, '出咗少少問題 請再試一次或者換張相。');
  }
}

$('dye-file').onchange = (e) => onDyeFile(e.target.files[0]);

// AI 真實染髮：即時預覽之後自動交畀 Gemini 重畫 結果直接放入前後對比
// 每隻色＋底色只畫一次（記住結果） 唔會撳一次色就收一次費
const dyeCache = new Map();
let dyeTimer = null, dyeToken = 0;
const dyeKey = () => `${state.colour.id}:${state.base}`;

function showDyeUrl(url) {
  const img = new Image();
  img.onload = () => $('dye-after').getContext('2d').drawImage(img, 0, 0, $('dye-after').width, $('dye-after').height);
  img.src = url;
}

function scheduleDyeAI() {
  clearTimeout(dyeTimer);
  if (!state.photo || !state.mask) return;
  const hit = dyeCache.get(dyeKey());
  if (hit) {
    showDyeUrl(hit);
    status($('dye-ai-status'), '✨ AI 真實染髮效果');
    return;
  }
  status($('dye-ai-status'), '⏳ 而家見到嘅係即時預覽 AI 正在幫你真實染緊 大約 10 至 30 秒…');
  dyeTimer = setTimeout(() => runDyeAI(), 900);
}

async function runDyeAI(force = false) {
  if (!state.photo || !state.mask) return;
  const key = dyeKey();
  if (!force && dyeCache.has(key)) return showDyeUrl(dyeCache.get(key));
  const token = ++dyeToken;
  const st = $('dye-ai-status');
  const colour = state.colour;
  $('dye-ai').disabled = true;
  status(st, `⏳ 而家見到嘅係即時預覽 AI 正在幫你真實染「${colour.name}」 大約 10 至 30 秒…`);
  try {
    const res = await fetch('api/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'dye', image: state.photo.toDataURL('image/jpeg', 0.9), colourId: colour.id, base: state.base }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* 靜態網站冇伺服器 */ }
    if (token !== dyeToken) return;
    if (!res.ok || !data.image) {
      status(st, data.error || 'AI 真實染髮暫時未開放 而家顯示嘅係即時預覽。');
      return;
    }
    // 只用 AI 嘅髮色同光暗 塊面 眼鏡 髮絲用返原相
    const img = new Image();
    img.src = data.image;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = state.original.width; c.height = state.original.height;
    c.getContext('2d').putImageData(compositeHair(state.original, img, state.mask), 0, 0);
    const url = c.toDataURL('image/jpeg', 0.92);
    dyeCache.set(key, url);
    if (token !== dyeToken || dyeKey() !== key) return;
    showDyeUrl(url);
    status(st, '✨ AI 真實染髮效果 拉中間條線可以對比染前染後');
  } catch (e) {
    console.error(e);
    if (token === dyeToken) status(st, '網絡有問題 而家顯示嘅係即時預覽 可以撳下面再試。');
  } finally {
    if (token === dyeToken) $('dye-ai').disabled = false;
  }
}

$('dye-ai').onclick = () => runDyeAI(true);

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

// ---------- AI 髮型速配 ----------
const answers = { faceShape: null, texture: null, maintenance: null };

// 女士 / 男士 髮型切換（02 03 熱門髮型三度共用）
let gender = 'women';
const styleGender = (x) => x.gender || 'women';
const shownStyles = () => STYLES.filter((x) => styleGender(x) === gender);
document.querySelectorAll('[data-gender-toggle]').forEach((box) => {
  [['women', '女士髮型'], ['men', '男士髮型']].forEach(([g, label]) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.g = g;
    b.textContent = label;
    b.onclick = () => setGender(g);
    box.append(b);
  });
});
function setGender(g) {
  gender = g;
  document.querySelectorAll('[data-gender-toggle]').forEach((box) => pressed(box, (b) => b.dataset.g === g));
  document.querySelectorAll('#gen-styles .chip').forEach((b) => {
    b.hidden = styleGender(STYLES.find((x) => x.id === b.dataset.id)) !== g;
  });
  if (gen.styleId && styleGender(STYLES.find((x) => x.id === gen.styleId)) !== g) {
    gen.styleId = null;
    pressed($('gen-styles'), () => false);
    updateGen();
  }
  renderTrends();
  if (answers.faceShape && answers.texture && answers.maintenance) showMatch();
}

function igLink() {
  return SHOP.instagram ? `https://www.instagram.com/${SHOP.instagram}/` : null;
}

function buildOptions(container, items, key) {
  Object.entries(items).forEach(([value, x]) => {
    const b = document.createElement('button');
    b.className = 'option';
    b.dataset.value = value;
    b.innerHTML = `<strong>${x.name}</strong><small>${x.desc}</small>`;
    b.onclick = () => choose(key, value);
    container.append(b);
  });
}

const optFace = $('opt-face'), optTexture = $('opt-texture'), optMaint = $('opt-maint');
buildOptions(optFace, FACE_SHAPES, 'faceShape');
buildOptions(optTexture, TEXTURES, 'texture');
buildOptions(optMaint, MAINTENANCE, 'maintenance');

function choose(key, value) {
  answers[key] = value;
  pressed(optFace, (b) => b.dataset.value === answers.faceShape);
  pressed(optTexture, (b) => b.dataset.value === answers.texture);
  pressed(optMaint, (b) => b.dataset.value === answers.maintenance);
  if (answers.faceShape && answers.texture && answers.maintenance) showMatch();
}

// 配對方法同舊網站一樣：面型 3 分 髮質 2 分 打理習慣 2 分
function match({ faceShape, texture, maintenance }) {
  const scored = shownStyles().map((d) => {
    let f = 0;
    if (d.bestFor.includes(faceShape)) f += 3;
    if (d.bestTexture.includes(texture)) f += 2;
    else if (texture === 'wavy' || d.bestTexture.includes('wavy')) f += 1;
    if (d.maintenance === maintenance) f += 2;
    else if ((d.maintenance === 'medium' && maintenance !== 'low') || (maintenance === 'medium' && d.maintenance !== 'high')) f += 1;
    return { style: d, score: f };
  });
  scored.sort((x, y) => y.score - x.score);
  return { primary: scored[0].style, alternatives: scored.slice(1, 3).map((x) => x.style) };
}

function showMatch() {
  const { primary, alternatives } = match(answers);
  const face = FACE_SHAPES[answers.faceShape];
  $('res-name').textContent = primary.name;
  $('res-tagline').textContent = primary.tagline;
  $('res-desc').textContent = primary.description;
  $('res-reason').textContent = `根據你嘅${face.name}（${face.desc}）、${TEXTURES[answers.texture].name}髮質 同埋${MAINTENANCE[answers.maintenance].name}嘅習慣 呢款最能夾到你嘅比例同生活方式。`;
  $('res-alts').innerHTML = alternatives.map((x) => `<li><strong>${x.name}</strong> <span>${x.tagline}</span></li>`).join('');
  setBook($('style-book'), `你好 Fion 我係${face.name} 想約剪「${primary.name}」`);
  const ig = igLink();
  $('style-dm').hidden = !ig;
  if (ig) $('style-dm').href = ig;
  $('style-ai').onclick = (e) => { e.preventDefault(); openPreview(primary.id); };
  const wasHidden = $('style-result').hidden;
  $('style-result').hidden = false;
  if (wasHidden) $('style-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function analyseFace(photo) {
  const st = $('style-status');
  try {
    status(st, '⏳ AI 量緊你個面型…');
    const r = await faceShape(photo);
    if (!r) {
      status(st, '搵唔到塊面 😅 試吓正面望鏡頭再影過 或者喺下面自己揀。');
      return;
    }
    choose('faceShape', r.shape);
    const left = [!answers.texture && '髮質', !answers.maintenance && '打理習慣'].filter(Boolean);
    status(st, left.length
      ? `✅ AI 估你係「${FACE_SHAPES[r.shape].name}」 再揀埋下面嘅${left.join('同')}就即刻出結果 👇`
      : `✅ AI 估你係「${FACE_SHAPES[r.shape].name}」 唔啱可以喺下面改。`);
    if (left.length) $(answers.texture ? 'opt-maint' : 'opt-texture').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    console.error(e);
    status(st, '出咗少少問題 請再試一次或者喺下面自己揀。');
  }
}

$('style-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (file) analyseFace(await loadPhoto(file));
};
$('style-reuse').onclick = () => state.photo && analyseFace(state.photo);

// ---------- AI 換髮型效果圖 ----------
const gen = { photo: null, styleId: null };

function setGenPhoto(photo) {
  gen.photo = photo;
  const c = $('gen-src');
  c.width = photo.width; c.height = photo.height;
  c.getContext('2d').drawImage(photo, 0, 0);
  $('gen-drop').hidden = true;
  $('gen-reuse').hidden = true;
  $('gen-photo').hidden = false;
  updateGen();
}

function pickGenStyle(id) {
  gen.styleId = id;
  pressed($('gen-styles'), (b) => b.dataset.id === id);
  updateGen();
}

function updateGen() {
  $('gen-go').disabled = !(gen.photo && gen.styleId);
  $('gen-colour-name').textContent = state.colour.name;
}

STYLES.forEach((x) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.id = x.id;
  b.textContent = x.name;
  b.onclick = () => pickGenStyle(x.id);
  $('gen-styles').append(b);
});

$('gen-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (file) setGenPhoto(await loadPhoto(file));
};
$('gen-change').onclick = () => $('gen-file').click();
$('gen-reuse').onclick = () => state.photo && setGenPhoto(state.photo);

// 由其他區跳過嚟：帶埋髮型同相
function openPreview(styleId) {
  const st = STYLES.find((x) => x.id === styleId);
  if (st && styleGender(st) !== gender) setGender(styleGender(st));
  if (styleId) pickGenStyle(styleId);
  if (!gen.photo && state.photo) setGenPhoto(state.photo);
  $('preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('gen-go').onclick = async () => {
  const st = $('gen-status');
  const style = STYLES.find((x) => x.id === gen.styleId);
  $('gen-go').disabled = true;
  $('gen-result').hidden = true;
  status(st, `⏳ AI 正在為你生成「${style.name}」效果圖 大約要 10 至 30 秒…`);
  try {
    // 相片四邊加啲模糊留白 AI 就唔會為咗「放得落新髮型」而拉遠鏡頭 收到之後再裁返
    const pad = Math.round(Math.max(gen.photo.width, gen.photo.height) * 0.15);
    const padded = document.createElement('canvas');
    padded.width = gen.photo.width + pad * 2; padded.height = gen.photo.height + pad * 2;
    const pctx = padded.getContext('2d');
    pctx.filter = 'blur(24px)';
    pctx.drawImage(gen.photo, 0, 0, padded.width, padded.height);
    pctx.filter = 'none';
    pctx.drawImage(gen.photo, pad, pad);
    const unpad = (img) => {
      const c = document.createElement('canvas');
      c.width = gen.photo.width; c.height = gen.photo.height;
      const kx = img.naturalWidth / padded.width, ky = img.naturalHeight / padded.height;
      c.getContext('2d').drawImage(img, pad * kx, pad * ky, gen.photo.width * kx, gen.photo.height * ky, 0, 0, c.width, c.height);
      return c;
    };
    // AI 有時會成張相重新構圖（郁咗個人） 對唔齊就自動再試 最多三次
    let url = null;
    for (let attempt = 1; attempt <= 3 && !url; attempt++) {
      if (attempt > 1) status(st, `⏳ AI 張圖郁咗你個樣 自動再畫一次（第 ${attempt} 次）…`);
      const res = await fetch('api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image: padded.toDataURL('image/jpeg', 0.9),
          styleId: gen.styleId,
          colourId: $('gen-colour').checked ? state.colour.id : null,
        }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* 靜態網站冇伺服器 */ }
      if (!res.ok || !data.image) {
        status(st, data.error || 'AI 效果圖暫時未開放 可以先試 AI 染髮同髮型速配。');
        return;
      }
      // 塊面 眼鏡 衫 背景用返原相 淨係換頭髮
      try {
        const img = new Image();
        img.src = data.image;
        await img.decode();
        const cropped = unpad(img);
        // 最後一次放寬少少 盡量用返客人自己塊面
        const mixed = await compositeRestyle(gen.photo, cropped, attempt === 3 ? 0.1 : 0.06);
        if (mixed) {
          const c = document.createElement('canvas');
          c.width = mixed.width; c.height = mixed.height;
          c.getContext('2d').putImageData(mixed, 0, 0);
          url = c.toDataURL('image/jpeg', 0.92);
        }
      } catch (e) { console.error(e); }
      if (!url && attempt === 3) {
        const img = new Image();
        img.src = data.image;
        await img.decode();
        url = unpad(img).toDataURL('image/jpeg', 0.92);
      }
    }
    $('gen-img').src = url;
    $('gen-save').href = url;
    setBook($('gen-book'), `你好 Fion 我試咗 AI 效果圖 想約剪「${style.name}」`);
    $('gen-result').hidden = false;
    status(st, '');
    $('gen-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    console.error(e);
    status(st, '網絡有問題 請再試一次。');
  } finally {
    updateGen();
  }
};

// ---------- 熱門髮型 ----------
function renderTrends() {
$('trend-cards').innerHTML = shownStyles().map((x) => {
  const wa = waLink(`你好 Fion 我想約剪「${x.name}」`);
  return `<article class="card">
    <h3>${x.name}</h3>
    <p class="tagline">${x.tagline}</p>
    <p>${x.description}</p>
    <div class="card-links">
      <button class="card-link" data-try="${x.id}">✨ AI 試呢款</button>
      ${wa ? `<a class="card-link" href="${wa}" target="_blank" rel="noopener">約 Fion 剪呢款 →</a>` : ''}
    </div>
  </article>`;
}).join('');
}
$('trend-cards').onclick = (e) => {
  const id = e.target.closest('[data-try]')?.dataset.try;
  if (id) openPreview(id);
};
setGender('women');

// ---------- 預約 / 其他 ----------
setBook($('book-main'), '你好 Fion 我想預約');
if (SHOP.instagram) {
  $('ig-link').href = igLink();
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
