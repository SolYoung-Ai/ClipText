import { buildProxyDownloadUrl, guessExt } from './downloadManager';
import { AppError } from './errors';
import type { AsrSettings } from './types';

/**
 * 语音识别服务模块（speechToTextService）
 * 兼容 OpenAI 风格 /v1/audio/transcriptions（multipart 上传 file + model + language），
 * 但以用户配置的服务协议为准：Base URL 与接口路径均可配置。
 *
 * 口播提取共三条可用路径（按顺序组合使用）：
 * 1. transcribeFromUrl —— 后端自己下载视频再转写（最快，但平台 CDN 常拦截服务器下载）
 * 2. fetchMediaFileViaProxy —— 通过解析服务的媒体代理把视频取回浏览器（代理带正确 Referer）
 * 3. transcribeFile —— 浏览器把文件上传给语音识别服务
 * 真实链路：1 失败（403/502）→ 2 → 3，从而绕开「后端下载被拒」这一限制。
 */

export interface AsrOutcome {
  text: string;
  durationMs: number;
  model?: string;
}

export interface AsrCallOptions {
  /** 请求超时（毫秒），默认 120 秒 */
  timeoutMs?: number;
}

function buildEndpoint(settings: AsrSettings): string {
  const base = settings.baseUrl.replace(/\/+$/, '');
  const path = settings.apiPath.startsWith('/') ? settings.apiPath : '/' + settings.apiPath;
  return base + path;
}

/**
 * 转录本地文件。
 * @param file 用户上传的音视频文件（用户声明有权处理）
 */
