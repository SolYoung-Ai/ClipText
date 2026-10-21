import type { ParseResult, TextPayload } from './types';

/**
 * 文案与字幕处理模块（transcriptService）
 * 从 ParseResult 组装三种来源的 TextPayload；未取得数据时 available=false，绝不填充假文案。
 */

export function captionPayload(result: ParseResult | null): TextPayload {
  if (!result) {
    return { source: 'caption', available: false, body: '', createdAt: new Date().toISOString() };
  }
  const body = result.description || '';
  const hasData = Boolean(result.title || body || result.hashtags.length);
  return {
    source: 'caption',
    available: hasData,
    title: result.title || undefined,
    body,
    hashtags: result.hashtags,
    createdAt: new Date().toISOString(),
  };
}

export function subtitlePayload(result: ParseResult | null): TextPayload {
  if (!result) {
    return { source: 'subtitle', available: false, body: '', createdAt: new Date().toISOString() };
  }
  const cues = Array.isArray(result.subtitles) ? result.subtitles : [];
  const hasData = cues.length > 0;
  return {
    source: 'subtitle',
    available: hasData,
    body: cues.map((c) => c.text).join('\n'),
    cues: hasData ? cues : undefined,
    createdAt: new Date().toISOString(),
  };
}

/** 组装「统一整理稿」：按来源拼接并标注来源（仅供查看，导出时区分来源） */
export function buildCombinedDraft(payloads: TextPayload[]): string {
  const parts: string[] = [];
  for (const p of payloads) {
    if (!p.available) continue;
    const head = sourceTitle(p.source);
    if (p.title) parts.push(`【${head}】\n${p.title}`);
    const body = p.body?.trim();
    if (body) parts.push(`【${head}】\n${body}`);
  }
  return parts.join('\n\n');
}

function sourceTitle(s: TextPayload['source']): string {
  switch (s) {
    case 'caption': return '发布文案';
    case 'subtitle': return '原始字幕';
    case 'asr': return '口播转写';
    case 'combined': return '统一整理稿';
  }
}

/** 统计字符数（不含空白换行） */
export function countChars(text: string): number {
  return (text ?? '').replace(/\s/g, '').length;
}
