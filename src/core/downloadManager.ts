import { AppError } from './errors';
import type { PlatformId } from './types';

/**
 * 下载管理模块（downloadManager）
 * 处理浏览器跨域与下载限制：
 * 1. 优先 fetch 流式保存（同源或 CORS 允许时）
 * 2. 失败后尝试 <a download> 直接触发
 * 3. 仍失败则提供「打开原始地址」降级，绝不假报成功
 */

export type DownloadOutcome =
  | { kind: 'saved'; fileName: string }
  | { kind: 'opened'; url: string }
  | { kind: 'failed'; reason: string };

function safeFileName(input: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'video';
}

export function buildDownloadFileName(platform: PlatformId, title: string, ext: string): string {
  const plat = platformName(platform);
  const base = `${plat}_${safeFileName(title)}`;
  return `${base}.${ext || 'mp4'}`;
}

function platformName(p: PlatformId): string {
  switch (p) {
    case 'douyin': return '抖音';
    case 'xiaohongshu': return '小红书';
    case 'wechat': return '视频号';
    case 'bilibili': return 'B站';
    default: return '视频';
  }
}

function guessExt(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (m && [ 'mp4', 'mov', 'webm', 'mkv', 'm4a', 'mp3', 'wav', 'flv', 'aac', 'ogg' ].includes(m[1].toLowerCase())) {
      return m[1].toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return 'mp4';
}

async function fetchToBlob(url: string, timeoutMs = 30000): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    if (!res.ok) throw new AppError('DOWNLOAD_FAILED', `媒体请求返回 HTTP ${res.status}`);
    return await res.blob();
  } catch (err) {
    if (err instanceof AppError) throw err;
    const name = (err as Error)?.name ?? '';
    if (name === 'AbortError') throw new AppError('DOWNLOAD_FAILED', '媒体下载超时', { retryable: true });
    // CORS 阻断时 fetch 抛 TypeError
    throw new AppError('DOWNLOAD_FAILED', '跨域读取被拦截，浏览器无法直接保存该文件', { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

function triggerAnchorDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * 执行下载。返回真实结果；失败时给出原因，绝不弹出“下载成功”。
 */
export async function downloadVideo(opts: {
  url: string;
  fileName: string;
  /** 是否允许降级为「打开原始地址」 */
  allowOpenFallback?: boolean;
}): Promise<DownloadOutcome> {
  const { url, fileName, allowOpenFallback = true } = opts;
  try {
    // 1) 尝试 CORS fetch 保存（能拿到完整文件，可强制命名）
    const blob = await fetchToBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objectUrl, fileName);
    // 稍后释放（给浏览器时间开始下载）
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    return { kind: 'saved', fileName };
  } catch (e1) {
    // 2) CORS 失败：尝试 <a download> 直链（同源时有效，跨域时浏览器可能直接打开）
    try {
      triggerAnchorDownload(url, fileName);
      return { kind: 'opened', url };
    } catch {
      if (allowOpenFallback) {
        window.open(url, '_blank', 'noopener');
        return { kind: 'opened', url };
      }
      return {
        kind: 'failed',
        reason: (e1 as Error).message || '下载失败',
      };
    }
  }
}

/** 判断某 URL 是否“大概率可跨域读取”（同源或 CDN 允许 CORS） */
export function isProbablyDownloadable(url: string): boolean {
  try {
    const a = new URL(url);
    return a.protocol === 'http:' || a.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 构造「后端代理下载」地址。
 * 平台 CDN 大多没有 CORS 且校验 Referer，浏览器直接下载常被 403 拦截；
 * 通过配置的解析服务（补丁版 media-parser 提供 /api/v1/download）服务端拉取并流式返回，
 * 配合 Content-Disposition 触发真实保存。仅当解析服务 Base URL 已配置时可用。
 */
export function buildProxyDownloadUrl(
  baseUrl: string,
  mediaUrl: string,
  fileName?: string,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ url: mediaUrl });
  if (fileName) params.set('name', fileName.replace(/\.[a-zA-Z0-9]{2,5}$/, ''));
  return `${base}/api/v1/download?${params.toString()}`;
}

/** 通过后端代理触发下载（导航式下载，依赖服务端 Content-Disposition，无需 CORS） */
export function triggerProxyDownload(baseUrl: string, mediaUrl: string, fileName?: string): string {
  const proxyUrl = buildProxyDownloadUrl(baseUrl, mediaUrl, fileName);
  triggerAnchorDownload(proxyUrl, fileName ?? 'video');
  return proxyUrl;
}

export { guessExt };