export async function transcribeFile(
  file: File,
  settings: AsrSettings,
  opts: AsrCallOptions = {},
): Promise<AsrOutcome> {
  if (!settings.baseUrl.trim()) {
    throw new AppError('ASR_NOT_CONFIGURED', '尚未配置语音识别服务');
  }
  if (!file) {
    throw new AppError('ASR_FAILED', '未选择文件');
  }
  const started = Date.now();

  const form = new FormData();
  form.append('file', file);
  form.append('model', settings.model || 'whisper-1');
  if (settings.language) form.append('language', settings.language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120000); // 大文件转录可能较慢

  try {
    const res = await fetch(buildEndpoint(settings), {
      method: 'POST',
      headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      body: form,
      signal: controller.signal,
    });
    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new AppError('ASR_FAILED', `语音识别服务认证失败（HTTP ${res.status}），请检查 API Key`);
      }
      if (res.status === 413) {
        throw new AppError('ASR_FILE_TOO_LARGE', '文件过大，服务拒绝了请求（HTTP 413）');
      }
      if (isMissingEngine(raw)) {
        throw new AppError(
          'ASR_FAILED',
          '转写服务未安装语音识别引擎（faster-whisper），后端需要重新构建部署。可在「设置」改用 Groq 等外部语音识别服务。',
        );
      }
      const detail =
        typeof data === 'object' && data && 'error' in (data as object)
          ? JSON.stringify((data as { error?: unknown }).error)
          : String(raw).slice(0, 200);
      throw new AppError('ASR_FAILED', `语音识别失败（HTTP ${res.status}）：${detail}`);
    }

    let text = '';
    if (typeof data === 'string') text = data;
    else if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      text = String(record['text'] ?? record['result'] ?? '');
    }
    if (!text.trim()) {
      throw new AppError('ASR_FAILED', '语音识别服务返回了空结果');
    }
    return { text: text.trim(), durationMs: Date.now() - started, model: settings.model };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new AppError('ASR_FAILED', '语音识别请求超时', { retryable: true });
    }
    throw new AppError('ASR_FAILED', (err as Error)?.message ?? '语音识别请求失败', { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ASR 自动转写（后端下载视频再转写）的错误分类。
 * 这类错误往往来自后端下载平台视频被 CDN 拦截（403/502），
 * 前端无法改变下载结果，但可以据此给出可执行的降级引导。
 */
export interface AsrErrorClass {
  kind: 'download' | 'auth' | 'network' | 'server' | 'other';
  /** 面向用户的建议（已含具体原因） */
  userHint: string;
}

export function classifyAsrError(status: number, raw: string): AsrErrorClass {
  const lower = (raw || '').toLowerCase();
  const has = (re: RegExp) => re.test(lower);

  if (status === 401 || has(/unauthor|invalid.*key|api[_ ]?key/)) {
    return {
      kind: 'auth',
      userHint: '语音识别服务认证失败（HTTP 401），请检查 API Key 是否正确。',
    };
  }
  // 平台 CDN 拦截服务器端下载：小红书 / 视频号等常见
  if (has(/下载视频失败|下载失败|download failed|forbidden|\b403\b|http 403/)) {
    return {
      kind: 'download',
      userHint:
        '自动下载被平台拒绝（HTTP 403）。小红书、视频号等平台的视频 CDN 会拦截服务器端下载，请改用下方「本地视频文件上传」方式转写。',
    };
  }
  if (status === 502 || status === 504 || has(/502|504|网关|gateway|bad gateway/)) {
    return {
      kind: 'download',
      userHint:
        '后端自动下载视频失败（HTTP 502/504）。该平台视频 CDN 常拦截服务器端下载，建议改用本地视频文件上传转写。',
    };
  }
  if (status === 413) {
    return { kind: 'server', userHint: '文件过大，服务拒绝（HTTP 413），请压缩或裁剪后重试。' };
  }
  if (status === 0 || has(/network|fetch|timeout|超时|连接|econn|dns/)) {
    return { kind: 'network', userHint: '网络或连接异常，请确认后端服务在线且允许跨域访问。' };
  }
  return { kind: 'other', userHint: '' };
}

/**
 * 路径 1：让后端直接下载视频并转写（媒体服务端 `POST /api/v1/asr-from-url`）。
 * 优点是一次请求完成；缺点是下载行为由后端发起，小红书/视频号 CDN 常返回 403。
 * 失败时会抛出带语义错误码的 AppError：
 * - `DOWNLOAD_FAILED`：后端下载被平台拒绝（调用方应改走媒体代理路径）
 * - `AUTH_FAILED`：服务认证失败
 */
export async function transcribeFromUrl(
  mediaUrl: string,
  settings: AsrSettings,
  opts: AsrCallOptions = {},
): Promise<AsrOutcome> {
  if (!settings.baseUrl.trim()) {
    throw new AppError('ASR_NOT_CONFIGURED', '尚未配置语音识别服务');
  }
  const base = settings.baseUrl.replace(/\/+$/, '');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120000);
  try {
    const res = await fetch(`${base}/api/v1/asr-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrl }),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      if (isMissingEngine(raw)) {
        throw new AppError(
          'ASR_FAILED',
          '转写服务未安装语音识别引擎（faster-whisper），后端需要重新构建部署。',
        );
      }
      const cls = classifyAsrError(res.status, raw);
      const detail = cls.userHint || `服务返回 HTTP ${res.status}：${raw.slice(0, 160)}`;
      const code =
        cls.kind === 'download' ? 'DOWNLOAD_FAILED' : cls.kind === 'auth' ? 'AUTH_FAILED' : 'ASR_FAILED';
      throw new AppError(code, `后端自动转写失败（HTTP ${res.status}）。${detail}`, {
        retryable: cls.kind === 'network',
      });
    }
    let data: { text?: string } | null = null;
    try {
      data = raw ? (JSON.parse(raw) as { text?: string }) : null;
    } catch {
      /* 非 JSON 响应，下面按空结果处理 */
    }
    const text = (data?.text ?? '').trim();
    if (!text) throw new AppError('ASR_FAILED', '转写返回了空文本');
    return { text, durationMs: Date.now() - started, model: settings.model };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new AppError('ASR_FAILED', '后端转写超时，请稍后重试', { retryable: true });
    }
    throw new AppError('ASR_FAILED', `无法连接语音识别服务：${(err as Error)?.message ?? '网络异常'}`, {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface ProxyDownloadOptions {
  /** 解析服务 Base URL（提供 /api/v1/download 媒体代理） */
  proxyBaseUrl: string;
  /** 平台媒体直链 */
  mediaUrl: string;
  /** 期望文件名（不含扩展名） */
  fileName?: string;
  /** 体积上限（字节），默认 120MB */
  maxBytes?: number;
  timeoutMs?: number;
  /** 下载进度回调（已接收字节 / 总字节） */
  onProgress?: (received: number, total?: number) => void;
}

export interface ProxyDownloadOutcome {
  file: File;
  sizeMB: number;
}

/**
 * 路径 2：通过解析服务的媒体代理 `/api/v1/download` 把视频取回浏览器。
 * 该端点由服务端按 CDN 域名补正确 Referer，因此能拿到后端「直连下载」拿不到的文件；
 * 取回后即可走路径 3 上传转写，绕开平台上对服务器下载的拦截。
 */
export async function fetchMediaFileViaProxy(opts: ProxyDownloadOptions): Promise<ProxyDownloadOutcome> {
  const base = (opts.proxyBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new AppError('SERVICE_NOT_CONFIGURED', '未配置解析服务地址，无法通过代理下载视频');
  }
  const maxBytes = opts.maxBytes ?? 120 * 1024 * 1024;
  const url = buildProxyDownloadUrl(base, opts.mediaUrl, opts.fileName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      throw new AppError(
        'DOWNLOAD_FAILED',
        `媒体代理下载失败（HTTP ${res.status}）：${raw.slice(0, 160) || '服务未提供代理端点'}`,
      );
    }
    const total = Number(res.headers.get('Content-Length') ?? '') || undefined;
    const { bytes, type } = await readBytesWithProgress(res, opts.onProgress, total);
    if (!bytes.byteLength) throw new AppError('DOWNLOAD_FAILED', '媒体代理返回了空文件');
    if (bytes.byteLength > maxBytes) {
      throw new AppError(
        'ASR_FILE_TOO_LARGE',
        `视频体积过大（${(bytes.byteLength / 1048576).toFixed(0)}MB），请改用本地压缩后的文件`,
      );
    }
    const ext = guessExt(opts.mediaUrl);
    const name = `${opts.fileName || 'media'}.${ext}`;
    const file = new File([bytes as unknown as BlobPart], name, { type: type || 'video/mp4' });
    return { file, sizeMB: bytes.byteLength / 1048576 };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new AppError('DOWNLOAD_FAILED', '媒体代理下载超时，请稍后重试', { retryable: true });
    }
    throw new AppError('DOWNLOAD_FAILED', `媒体代理下载失败：${(err as Error)?.message ?? '网络异常'}`, {
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 边读边报进度；环境不支持流式读取时退化为一次性 arrayBuffer() */
async function readBytesWithProgress(
  res: Response,
  onProgress?: (received: number, total?: number) => void,
  total?: number,
): Promise<{ bytes: Uint8Array; type: string }> {
  const type = res.headers.get('Content-Type') ?? '';
  const body = res.body;
  if (!onProgress || !body || typeof body.getReader !== 'function') {
    return { bytes: new Uint8Array(await res.arrayBuffer()), type };
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, total);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, type };
}

/** 后端缺少 faster-whisper 时的响应特征（构建失败或部署了旧版本） */
export function isMissingEngine(raw: string): boolean {
  return /no module named ['"]?faster[_-]whisper/i.test(raw || '');
}

/** 文件扩展名校验 */
export function isAcceptedFile(file: File): boolean {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  return [ 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'mov', 'webm', 'flac' ].includes(ext);
}

export function fileSizeMB(file: File): number {
  return file.size / 1024 / 1024;
}

/** 简单校验配置是否可测：无 API Key 时提示需真实上传文件验证 */
export function asrConfigState(settings: AsrSettings): 'ready' | 'missing-base' | 'missing-key' | 'partial' {
  if (!settings.baseUrl.trim()) return 'missing-base';
  if (!settings.apiKey.trim()) return 'missing-key';
  return 'ready';
}
