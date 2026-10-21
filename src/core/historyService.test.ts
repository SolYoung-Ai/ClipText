import { describe, expect, it, beforeEach } from 'vitest';
import { addFailedHistory, addHistory, clearHistory, deleteHistoryItem, listHistory } from './historyService';
import type { ParseResult } from './types';

function makeResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    success: true,
    platform: 'douyin',
    canonicalUrl: 'https://v.douyin.com/abc/',
    title: '测试标题',
    description: '测试文案',
    hashtags: [],
    author: null,
    coverUrl: '',
    videoUrl: 'https://cdn/v.mp4',
    videoUrls: [],
    audioUrl: '',
    subtitles: [{ start: 0, end: 1, text: '字幕' }],
    duration: 10,
    images: [],
    rawKeys: [],
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('historyService', () => {
  it('添加成功历史并记录摘要', () => {
    addHistory(makeResult());
    const items = listHistory();
    expect(items).toHaveLength(1);
    expect(items[0].success).toBe(true);
    expect(items[0].summary.hasVideo).toBe(true);
    expect(items[0].summary.hasSubtitle).toBe(true);
    expect(items[0].summary.hasCaption).toBe(true);
  });

  it('添加失败历史', () => {
    addFailedHistory('wechat', 'https://weixin.qq.com/sph/abc', '链接已过期');
    const items = listHistory();
    expect(items[0].success).toBe(false);
    expect(items[0].errorMessage).toBe('链接已过期');
    expect(items[0].summary.hasVideo).toBe(false);
  });

  it('删除单条', () => {
    addHistory(makeResult());
    addHistory(makeResult({ title: '第二条', canonicalUrl: 'https://v.douyin.com/def/' }));
    const items = listHistory(); // [第二条, 第一条]
    deleteHistoryItem(items[1].id); // 删除第一条
    const rest = listHistory();
    expect(rest).toHaveLength(1);
    expect(rest[0].title).toBe('第二条');
  });

  it('清空全部', () => {
    addHistory(makeResult());
    clearHistory();
    expect(listHistory()).toEqual([]);
  });

  it('上限截断（最多 100 条）', () => {
    for (let i = 0; i < 120; i++) {
      addHistory(makeResult({ title: `标题${i}`, canonicalUrl: `https://v.douyin.com/${i}/` }));
    }
    const items = listHistory();
    expect(items.length).toBeLessThanOrEqual(100);
    // 最新在前
    expect(items[0].title).toBe('标题119');
  });

  it('不保存 API Key（历史项结构中无 key 字段）', () => {
    addHistory(makeResult());
    const item = listHistory()[0];
    expect('apiKey' in item).toBe(false);
  });
});
