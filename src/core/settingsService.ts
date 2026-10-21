import { DEFAULT_ASR_SETTINGS, DEFAULT_PARSER_SETTINGS, STORAGE_KEYS } from './constants';
import type { AsrSettings, AuthMode, ParserSettings } from './types';

/**
 * 设置管理模块（settingsService）
 * - API Key 默认仅保存在会话内存（不落盘）。
 * - 仅当用户明确选择「浏览器本地持久化」时才写入 localStorage。
 */
const sessionKeys = new Map<string, string>();

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function loadParserSettings(): ParserSettings {
  const base = safeParse<ParserSettings>(
    localStorage.getItem(STORAGE_KEYS.settings),
    { ...DEFAULT_PARSER_SETTINGS },
  );
  // API Key 从会话内存读取（默认不落盘）
  const persisted = localStorage.getItem(STORAGE_KEYS.persistKey) === 'true';
  if (persisted) {
    base.apiKey = localStorage.getItem(STORAGE_KEYS.settings + '.key') ?? '';
  } else {
    base.apiKey = sessionKeys.get('parserKey') ?? '';
  }
  if (![ 'none', 'key', 'bearer' ].includes(base.authMode)) base.authMode = 'none';
  return base;
}

export function saveParserSettings(s: ParserSettings, persistKey: boolean): void {
  const { apiKey, ...rest } = s;
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(rest));
  if (persistKey) {
    localStorage.setItem(STORAGE_KEYS.persistKey, 'true');
    localStorage.setItem(STORAGE_KEYS.settings + '.key', apiKey ?? '');
  } else {
    localStorage.removeItem(STORAGE_KEYS.persistKey);
    localStorage.removeItem(STORAGE_KEYS.settings + '.key');
    sessionKeys.set('parserKey', apiKey ?? '');
  }
}

export function clearParserKey(): void {
  sessionKeys.delete('parserKey');
  localStorage.removeItem(STORAGE_KEYS.settings + '.key');
  localStorage.removeItem(STORAGE_KEYS.persistKey);
}

export function getSessionParserKey(): string {
  return sessionKeys.get('parserKey') ?? '';
}

export function loadAsrSettings(): AsrSettings {
  const persisted = localStorage.getItem(STORAGE_KEYS.persistKey) === 'true';
  const base = safeParse<AsrSettings>(
    localStorage.getItem(STORAGE_KEYS.asrSettings),
    { ...DEFAULT_ASR_SETTINGS },
  );
  if (persisted) {
    base.apiKey = localStorage.getItem(STORAGE_KEYS.asrSettings + '.key') ?? '';
  } else {
    base.apiKey = sessionKeys.get('asrKey') ?? '';
  }
  return base;
}

export function saveAsrSettings(s: AsrSettings): void {
  const { apiKey, persistKey, ...rest } = s;
  localStorage.setItem(STORAGE_KEYS.asrSettings, JSON.stringify(rest));
  if (persistKey) {
    localStorage.setItem(STORAGE_KEYS.persistKey, 'true');
    localStorage.setItem(STORAGE_KEYS.asrSettings + '.key', apiKey ?? '');
  } else {
    sessionKeys.set('asrKey', apiKey ?? '');
  }
}

export function clearAsrSettings(): void {
  localStorage.removeItem(STORAGE_KEYS.asrSettings);
  localStorage.removeItem(STORAGE_KEYS.asrSettings + '.key');
  sessionKeys.delete('asrKey');
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(12, key.length - 8))}${key.slice(-4)}`;
}

export function isAuthModeValid(mode: string): mode is AuthMode {
  return mode === 'none' || mode === 'key' || mode === 'bearer';
}
