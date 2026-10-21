import { HISTORY_ITEM_MAX_CHARS, HISTORY_LIMIT, STORAGE_KEYS } from './constants';
import type { HistoryItem, ParseResult } from './types';

/**
 * 本地历史记录模块（historyService）
 * 仅存 localStorage，不依赖任何账号系统；清除浏览器数据即消失（正常行为）。
 * 不保存 API Key；不长期保存已过期的媒体直链（仅存链接与摘要）。
 */

function load(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(items: HistoryItem[]): void {
  const capped = items.slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(capped));
  } catch {
    // 存储满时丢弃最旧条目再试
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(capped.slice(0, Math.floor(HISTORY_LIMIT / 2))));
    } catch {
      /* ignore quota errors */
    }
  }
}

export function addHistory(result: ParseResult): HistoryItem {
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: result.platform,
    title: (result.title || '(未获取标题)').slice(0, HISTORY_ITEM_MAX_CHARS),
    url: result.canonicalUrl.slice(0, HISTORY_ITEM_MAX_CHARS),
    parsedAt: new Date().toISOString(),
    success: result.success,
    summary: {
      hasVideo: Boolean(result.videoUrl || result.videoUrls.length),
      hasCaption: Boolean(result.title || result.description || result.hashtags.length),
      hasSubtitle: Array.isArray(result.subtitles) && result.subtitles.length > 0,
      hasAudio: Boolean(result.audioUrl),
      hasCover: Boolean(result.coverUrl),
    },
    errorMessage: result.errorMessage ?? undefined,
  };
  const items = [item, ...load()].slice(0, HISTORY_LIMIT);
  save(items);
  return item;
}

export function addFailedHistory(platform: HistoryItem['platform'], url: string, errorMessage: string): HistoryItem {
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform,
    title: '(解析失败)',
    url: url.slice(0, HISTORY_ITEM_MAX_CHARS),
    parsedAt: new Date().toISOString(),
    success: false,
    summary: { hasVideo: false, hasCaption: false, hasSubtitle: false, hasAudio: false, hasCover: false },
    errorMessage: errorMessage.slice(0, 300),
  };
  const items = [item, ...load()].slice(0, HISTORY_LIMIT);
  save(items);
  return item;
}

export function listHistory(): HistoryItem[] {
  return load();
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  const next = load().filter((i) => i.id !== id);
  save(next);
  return next;
}

export function clearHistory(): HistoryItem[] {
  save([]);
  return [];
}
