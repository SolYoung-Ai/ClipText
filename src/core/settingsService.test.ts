import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearAsrSettings,
  clearParserKey,
  loadAsrSettings,
  loadParserSettings,
  maskKey,
  saveAsrSettings,
  saveParserSettings,
} from './settingsService';

beforeEach(() => {
  localStorage.clear();
});

describe('settingsService', () => {
  it('默认不持久化 API Key：Key 不落盘，仅存会话内存', () => {
    saveParserSettings({ baseUrl: 'https://mp.x.com', apiPath: '/api/v1/parse', authMode: 'key', apiKey: 'secret-123', timeoutMs: 20000 }, false);
    // 1) 存储的配置 JSON 中绝不含 Key
    const stored = localStorage.getItem('cliptext.settings.v1');
    expect(stored).not.toContain('secret-123');
    // 2) 同一会话内（内存）仍可取回 Key
    expect(loadParserSettings().apiKey).toBe('secret-123');
    // 3) 模拟新会话：清除内存中的 Key 后取回为空
    clearParserKey();
    expect(loadParserSettings().apiKey).toBe('');
    expect(loadParserSettings().baseUrl).toBe('https://mp.x.com');
  });

  it('用户明确选择持久化后才写入 Key', () => {
    saveParserSettings({ baseUrl: 'https://mp.x.com', apiPath: '/api/v1/parse', authMode: 'bearer', apiKey: 'secret-456', timeoutMs: 20000 }, true);
    expect(localStorage.getItem('cliptext.allowKeyPersist.v1')).toBe('true');
    expect(localStorage.getItem('cliptext.settings.v1.key')).toBe('secret-456');
    const loaded = loadParserSettings();
    expect(loaded.apiKey).toBe('secret-456');
  });

  it('清除 Key 配置', () => {
    saveParserSettings({ baseUrl: 'https://mp.x.com', apiPath: '/api/v1/parse', authMode: 'key', apiKey: 'secret', timeoutMs: 20000 }, true);
    clearParserKey();
    expect(loadParserSettings().apiKey).toBe('');
    expect(localStorage.getItem('cliptext.settings.v1.key')).toBeNull();
  });

  it('maskKey 脱敏', () => {
    expect(maskKey('')).toBe('');
    expect(maskKey('abc')).toBe('•••');
    expect(maskKey('mp-1234567890')).toContain('•');
    expect(maskKey('mp-1234567890')).toContain('7890');
    expect(maskKey('mp-1234567890')).not.toContain('mp-1234');
  });

  it('ASR 设置保存/加载/清除', () => {
    saveAsrSettings({ baseUrl: 'https://asr.x.com/v1', apiPath: '/audio/transcriptions', apiKey: 'asr-key', model: 'whisper-1', language: 'zh', persistKey: false });
    const loaded = loadAsrSettings();
    expect(loaded.baseUrl).toBe('https://asr.x.com/v1');
    clearAsrSettings();
    expect(loadAsrSettings().baseUrl).toBe('');
  });
});
