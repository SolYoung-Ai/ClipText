import { AppError } from './errors';
import { requestParse } from './parserClient';
import { detectPlatform, getPlatformInfo } from './platformDetector';
import { downgradeNoVideo, normalizeParseResponse } from './responseNormalizer';
import { extractUrlFromText } from './urlNormalizer';
import type { ParseResult, ParserSettings } from './types';

/**
 * 解析适配层（parserAdapter）
 * 统一入口：文本 → 提取链接 → 平台识别 → 请求解析服务 → 归一化结果。
 */

export interface ParseFromTextOptions {
  text: string;
  settings: ParserSettings;
  /** 是否允许平台未配置时直接给出明确错误（默认 true） */
  strictPlatform?: boolean;
  /** 测试环境可注入请求函数 */
  fetcher?: typeof requestParse;
}

/** 从分享文本解析视频，返回归一化结果 */
export async function parseFromText(opts: ParseFromTextOptions): Promise<ParseResult> {
  const { text, settings, fetcher = requestParse } = opts;

  // 1) 提取链接
  const extracted = extractUrlFromText(text);
  if (!extracted.ok) {
    if (extracted.reason === 'EMPTY') throw new AppError('EMPTY_INPUT', '输入为空');
    if (extracted.reason === 'NO_URL') throw new AppError('NO_URL', '未检测到链接');
    throw new AppError('INVALID_URL', '链接格式无效');
  }
  const url = extracted.url;

  // 2) 平台识别
  const platform = detectPlatform(url);
  if (platform === 'unknown') {
    throw new AppError('PLATFORM_UNSUPPORTED', '无法识别的平台链接');
  }

  // 3) 解析服务是否配置
  if (!settings.baseUrl.trim()) {
    throw new AppError('SERVICE_NOT_CONFIGURED', '尚未配置解析服务');
  }

  // 4) 发起请求
  const raw = await fetcher({ url: settings.baseUrl, targetUrl: url, settings });

  // 5) 归一化
  const result = normalizeParseResponse({
    status: raw.status,
    ok: raw.ok,
    body: raw.body,
    requestedUrl: url,
  });

  // 6) 无视频地址时给出明确降级说明
  return downgradeNoVideo(result);
}

/** 平台识别详情（供输入区即时提示） */
export function describeUrl(url: string): { platform: ReturnType<typeof detectPlatform>; name: string; note: string } {
  const p = detectPlatform(url);
  const info = getPlatformInfo(p);
  return { platform: p, name: info?.name ?? '未知平台', note: info?.note ?? '' };
}
