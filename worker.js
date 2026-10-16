// Cloudflare Workers 入口：/api/preview 交畀 AI 效果圖 其他就係網站檔案
import { onRequestPost } from './functions/api/preview.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/preview') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return onRequestPost({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
