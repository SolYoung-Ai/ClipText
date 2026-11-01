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

/** 自建后端地址（SolYoung-Ai/media-parser，Render 免费实例） */
export const SELF_HOSTED_BASE_URL = 'https://media-parser-1.onrender.com';

/** 旧的示例后端：上游作者部署的公共实例，无转写引擎，仅用于历史设置迁移 */
export const LEGACY_DEMO_HOSTS = ['media-parser-unje.onrender.com'];

export const DEFAULT_PARSER_SETTINGS = {
  baseUrl: SELF_HOSTED_BASE_URL,
  apiPath: '/api/v1/parse',
  authMode: 'none' as const,
  apiKey: '',
  // 免费实例闲置休眠，冷启动约 30~60 秒，超时需留足余量
  timeoutMs: 90000,
};

export const WORKER_BASE_URL = 'https://groq-proxy.solyoungwork.workers.dev';

export const DEFAULT_ASR_SETTINGS = {
  // 自建后端内置 faster-whisper，无需 API Key
  baseUrl: SELF_HOSTED_BASE_URL,
  apiPath: '/v1/audio/transcriptions',
  apiKey: '',
  // base 比 tiny 准确得多（脚本/音轨这类词 tiny 会转错），耗时同量级
  model: 'base',
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

export const DEFAULT_TIMEOUT_MS = 90000;

export const ASR_FILE_WARN_BYTES = 25 * 1024 * 1024;

export const ASR_ACCEPTED_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'mov', 'webm'];
