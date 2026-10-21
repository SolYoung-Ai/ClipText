import { describe, expect, it } from 'vitest';
import { buildSrt, exportPayload, exportSubtitlesTxt, formatSrtTimestamp } from './exportService';
import type { SubtitleCue, TextPayload } from './types';

const cues: SubtitleCue[] = [
  { start: 0.5, end: 2.1, text: '第一句字幕' },
  { start: 2.2, end: 4.0, text: '第二句字幕' },
];

const captionPayload: TextPayload = {
  source: 'caption',
  available: true,
  title: '标题',
  body: '正文内容',
  hashtags: ['话题A', '话题B'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('exportService', () => {
  it('SRT 时间戳格式', () => {
    expect(formatSrtTimestamp(0.5)).toBe('00:00:00,500');
    expect(formatSrtTimestamp(61.25)).toBe('00:01:01,250');
    expect(formatSrtTimestamp(3661)).toBe('01:01:01,000');
  });

  it('SRT 遵循真实字幕格式（序号 + 时间轴 + 文本）', () => {
    const srt = buildSrt(cues);
    expect(srt).toContain('1\n00:00:00,500 --> 00:00:02,100\n第一句字幕');
    expect(srt).toContain('2\n00:00:02,200 --> 00:00:04,000\n第二句字幕');
    expect(srt).toMatch(/^1\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n.+\n\n2\n/m);
  });

  it('导出 TXT 组合标题/标签/正文', () => {
    const opt = exportPayload(captionPayload, { kind: 'txt' });
    expect(opt.ext).toBe('txt');
    expect(opt.fileName.endsWith('.txt')).toBe(true);
    expect(opt.content).toContain('标题');
    expect(opt.content).toContain('#话题A #话题B');
    expect(opt.content).toContain('正文内容');
  });

  it('导出 JSON 保留结构与换行', () => {
    const opt = exportPayload(captionPayload, { kind: 'json' });
    const parsed = JSON.parse(opt.content);
    expect(parsed.source).toBe('caption');
    expect(parsed.title).toBe('标题');
    expect(parsed.body).toBe('正文内容');
    expect(parsed.hashtags).toEqual(['话题A', '话题B']);
  });

  it('字幕 TXT 时间戳开关', () => {
    const withTs = exportSubtitlesTxt(cues, true);
    expect(withTs).toContain('[00:00.5 - 00:02.1] 第一句字幕');
    const withoutTs = exportSubtitlesTxt(cues, false);
    expect(withoutTs).toBe('第一句字幕\n第二句字幕');
  });

  it('未取得数据时导出内容为空但结构可生成', () => {
    const empty: TextPayload = { source: 'caption', available: false, body: '', createdAt: '' };
    const opt = exportPayload(empty, { kind: 'txt' });
    expect(opt.content).toBe('');
  });
});
