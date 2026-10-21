import { AppError } from './errors';
import { detectPlatform } from './platformDetector';
import type { ParseResult, PlatformId, SubtitleCue, VideoResource } from './types';

/**
 * 解析结果标准化模块（responseNormalizer）
 * 兼容 media-parser 协议（retcode/retdesc/data/succ），
 * 并对常见的 {code,message,data} / {success,data} 响应形态做宽松映射。
 * 未知格式一律抛 RESPONSE_MALFORMED，禁止猜字段。
 */

type RawRecord = Record<string, unknown>;

function isRecord(v: unknown): v is RawRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function platformFromString(s: string): PlatformId {
  const map: Record<string, PlatformId> = {
    抖音: 'douyin', douyin: 'douyin', DY: 'douyin',
    小红书: 'xiaohongshu', xiaohongshu: 'xiaohongshu', XHS: 'xiaohongshu',
    视频号: 'wechat', 微信视频号: 'wechat', wechat: 'wechat', channels: 'wechat', sph: 'wechat',
    哔哩哔哩: 'bilibili', bilibili: 'bilibili', B站: 'bilibili',
  };
  const key = s.trim();
  return map[key] ?? 'unknown';
}

function mapSubtitles(v: unknown): SubtitleCue[] {
  if (!Array.isArray(v)) return [];
  const out: SubtitleCue[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const start = asNumber(item.start ?? item['from']);
    const end = asNumber(item.end ?? item['to']);
    const text = asString(item.text ?? item.content ?? item['txt']).trim();
    if (start === null || end === null || !text) continue;
    out.push({ start, end, text });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function mapVideoList(v: unknown): VideoResource[] {
  if (!Array.isArray(v)) return [];
  const out: VideoResource[] = [];
  for (const item of v) {
    if (typeof item === 'string' && item.startsWith('http')) {
      out.push({ url: item });
    } else if (isRecord(item)) {
      const url = asString(item.url ?? item['src'] ?? item['video_url']);
      if (url.startsWith('http')) {
        out.push({
          url,
          label: asString(item.label ?? item['quality'] ?? item['definition']) || undefined,
          ext: asString(item.ext ?? item['format']) || undefined,
        });
      }
    }
  }
  return out;
}

function mapImages(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => (typeof item === 'string' ? item : isRecord(item) ? asString(item.url ?? item['src']) : ''))
    .filter((u) => u.startsWith('http'));
}

/** 提取话题标签：从 desc 中解析 #话题 或从后端 tags 字段 */
function extractHashtags(desc: string, rawTags: unknown): string[] {
  const tags = new Set<string>();
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      const s = typeof t === 'string' ? t : isRecord(t) ? asString(t.name ?? t['title']) : '';
      if (s) tags.add(s.replace(/^#/, ''));
    }
  }
  const re = /#[^\s#，。！？；：、]+/g;
  for (const m of desc.match(re) ?? []) {
    tags.add(m.slice(1).trim());
  }
  return [...tags].slice(0, 30);
}

/** 主入口：将原始响应归一化为 ParseResult。抛错时带具体错误码。 */
export function normalizeParseResponse(input: {
  status: number;
  ok: boolean;
  body: unknown;
  requestedUrl: string;
}): ParseResult {
  const { status, body, requestedUrl } = input;
  const empty = (code: AppError['code'], message: string): never => {
    throw new AppError(code, message);
  };

  // HTTP 层失败
  if (status >= 500) {
    empty('SERVICE_UNAVAILABLE', `解析服务返回 HTTP ${status}`);
  }
  if (status === 401 || status === 403) {
    empty('AUTH_FAILED', `解析服务返回 HTTP ${status}`);
  }
  if (status === 404) {
    empty('SERVICE_NOT_CONFIGURED', `解析服务返回 HTTP 404：请检查 API 路径是否正确`);
  }

  if (!isRecord(body)) {
    empty('RESPONSE_MALFORMED', '解析服务返回了非 JSON 数据');
  }

  // 识别响应壳
  const shell = body as RawRecord;
  let data: unknown = shell['data'] ?? null;
  let succ = shell['succ'] ?? shell['success'];
  let retcode = asNumber(shell['retcode'] ?? shell['code'] ?? shell['status']);
  let retdesc = asString(shell['retdesc'] ?? shell['message'] ?? shell['msg'] ?? '');
  let errorCode = asString(shell['error_code'] ?? shell['errorCode'] ?? '');

  // media-parser: retcode 200 且 succ=true 视为成功；也兼容只有 retcode==200 的情况
  const successByShell =
    succ === true || (succ === undefined && (retcode === 200 || retcode === 0));
  const failedByShell =
    succ === false || (typeof retcode === 'number' && retcode !== 200 && retcode !== 0);

  if (failedByShell) {
    // 平台不支持 / 链接无效等业务错误
    const code = mapServerError(errorCode, retcode, retdesc);
    empty(code, retdesc || `服务返回错误 retcode=${retcode}`);
  }

  if (!successByShell && !isRecord(data)) {
    empty('RESPONSE_MALFORMED', '无法识别解析服务的响应结构');
  }

  if (!isRecord(data)) {
    // 成功但无 data（可能直接返回字段平铺）
    data = shell;
  }
  const d = data as RawRecord;

  const platformStr = asString(d['platform'] ?? d['platform_name'] ?? d['source']);
  const platform = platformFromString(platformStr);
  // 无法从响应判断平台时，回退到请求链接的域名识别
  const fallbackPlatform = platform === 'unknown' ? detectPlatform(requestedUrl) : platform;
  const finalPlatform: PlatformId = fallbackPlatform === 'unknown' ? 'unknown' : fallbackPlatform;

  const title = asString(d['title'] ?? '').trim();
  const desc = asString(d['desc'] ?? d['description'] ?? d['caption'] ?? '').trim();
  const videoUrl = asString(d['video_url'] ?? d['url'] ?? '').trim();
  const videoList = mapVideoList(d['video_list'] ?? d['video_urls'] ?? d['videos'] ?? []);
  const audioUrl = asString(d['audio_url'] ?? '').trim();
  const coverUrl = asString(d['cover_url'] ?? d['cover'] ?? d['thumbnail'] ?? d['pic'] ?? '').trim();
  const subtitles = mapSubtitles(d['subtitles'] ?? d['subtitle_list'] ?? d['lyric'] ?? []);
  const images = mapImages(d['image_list'] ?? d['images'] ?? []);
  const duration = asNumber(d['duration'] ?? d['video_duration']);
  const hashtags = extractHashtags(desc, d['tags'] ?? d['topics']);

  const authorRaw = d['author'];
  const author = isRecord(authorRaw)
    ? {
        name: asString(authorRaw['nickname'] ?? authorRaw['name'] ?? authorRaw['nick_name']).trim(),
        avatar: asString(authorRaw['avatar'] ?? authorRaw['avatar_url'] ?? '').trim(),
      }
    : null;

  const rawKeys = Object.keys(d);

  return {
    success: true,
    platform: finalPlatform,
    canonicalUrl: requestedUrl,
    title,
    description: desc,
    hashtags,
    author: author && (author.name || author.avatar) ? author : null,
    coverUrl,
    videoUrl,
    videoUrls: videoUrl ? [{ url: videoUrl, label: '主视频' }, ...videoList.filter((v) => v.url !== videoUrl)] : videoList,
    audioUrl,
    subtitles,
    duration,
    images,
    rawKeys,
    errorCode: null,
    errorMessage: null,
  };
}

function mapServerError(errorCode: string, retcode: number | null, retdesc: string): AppError['code'] {
  const e = errorCode.toUpperCase();
  if (e.includes('PLATFORM_NOT_SUPPORTED') || e.includes('UNSUPPORTED')) return 'PLATFORM_NOT_SUPPORTED';
  if (e.includes('EXPIRED') || retdesc.includes('过期')) return 'LINK_EXPIRED';
  if (e.includes('INVALID') || retdesc.includes('无效') || retdesc.includes('不存在')) return 'LINK_INVALID';
  if (e.includes('AUTH') || e.includes('KEY')) return 'AUTH_FAILED';
  if (retcode === 401 || retcode === 403) return 'AUTH_FAILED';
  if (e.includes('NOT_SUPPORTED')) return 'PLATFORM_NOT_SUPPORTED';
  return 'PARSE_FAILED';
}

/** 结果校验：解析成功但没有视频地址时返回降级结果（不编造） */
export function downgradeNoVideo(result: ParseResult): ParseResult {
  if (!result.videoUrl && result.videoUrls.length === 0) {
    return { ...result, errorCode: 'NO_VIDEO_URL', errorMessage: '解析成功，但未取得视频地址' };
  }
  return result;
}
