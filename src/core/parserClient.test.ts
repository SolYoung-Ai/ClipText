import { describe, expect, it, vi } from 'vitest';
import { requestParse } from './parserClient';
import type { ParserSettings } from './types';

const settings: ParserSettings = {
  baseUrl: 'https://mp.example.com',
  apiPath: '/api/v1/parse',
  authMode: 'none',
  apiKey: '',
  timeoutMs: 5000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parserClient', () => {
  it('GET 请求拼接 url 参数', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ succ: true }));
    vi.stubGlobal('fetch', spy);
    const res = await requestParse({ url: settings.baseUrl, targetUrl: 'https://v.douyin.com/x/', settings });
    const [input, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(input).toContain('/api/v1/parse?url=' + encodeURIComponent('https://v.douyin.com/x/'));
    expect(init.method ?? 'GET').toBe('GET');
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it('key 认证附加 key 参数', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ succ: true }));
    vi.stubGlobal('fetch', spy);
    await requestParse({
      url: settings.baseUrl,
      targetUrl: 'https://v.douyin.com/x/',
      settings: { ...settings, authMode: 'key', apiKey: 'mp-secret' },
    });
    const input = spy.mock.calls[0][0] as string;
    expect(input).toContain('key=' + encodeURIComponent('mp-secret'));
    vi.unstubAllGlobals();
  });

  it('bearer 认证附加 Authorization 头', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ succ: true }));
    vi.stubGlobal('fetch', spy);
    await requestParse({
      url: settings.baseUrl,
      targetUrl: 'https://v.douyin.com/x/',
      settings: { ...settings, authMode: 'bearer', apiKey: 'token-abc' },
    });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
    vi.unstubAllGlobals();
  });

  it('POST 请求发送 JSON body', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse({ succ: true }));
    vi.stubGlobal('fetch', spy);
    await requestParse({
      url: settings.baseUrl,
      targetUrl: 'https://v.douyin.com/x/',
      settings,
      method: 'POST',
    });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body.url).toBe('https://v.douyin.com/x/');
    vi.unstubAllGlobals();
  });

  it('超时抛 TIMEOUT', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise((_, reject) => reject(new DOMException('Aborted', 'AbortError')))));
    await expect(
      requestParse({ url: settings.baseUrl, targetUrl: 'https://v.douyin.com/x/', settings }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    vi.unstubAllGlobals();
  });

  it('网络/CORS 错误归类', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(
      requestParse({ url: settings.baseUrl, targetUrl: 'https://v.douyin.com/x/', settings }),
    ).rejects.toMatchObject({ code: 'CORS_ERROR' });
    vi.unstubAllGlobals();
  });

  it('非 JSON 响应原样传递', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Response('<html>bad</html>', { status: 502 })));
    const res = await requestParse({ url: settings.baseUrl, targetUrl: 'https://v.douyin.com/x/', settings });
    expect(res.status).toBe(502);
    expect(res.body).toBe('<html>bad</html>');
    vi.unstubAllGlobals();
  });
});
