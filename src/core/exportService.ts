import type { SubtitleCue, TextPayload } from './types';

/**
 * 文件导出模块（exportService）
 * TXT / SRT / JSON 导出。SRT 遵循真实字幕格式（序号 + 时间轴 + 文本）。
 */

function pad2(n: number): string {
  return String(Math.floor(Math.max(0, n))).padStart(2, '0');
}

/** 秒 → SRT 时间轴 00:00:01,500 */
export function formatSrtTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)},${String(ms).padStart(3, '0')}`;
}

/** 秒 → 人类可读 00:01.5 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${pad2(m)}:${sec}`;
}

function cleanupText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 生成 SRT 文件内容 */
export function buildSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => {
      const start = formatSrtTimestamp(c.start);
      const end = formatSrtTimestamp(c.end);
      return `${i + 1}\n${start} --> ${end}\n${c.text.replace(/\n/g, ' ')}\n`;
    })
    .join('\n');
}

export interface ExportOptions {
  fileName: string;
  content: string;
  mime: string;
  ext: string;
}

function triggerDownload(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** 从 TextPayload 生成可导出文件 */
export function exportPayload(payload: TextPayload, opts: { kind: 'txt' | 'srt' | 'json' }): ExportOptions {
  const sourceLabel = sourceName(payload.source);
  const base = `ClipText_${sourceLabel}_${Date.now()}`;

  if (opts.kind === 'srt') {
    const cues = payload.cues ?? [];
    return {
      fileName: `${base}.srt`,
      content: buildSrt(cues),
      mime: 'application/x-subrip',
      ext: 'srt',
    };
  }

  if (opts.kind === 'json') {
    const json = JSON.stringify(payload, null, 2);
    return {
      fileName: `${base}.json`,
      content: json,
      mime: 'application/json',
      ext: 'json',
    };
  }

  // txt
  const lines: string[] = [];
  if (payload.title) lines.push(payload.title, '');
  if (payload.hashtags?.length) lines.push(payload.hashtags.map((t) => '#' + t).join(' '), '');
  if (payload.body) lines.push(payload.body);
  if (opts.kind === 'txt') {
    // 字幕文本按行输出（不带时间戳由调用方决定，这里带时间戳由 UI 层切换）
  }
  return {
    fileName: `${base}.txt`,
    content: cleanupText(lines.join('\n')),
    mime: 'text/plain',
    ext: 'txt',
  };
}

/** 字幕导出 TXT（可选带时间戳） */
export function exportSubtitlesTxt(cues: SubtitleCue[], withTimestamp: boolean): string {
  return cues
    .map((c) => (withTimestamp ? `[${formatClock(c.start)} - ${formatClock(c.end)}] ${c.text}` : c.text))
    .join('\n');
}

export function triggerExport(opts: ExportOptions): void {
  triggerDownload(opts.fileName, opts.content, opts.mime);
}

export function sourceName(source: TextPayload['source']): string {
  switch (source) {
    case 'caption': return '发布文案';
    case 'subtitle': return '原始字幕';
    case 'asr': return '口播转写';
    case 'combined': return '统一整理稿';
    default: return '文本';
  }
}

export { triggerDownload };
