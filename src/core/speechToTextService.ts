import { AppError } from './errors';
import type { AsrSettings } from './types';

/**
 * 语音识别服务模块（speechToTextService）
 * 兼容 OpenAI 风格 /v1/audio/transcriptions（multipart 上传 file + model + language），
 * 但以用户配置的服务协议为准：Base URL 与接口路径均可配置。
 */

export interface AsrOutcome {
  text: string;
  durationMs: number;
  model?: string;
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
export async function transcribeFile(file: File, settings: AsrSettings): Promise<AsrOutcome> {
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
  const timer = setTimeout(() => controller.abort(), 120000); // 大文件转录可能较慢

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
