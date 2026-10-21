import { describe, expect, it, vi } from 'vitest';
import { isAcceptedFile, transcribeFile } from './speechToTextService';
import type { AsrSettings } from './types';

const settings: AsrSettings = {
  baseUrl: 'https://asr.example.com/v1',
  apiPath: '/audio/transcriptions',
  apiKey: 'key-1',
  model: 'whisper-1',
  language: 'zh',
  persistKey: false,
};

function makeFile(name: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'audio/mpeg' });
}

describe('speechToTextService', () => {
  it('未配置服务 → ASR_NOT_CONFIGURED', async () => {
    await expect(transcribeFile(makeFile('a.mp3'), { ...settings, baseUrl: '' })).rejects.toMatchObject({
      code: 'ASR_NOT_CONFIGURED',
    });
  });

  it('成功转录返回真实文本', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '今天天气不错' }), { status: 200 })),
    );
    const out = await transcribeFile(makeFile('a.mp3'), settings);
    expect(out.text).toBe('今天天气不错');
    expect(out.model).toBe('whisper-1');
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://asr.example.com/v1/audio/transcriptions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key-1');
    expect(init.body).toBeInstanceOf(FormData);
    vi.unstubAllGlobals();
  });

  it('认证失败错误映射', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(transcribeFile(makeFile('a.mp3'), settings)).rejects.toMatchObject({ code: 'ASR_FAILED' });
    vi.unstubAllGlobals();
  });

  it('文件过大（413）错误映射', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 413 })));
    await expect(transcribeFile(makeFile('a.mp3'), settings)).rejects.toMatchObject({ code: 'ASR_FILE_TOO_LARGE' });
    vi.unstubAllGlobals();
  });

  it('空结果报错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '  ' }), { status: 200 })));
    await expect(transcribeFile(makeFile('a.mp3'), settings)).rejects.toMatchObject({ code: 'ASR_FAILED' });
    vi.unstubAllGlobals();
  });

  it('扩展名校验', () => {
    expect(isAcceptedFile(makeFile('a.mp4'))).toBe(true);
    expect(isAcceptedFile(makeFile('a.wav'))).toBe(true);
    expect(isAcceptedFile(makeFile('a.txt'))).toBe(false);
    expect(isAcceptedFile(makeFile('a'))).toBe(false);
  });
});
