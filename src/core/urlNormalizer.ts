/**
 * 链接规范化模块（urlNormalizer）
 * 从任意文本中提取第一条 HTTP(S) 链接，清洗首尾标点，返回规范化 URL。
 */

const URL_REGEX =
  /https?:\/\/[^\s\u4e00-\u9fff，。！？；：、（）【】《》“”‘’"'<>]+/gi;

/** 中文/全角与常见英文标点（链接末尾不应包含） */
const TRAILING_PUNCT = /[.,;:!?。，；：！？、）)\]】》"'”’]+$/;

export interface ExtractResult {
  url: string;
  /** 是否成功提取到合法链接 */
  ok: boolean;
  /** 未通过原因（ok=false 时） */
  reason?: string;
}

/** 从整段分享文本中提取第一条 HTTP(S) 链接 */
export function extractUrlFromText(text: string): ExtractResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { ok: false, url: '', reason: 'EMPTY' };
  }
  const matches = trimmed.match(URL_REGEX);
  if (matches && matches.length > 0) {
    return finalize(matches[0]);
  }
  // 可能是“直接贴了 URL 但带中文标点/被截断”，再做一次宽松处理
  const loose = trimmed.match(/https?:\/\/\S*/i);
  if (loose && loose[0].length > 'https://'.length) {
    return finalize(loose[0]);
  }
  // 文本看起来像 URL（含协议头）但不合法：给出具体原因
  if (trimmed.includes('://')) {
    const proto = trimmed.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i);
    if (proto && !/^https?:/i.test(proto[0])) {
      return { ok: false, url: '', reason: 'INVALID_PROTOCOL' };
    }
    return { ok: false, url: '', reason: 'INVALID_URL' };
  }
  return { ok: false, url: '', reason: 'NO_URL' };
}

function finalize(raw: string): ExtractResult {
  let url = raw.trim();
  // 去掉末尾常见标点（循环清理：如 https://a.com/xxx）.）
  let changed = true;
  while (changed && url.length > 8) {
    changed = false;
    const m = url.match(TRAILING_PUNCT);
    if (m && !url.endsWith('/')) {
      url = url.slice(0, url.length - m[0].length);
      changed = true;
    } else if (m && url.endsWith('/') && !url.endsWith('//')) {
      url = url.slice(0, -1);
      changed = true;
    }
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, url: '', reason: 'INVALID_PROTOCOL' };
    }
    if (!u.hostname.includes('.')) {
      return { ok: false, url: '', reason: 'INVALID_HOST' };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, url: '', reason: 'INVALID_URL' };
  }
}

/** 判断一段文本是否为合法 HTTP(S) 链接 */
export function isValidHttpUrl(text: string): boolean {
  const r = extractUrlFromText(text);
  if (!r.ok) return false;
  try {
    const u = new URL(r.url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 是否为可能的短链（v.douyin.com / xhslink.com 等） */
export function isShortLink(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host.includes('douyin.com') ||
      host.includes('xhslink.com') ||
      host.includes('b23.tv') ||
      host.endsWith('.link')
    );
  } catch {
    return false;
  }
}

/** 归一化输入：去除首尾空白（供输入框使用） */
export function normalizeInput(text: string): string {
  return (text ?? '').trim();
}
