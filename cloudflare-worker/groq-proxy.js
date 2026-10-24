/**
 * Groq API CORS Proxy — Cloudflare Worker
 * 用于让 ClipText 前端跨域调用 Groq Whisper API
 * 
 * 部署步骤：
 * 1. 打开 https://dash.cloudflare.com/ → Workers & Pages
 * 2. Create Worker → 命名（如 groq-proxy）
 * 3. 把本文件代码粘贴进去 → Deploy
 * 4. 复制 Worker 地址（如 https://groq-proxy.xxx.workers.dev）
 * 5. 回到 ClipText 设置 → 语音识别服务 → Base URL 填这个地址
 */

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = GROQ_API_BASE + url.pathname + url.search;

    // 透传必要的请求头
    const headers = new Headers();
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    const requestInit = {
      method: request.method,
      headers: headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    };

    try {
      const response = await fetch(targetUrl, requestInit);
      
      // 把响应体流式返回，加上 CORS 头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      
      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
