import type { PlatformId } from './types';

/** 平台展示信息（CLIPTEXT_PLATFORMS） */
export interface PlatformInfo {
  id: PlatformId;
  name: string;
  shortName: string;
  color: string;
  /** 用于平台识别的域名匹配模式 */
  domains: string[];
  /** 平台分享链接常见域名（识别展示用） */
  example: string;
  /** 支持状态说明 */
  note: string;
  /** 解析依赖说明：true 表示该平台可能依赖服务端登录态/凭证 */
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
    note: '架构预留 · 尚未完成真实接入',
    needsServerCredential: false,
  },
];

export const PLATFORM_MAP: Record<string, PlatformId> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.id]),
);

/** 默认解析设置（指向公网 Render 部署的 media-parser） */
export const DEFAULT_PARSER_SETTINGS = {
  baseUrl: 'https://media-parser-unje.onrender.com',
  apiPath: '/api/v1/parse',
  authMode: 'none' as const,
  apiKey: '',
  timeoutMs: 20000,
};

/** 默认语音识别设置（Groq Whisper Large V3 Turbo，需用户自填 API Key） */
export const DEFAULT_ASR_SETTINGS = {
  baseUrl: 'https://api.groq.com/openai/v1',
  apiPath: '/v1/audio/transcriptions',
  apiKey: '',
  model: 'whisper-large-v3-turbo',
  language: 'zh',
  persistKey: false,
};

/** 本地存储键名 */
export const STORAGE_KEYS = {
  settings: 'cliptext.settings.v1',
  asrSettings: 'cliptext.asr.settings.v1',
  history: 'cliptext.history.v1',
  persistKey: 'cliptext.allowKeyPersist.v1',
};

/** 历史记录上限（避免 localStorage 无限增长） */
export const HISTORY_LIMIT = 100;

/** 单条历史大小上限（字符，防止异常大标题撑爆存储） */
export const HISTORY_ITEM_MAX_CHARS = 2000;

/** 解析请求超时默认值（毫秒） */
export const DEFAULT_TIMEOUT_MS = 20000;

/** 本地文件转写大小限制提示阈值（字节，约 25MB，供提示用） */
export const ASR_FILE_WARN_BYTES = 25 * 1024 * 1024;

/** 支持的文件扩展名（口播转写） */
export const ASR_ACCEPTED_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'mp4', 'mov', 'webm'];