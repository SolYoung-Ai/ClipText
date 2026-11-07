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
  // 后端直接用 name 作为 Content-Disposition 文件名，不会自动补扩展名；
  // 这里必须传完整文件名（含 .mp4），否则用户下载到的是无法播放的无后缀文件。
  if (fileName) params.set('name', fileName);
  return `${base}/api/v1/download?${params.toString()}`;
}

/** 通过后端代理触发下载（导航式下载，依赖服务端 Content-Disposition，无需 CORS） */
export function triggerProxyDownload(baseUrl: string, mediaUrl: string, fileName?: string): string {
  const proxyUrl = buildProxyDownloadUrl(baseUrl, mediaUrl, fileName);
  triggerAnchorDownload(proxyUrl, fileName ?? 'video');
  return proxyUrl;
}

export interface ProxySaveOptions {
  /** 解析服务 Base URL（提供 /api/v1/download 媒体代理） */
  proxyBaseUrl: string;
  mediaUrl: string;
  /** 完整文件名（含扩展名） */
  fileName: string;
  timeoutMs?: number;
  onProgress?: (received: number, total?: number) => void;
}

export interface ProxySaveOutcome {
  kind: 'saved';
  fileName: string;
  sizeMB: number;
}

/**
 * 通过媒体代理把视频取回浏览器并保存为本地文件。
 *
 * 与「导航式下载」不同：这里会真实检查 HTTP 状态与返回体，
 * 后端返回 403/405/502 时直接抛错，不会把用户导向一个错误页面
 * 却还提示「已开始下载」。代理端点 CORS 为 *，因此可以跨域读取。
 */
export async function saveVideoViaProxy(opts: ProxySaveOptions): Promise<ProxySaveOutcome> {
  const base = (opts.proxyBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new AppError('SERVICE_NOT_CONFIGURED', '未配置解析服务地址，无法下载视频');
  }
  const url = buildProxyDownloadUrl(base, opts.mediaUrl, opts.fileName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 300000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      const hint = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      throw new AppError('DOWNLOAD_FAILED', `下载失败（HTTP ${res.status}）${hint ? `：${hint}` : ''}`);
    }
    const total = Number(res.headers.get('Content-Length') ?? '') || undefined;
    const blob = await readProxyBlob(res, opts.onProgress, total);
    if (!blob.size) throw new AppError('DOWNLOAD_FAILED', '媒体代理返回了空文件');
    const objectUrl = URL.createObjectURL(blob);
    triggerAnchorDownload(objectUrl, opts.fileName);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    return { kind: 'saved', fileName: opts.fileName, sizeMB: blob.size / 1048576 };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new AppError('DOWNLOAD_FAILED', '下载超时，请稍后重试', { retryable: true });
    }
    throw new AppError('DOWNLOAD_FAILED', `下载失败：${(err as Error)?.message ?? '网络异常'}`, {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 边读边报进度；环境不支持流式读取时退化为一次性 blob() */
async function readProxyBlob(
  res: Response,
  onProgress?: (received: number, total?: number) => void,
  total?: number,
): Promise<Blob> {
  const body = res.body;
  if (!onProgress || !body || typeof body.getReader !== 'function') return res.blob();
  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value as unknown as BlobPart);
      received += value.byteLength;
      onProgress(received, total);
    }
  }
  return new Blob(chunks, { type: res.headers.get('Content-Type') ?? 'application/octet-stream' });
}

export { guessExt };
