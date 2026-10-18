// Cloudflare Workers 入口：/api/preview 交畀 AI 效果圖 其他就係網站檔案
import { DurableObject } from 'cloudflare:workers';
import { onRequestPost } from './functions/api/preview.js';

// Google Gemini 唔支援香港 Worker 喺香港機房行就會被拒
// 所以用一個固定喺美國西岸嘅 Durable Object 代為叫 Gemini
export class GeminiRelay extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    return fetch('https://generativelanguage.googleapis.com' + url.pathname + url.search, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  }
}

function geminiFetch(env) {
  if (!env.GEMINI_RELAY) return fetch;
  const stub = env.GEMINI_RELAY.get(env.GEMINI_RELAY.idFromName('gemini-us-west'), { locationHint: 'wnam' });
  return (url, init) => {
    const u = new URL(url);
    return stub.fetch(new Request('https://relay' + u.pathname + u.search, init));
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/preview') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return onRequestPost({ request, env, ctx, fetchGemini: geminiFetch(env) });
    }
    return env.ASSETS.fetch(request);
  },
};
