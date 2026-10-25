import type { PlatformId } from './types';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  shortName: string;
  color: string;
  domains: string[];
  example: string;
  note: string;
  needsServerCredential: boolean;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'douyin',
    name: '抖音',
    shortName: '抖音',
    color: '#161823',
    domains: ['v.douyin.com', 'www.douyin.com', 'douyin.com', 'iesdouyin.com'],
    example: 'https://v.douyin.com/xxxxxxx/',
    note: '公开作品 · 支持视频/图文/合集，字幕视接口返回',
    needsServerCredential: false,
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    shortName: '小红书',
    color: '#ff2442',
    domains: ['xhslink.com', 'www.xiaohongshu.com', 'xiaohongshu.com', 'xhscdn.com'],
    example: 'https://xhslink.com/a/xxxxx',
    note: '公开笔记 · 部分链接可能需要服务端凭证',
    needsServerCredential: true,
  },
  {
    id: 'wechat',
    name: '微信视频号',
    shortName: '视频号',
    color: '#07c160',
    domains: ['weixin.qq.com/sph', 'channels.weixin.qq.com'],
    example: 'https://weixin.qq.com/sph/xxxxx',
    note: '公开内容 · 链接有时效性，过期需重新分享',
    needsServerCredential: true,
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    shortName: 'B站',
    color: '#fb7299',
    domains: ['bilibili.com', 'b23.tv'],
    example: 'https://www.bilibili.com/video/BVxxxx',
    note: '公开视频 · 支持 BV 号解析与下载，字幕视接口返回',
    needsServerCredential: false,
  },
];

export const PLATFORM_MAP: Record<string, PlatformId> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.id]),
);

export const DEFAULT_PARSER_SETTINGS = {
  baseUrl: 'https://media-parser-unje.onrender.com',
  apiPath: '/api/v1/parse',
  authMode: 'none' as const,
  apiKey: '',
  timeoutMs: 30000,
};

export const WORKER_BASE_URL = 'https://groq-proxy.solyoungwork.workers.dev';

export const DEFAULT_ASR_SETTINGS = {
  baseUrl: WORKER_BASE_URL,
  apiPath: '/v1/audio/transcriptions',
  apiKey: '',
  model: 'whisper-large-v3-turbo',
  language: 'zh',
  persistKey: false,
};

export const STORAGE_KEYS = {
  settings: 'cliptext.settings.v3',
  asrSettings: 'cliptext.asr.settings.v3',
  history: 'cliptext.history.v1',
  persistKey: 'cliptext.allowKeyPersist.v3',
};

export const HISTORY_LIMIT = 100;

export const HISTORY_ITEM_MAX_CHARS = 2000;

export const DEFAULT_TIMEOUT_MS = 30000;

export const ASR_FILE_WARN_BYTES = 25 * 1024 * 1024;

export const ASR_ACCEPTED_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'mov', 'webm'];
