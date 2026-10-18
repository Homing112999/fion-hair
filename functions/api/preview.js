// Cloudflare Pages Function：AI 換髮型效果圖
// 要喺 Cloudflare 設定 GEMINI_API_KEY（Secret）先用得
// 可選：GEMINI_MODEL（預設 gemini-2.5-flash-image）
// 可選：KV 綁定 LIMITS，每個 IP 每日最多 DAILY_LIMIT 張（預設 8）
import { STYLES, COLOURS } from '../../js/data.js';

const MAX_BYTES = 4 * 1024 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function buildPrompt(style, colour) {
  const hair = colour
    ? `${style.genPrompt}, with the hair coloured ${colour.hex} (a ${colour.id.replace(/-/g, ' ')} shade)`
    : `${style.genPrompt}, keeping the person's current hair colour`;
  return [
    'Edit this photo. Change ONLY the hairstyle of the person to:',
    hair + '.',
    'Keep the face, identity, facial features, skin tone, expression, makeup, clothing, background, lighting and camera angle exactly the same.',
    'The result must look like a real photo taken right after a professional salon visit. No text, no watermark.',
  ].join(' ');
}

// AI 真實染髮：淨係換髮色 其他一律唔郁
export function buildDyePrompt(colour, base) {
  const dark = colour.lift > (Number(base) || 3);
  return [
    'Edit this photo. Recolour ONLY the hair of the person, as if a professional colourist in a Hong Kong salon just dyed it',
    `to "${colour.id.replace(/-/g, ' ')}" (${colour.note}), target shade close to ${colour.hex}.`,
    dark
      ? 'The natural hair is dark and was not bleached, so the new colour should read subtly: richer and tinted in the light, deeper in the shadows, like real dye on dark Asian hair.'
      : 'Make the colour clearly visible but natural.',
    'This is a colour-only edit: only recolour the existing hair pixels. Do NOT change the haircut, length, parting, curl, waves or volume. Keep natural strand-level variation, shine, highlights and shadows, slightly deeper tone near the roots, and soft edges where hair meets skin and background.',
    'Do NOT alter anything else: same face shape, identity, skin, eyebrows, makeup, glasses, jewellery, clothing, other people, background, lighting, framing and camera angle. No beautifying, no slimming. Output the same image size and composition. Photorealistic. No text, no watermark.',
  ].join(' ');
}

async function overLimit(env, request) {
  if (!env.LIMITS) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${new Date().toISOString().slice(0, 10)}:${ip}`;
  const used = Number(await env.LIMITS.get(key)) || 0;
  if (used >= Number(env.DAILY_LIMIT || 8)) return true;
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return false;
}

export async function onRequestPost({ request, env, fetchGemini = fetch }) {
  if (!env.GEMINI_API_KEY) return json({ error: 'AI 效果圖暫時未開放' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '資料格式唔啱' }, 400);
  }

  const dye = body.mode === 'dye';
  const style = dye ? null : STYLES.find((s) => s.id === body.styleId);
  if (!dye && !style) return json({ error: '搵唔到呢款髮型' }, 400);
  const colour = body.colourId ? COLOURS.find((c) => c.id === body.colourId) : null;
  if (dye && !colour) return json({ error: '搵唔到呢隻髮色' }, 400);

  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.image || '');
  if (!m) return json({ error: '請上載 JPG 或 PNG 相片' }, 400);
  if (m[2].length * 0.75 > MAX_BYTES) return json({ error: '相片太大 請換細啲嘅相' }, 413);

  if (await overLimit(env, request)) return json({ error: '今日試咗好多次喇 聽日再嚟試 或者直接 WhatsApp Fion' }, 429);

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash-image';
  const res = await fetchGemini(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: dye ? buildDyePrompt(colour, body.base) : buildPrompt(style, colour) }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(dye ? { temperature: 0.2 } : {}) },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    console.log('gemini error', res.status, detail);
    return json({ error: geminiError(res.status, detail) }, 502);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const img = parts.map((p) => p.inlineData || p.inline_data).find(Boolean);
  if (!img) {
    console.log('gemini no image', JSON.stringify(data).slice(0, 500));
    return json({ error: '呢張相 AI 畫唔到 試吓換張正面清楚啲嘅相' }, 422);
  }
  return json({ image: `data:${img.mimeType || img.mime_type || 'image/png'};base64,${img.data}` });
}

// 將 Google 嘅錯誤講返做人話 方便搵原因（後面個編號係 Google 回覆嘅狀態碼）
function geminiError(status, detail) {
  if (/API key not valid|API_KEY_INVALID/i.test(detail)) return `生成失敗：Gemini key 唔啱 請喺 Cloudflare 重新貼過（${status}）`;
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)) return `生成失敗：Google 額度用完或者未開 billing（${status}）`;
  if (status === 403) return `生成失敗：Gemini key 冇權限 可能未開 billing 或者地區唔支援（${status}）`;
  if (status === 404) return `生成失敗：AI 型號搵唔到（${status}）`;
  if (status === 400 && /location|region|country/i.test(detail)) return `生成失敗：Google 喺呢個地區未開放（${status}）`;
  return `生成失敗 請再試一次（${status}）`;
}
