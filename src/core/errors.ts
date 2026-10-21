/**
 * 错误码定义（errors.ts）
 * 统一错误码，UI 根据错误码给出可执行建议。
 */
export type AppErrorCode =
  | 'EMPTY_INPUT'
  | 'NO_URL'
  | 'INVALID_URL'
  | 'PLATFORM_UNSUPPORTED'
  | 'SERVICE_NOT_CONFIGURED'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CORS_ERROR'
  | 'AUTH_FAILED'
  | 'LINK_INVALID'
  | 'LINK_EXPIRED'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'PARSE_FAILED'
  | 'RESPONSE_MALFORMED'
  | 'NO_VIDEO_URL'
  | 'NO_CAPTION'
  | 'DOWNLOAD_FAILED'
  | 'ASR_NOT_CONFIGURED'
  | 'ASR_FILE_TOO_LARGE'
  | 'ASR_FAILED'
  | 'UNKNOWN';

export class AppError extends Error {
  code: AppErrorCode;
  /** 服务端返回的原始错误码（若有） */
  serverCode?: string;
  /** 是否可重试 */
  retryable: boolean;

  constructor(code: AppErrorCode, message: string, opts?: { serverCode?: string; retryable?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.serverCode = opts?.serverCode;
    this.retryable = opts?.retryable ?? false;
  }
}

export const ERROR_SUGGESTIONS: Record<AppErrorCode, string> = {
  EMPTY_INPUT: '请先粘贴或输入分享链接。',
  NO_URL: '未检测到链接，请粘贴包含视频分享链接的内容。',
  INVALID_URL: '这不是一个有效的 http/https 链接，请检查后重试。',
  PLATFORM_UNSUPPORTED: '暂不支持该平台的链接，目前支持抖音、小红书、微信视频号（B站为预留）。',
  SERVICE_NOT_CONFIGURED: '尚未配置解析服务。请打开「设置」填写解析服务地址，或参考 README 部署解析后端。',
  SERVICE_UNAVAILABLE: '解析服务无法访问。请确认服务地址正确、服务已启动，并检查网络与 CORS 配置。',
  TIMEOUT: '解析请求超时。服务可能较慢或不可用，可稍后重试，或检查服务状态。',
  CORS_ERROR: '浏览器跨域被拦截。请确认解析服务已允许本网站来源的跨域请求（CORS），或使用支持 CORS 的服务地址。',
  AUTH_FAILED: '解析服务认证失败。请检查 API Key 与认证方式是否正确。',
  LINK_INVALID: '链接无效。请确认这是平台公开作品的分享链接。',
  LINK_EXPIRED: '链接已过期。平台分享链接有时效性，请重新复制分享链接。',
  PLATFORM_NOT_SUPPORTED: '该平台尚未被解析服务支持，或链接类型不受支持。',
  PARSE_FAILED: '解析失败，服务返回了错误。可点击重新解析，或查看服务端错误详情。',
  RESPONSE_MALFORMED: '解析服务返回的数据格式异常，无法识别。请确认服务为 media-parser 兼容协议。',
  NO_VIDEO_URL: '解析成功，但未取得视频地址。可能是图集、音频或受权限限制的内容。',
  NO_CAPTION: '解析成功，但未取得发布文案/字幕数据。',
  DOWNLOAD_FAILED: '下载失败。媒体地址可能已过期、禁止跨域读取，或浏览器限制直接保存。',
  ASR_NOT_CONFIGURED: '尚未配置语音识别服务。请在「设置」中填写 API Base URL 与 API Key。',
  ASR_FILE_TOO_LARGE: '文件过大，超出当前配置服务的常见限制（约 25MB），请压缩或裁剪后重试。',
  ASR_FAILED: '语音识别请求失败，请检查服务配置、文件格式与网络。',
  UNKNOWN: '发生未知错误，请稍后重试。',
};

export function toUserMessage(code: AppErrorCode, detail?: string): string {
  const base = ERROR_SUGGESTIONS[code] ?? ERROR_SUGGESTIONS.UNKNOWN;
  return detail && detail.trim() ? `${base}\n${detail.trim()}` : base;
}
