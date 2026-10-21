import { AppError } from './errors';
import type { ParserSettings } from './types';

/**
 * 统一网络请求层（parserClient）
 * 负责携带认证、超时控制、CORS/网络错误归类。
 */

export interface RequestOptions {
  url: string;
  /** 解析目标链接 */
  targetUrl: string;
  settings: ParserSettings;
  method?: 'GET' | 'POST';
}

export interface RawParseResponse {
  status: number;
  ok: boolean;
  body: unknown;
  /** 请求耗时（毫秒） */
  elapsedMs: number;
}

function buildAuthHeaders(settings: ParserSettings): Record<string, string> {
  const headers: Record<string, string> = {};
  if (settings.authMode === 'bearer' && settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }
  return headers;
}

export async function requestParse(opts: RequestOptions): Promise<RawParseResponse> {
  const { settings, targetUrl, method = 'GET' } = opts;
  const base = settings.baseUrl.replace(/\/+$/, '');
  const path = settings.apiPath.startsWith('/') ? settings.apiPath : '/' + settings.apiPath;
  const endpoint = base + path;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs || 20000);
  const started = Date.now();

  try {
    let url = endpoint;
    const headers = buildAuthHeaders(settings);

    let response: Response;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      const body: Record<string, string> = { url: targetUrl };
      if (settings.authMode === 'key' && settings.apiKey) {
        // media-parser 同时支持 JSON body 内 key 与 query key；query key 更通用
        url = appendKey(url, settings.apiKey);
      }
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } else {
      const sep = endpoint.includes('?') ? '&' : '?';
      url = endpoint + sep + 'url=' + encodeURIComponent(targetUrl);
      if (settings.authMode === 'key' && settings.apiKey) {
        url = appendKey(url, settings.apiKey);
      }
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    }

    const elapsedMs = Date.now() - started;
    let body: unknown = null;
    const text = await response.text().catch(() => '');
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text; // 非 JSON 响应，交给归一化层判定
    }
    return { status: response.status, ok: response.ok, body, elapsedMs };
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new AppError('TIMEOUT', '解析请求超时', { retryable: true });
    }
    const name = (err as Error)?.name ?? '';
    if (name === 'TypeError' && (err as Error)?.message?.includes('fetch')) {
      // fetch 网络失败（含 CORS 阻断时 TypeError）
      throw new AppError('CORS_ERROR', '网络错误或跨域被拦截', { retryable: true });
    }
    throw new AppError('SERVICE_UNAVAILABLE', (err as Error)?.message ?? '解析服务不可用', {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

function appendKey(url: string, key: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'key=' + encodeURIComponent(key);
}
