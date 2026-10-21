/**
 * 全局数据契约（types.ts）
 * 所有解析结果在进入 UI 之前都必须归一化为 ParseResult，
 * 未取得的数据保持 null / 空字符串 / 空数组，禁止编造。
 */

export type PlatformId = 'douyin' | 'xiaohongshu' | 'wechat' | 'bilibili' | 'unknown';

export interface SubtitleCue {
  /** 开始时间（秒） */
  start: number;
  /** 结束时间（秒） */
  end: number;
  text: string;
}

export interface AuthorInfo {
  name: string;
  avatar: string;
}

export interface VideoResource {
  /** 媒体直链 */
  url: string;
  /** 展示标签（如「主视频」）；清晰度/分辨率仅以后端实际返回为准 */
  label?: string;
  /** 文件类型（如 mp4）；无法确认时为空 */
  ext?: string;
}

export interface ParseResult {
  success: boolean;
  platform: PlatformId;
  /** 归一化后的目标链接 */
  canonicalUrl: string;
  title: string;
  description: string;
  /** 发布正文中的话题标签（若后端提供） */
  hashtags: string[];
  author: AuthorInfo | null;
  coverUrl: string;
  /** 主视频直链（单视频场景） */
  videoUrl: string;
  /** 多视频/资源列表 */
  videoUrls: VideoResource[];
  audioUrl: string;
  /** 平台已有字幕（来自解析服务，非 AI 生成） */
  subtitles: SubtitleCue[];
  duration: number | null;
  /** 图片图集（若后端提供） */
  images: string[];
  /** 原始响应是否还包含其它未映射字段（供诊断） */
  rawKeys: string[];
  errorCode: string | null;
  errorMessage: string | null;
}

/** 文案提取的三种来源（combined 为统一整理稿，仅查看/导出用） */
export type TextSource = 'caption' | 'subtitle' | 'asr' | 'combined';

export interface TextPayload {
  source: TextSource;
  /** 数据是否真实取得 */
  available: boolean;
  /** 标题（发布文案场景） */
  title?: string;
  /** 正文/转写全文 */
  body: string;
  /** 话题标签 */
  hashtags?: string[];
  /** 字幕（subtitle 场景） */
  cues?: SubtitleCue[];
  /** 生成时间 */
  createdAt: string;
}

export type AuthMode = 'none' | 'key' | 'bearer';

export interface ParserSettings {
  /** 解析服务 Base URL，如 https://mp.example.com */
  baseUrl: string;
  /** API 路径，默认 /api/v1/parse */
  apiPath: string;
  authMode: AuthMode;
  /** 用户自填 API Key；默认仅存会话内存 */
  apiKey: string;
  /** 请求超时（毫秒） */
  timeoutMs: number;
}

export interface AsrSettings {
  baseUrl: string;
  apiPath: string;
  apiKey: string;
  model: string;
  language: string;
  /** 是否在浏览器本地持久化（用户明确选择后才开启） */
  persistKey: boolean;
}

export interface HistoryItem {
  id: string;
  platform: PlatformId;
  title: string;
  url: string;
  parsedAt: string;
  success: boolean;
  /** 已取得数据的摘要（是否含视频/文案/字幕/音频） */
  summary: {
    hasVideo: boolean;
    hasCaption: boolean;
    hasSubtitle: boolean;
    hasAudio: boolean;
    hasCover: boolean;
  };
  errorMessage?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  status?: number;
  retcode?: number;
  retdesc?: string;
  message: string;
  testedAt: string;
  /** 服务宣称支持的平台（若响应中提供） */
  platform?: string;
}

export interface AppState {
  parseResult: ParseResult | null;
  status: 'idle' | 'parsing' | 'success' | 'error';
  error: string | null;
  lastParsedUrl: string;
}
