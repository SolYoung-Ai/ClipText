import { describe, expect, it, vi } from 'vitest';
import {
  classifyAsrError,
  fetchMediaFileViaProxy,
  isAcceptedFile,
  transcribeFile,
  transcribeFromUrl,
} from './speechToTextService';
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

  it('后端缺少 faster-whisper 时给出可读提示，而不是抛原始堆栈', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><h1>Internal Server Error</h1><p>转写失败：No module named 'faster_whisper'</p>", {
          status: 500,
        }),
      ),
    );
    await expect(transcribeFile(makeFile('a.mp3'), settings)).rejects.toMatchObject({
      code: 'ASR_FAILED',
      message: expect.stringContaining('未安装语音识别引擎'),
    });
    vi.unstubAllGlobals();
  });

  it('扩展名校验', () => {
    expect(isAcceptedFile(makeFile('a.mp4'))).toBe(true);
    expect(isAcceptedFile(makeFile('a.wav'))).toBe(true);
    expect(isAcceptedFile(makeFile('a.txt'))).toBe(false);
    expect(isAcceptedFile(makeFile('a'))).toBe(false);
  });
});

describe('transcribeFromUrl（后端直连下载转写）', () => {
  it('成功时返回转写文本', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '这是口播内容' }), { status: 200 })),
    );
    const out = await transcribeFromUrl('https://sns-video.xhscdn.com/a.mp4', settings);
    expect(out.text).toBe('这是口播内容');
    const [url] = vi.mocked(fetch).mock.calls[0] as unknown as [string];
    expect(url).toBe('https://asr.example.com/v1/api/v1/asr-from-url');
    vi.unstubAllGlobals();
  });

  it('平台 CDN 拦截（502 + 下载失败）→ DOWNLOAD_FAILED，便于上层改用代理', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"下载视频失败: HTTP 403"}', { status: 502 })),
    );
    await expect(transcribeFromUrl('https://sns-video.xhscdn.com/a.mp4', settings)).rejects.toMatchObject({
      code: 'DOWNLOAD_FAILED',
    });
    vi.unstubAllGlobals();
  });

  it('认证失败 → AUTH_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })));
    await expect(transcribeFromUrl('https://x.com/a.mp4', settings)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    vi.unstubAllGlobals();
  });
});

describe('fetchMediaFileViaProxy（媒体代理取回视频）', () => {
  it('拼接代理地址并返回可上传的 File', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(2048), { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
      ),
    );
    const out = await fetchMediaFileViaProxy({
      proxyBaseUrl: 'https://media.example.com/',
      mediaUrl: 'https://sns-video.xhscdn.com/xxx.mp4',
      fileName: '口播素材',
    });
    expect(out.file.name).toBe('口播素材.mp4');
    expect(out.file.size).toBe(2048);
    expect(out.sizeMB).toBeGreaterThan(0);
    const [url] = vi.mocked(fetch).mock.calls[0] as unknown as [string];
    expect(url.startsWith('https://media.example.com/api/v1/download?')).toBe(true);
    expect(decodeURIComponent(url)).toContain('https://sns-video.xhscdn.com/xxx.mp4');
    vi.unstubAllGlobals();
  });

  it('代理返回 403 → DOWNLOAD_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('域名不在白名单', { status: 403 })));
    await expect(
      fetchMediaFileViaProxy({ proxyBaseUrl: 'https://media.example.com', mediaUrl: 'https://a.com/b.mp4' }),
    ).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
    vi.unstubAllGlobals();
  });

  it('未配置解析服务 → SERVICE_NOT_CONFIGURED', async () => {
    await expect(
      fetchMediaFileViaProxy({ proxyBaseUrl: '  ', mediaUrl: 'https://a.com/b.mp4' }),
    ).rejects.toMatchObject({ code: 'SERVICE_NOT_CONFIGURED' });
  });
});

describe('classifyAsrError', () => {
  it('平台 CDN 拦截（403 + 下载失败）归类为 download 并给出降级引导', () => {
    const cls = classifyAsrError(502, '{"error":"下载视频失败: HTTP 403"}');
    expect(cls.kind).toBe('download');
    expect(cls.userHint).toContain('本地视频文件上传');
  });

  it('纯 502 网关错误归类为 download', () => {
    const cls = classifyAsrError(502, 'bad gateway');
    expect(cls.kind).toBe('download');
  });

  it('401 认证失败归类为 auth', () => {
    const cls = classifyAsrError(401, 'unauthorized');
    expect(cls.kind).toBe('auth');
  });

  it('413 归类为 server', () => {
    const cls = classifyAsrError(413, 'payload too large');
    expect(cls.kind).toBe('server');
  });

  it('网络异常归类为 network', () => {
    const cls = classifyAsrError(0, 'network request failed');
    expect(cls.kind).toBe('network');
  });
});
