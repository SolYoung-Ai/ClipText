import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDownloadFileName,
  buildProxyDownloadUrl,
  guessExt,
  saveVideoViaProxy,
} from './downloadManager';

describe('downloadManager', () => {
  it('文件名包含平台与标题并清除非法字符', () => {
    const name = buildDownloadFileName('douyin', '视频标题 含/非法:字符?*', 'mp4');
    expect(name).toContain('抖音');
    expect(name).toContain('视频标题 含_非法_字符_');
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name.endsWith('.mp4')).toBe(true);
  });

  it('空标题使用占位', () => {
    expect(buildDownloadFileName('wechat', '', 'mp4')).toContain('video.mp4');
  });

  it('从 URL 猜测扩展名', () => {
    expect(guessExt('https://cdn.example.com/video.mp4?x=1')).toBe('mp4');
    expect(guessExt('https://cdn.example.com/video.mov')).toBe('mov');
    expect(guessExt('https://cdn.example.com/video')).toBe('mp4');
    expect(guessExt('https://cdn.example.com/video.m3u8')).toBe('mp4');
  });

  it('平台名称映射', () => {
    expect(buildDownloadFileName('xiaohongshu', '笔记', 'mov')).toContain('小红书');
    expect(buildDownloadFileName('wechat', '视频', 'mp4')).toContain('视频号');
  });

  it('代理下载地址拼接并编码媒体 URL', () => {
    const url = buildProxyDownloadUrl(
      'http://localhost:8051',
      'https://cdn.example.com/video.mp4?a=1&b=2',
      '抖音_暴雨.mp4',
    );
    expect(url).toContain('http://localhost:8051/api/v1/download');
    expect(url).toContain('url=https%3A%2F%2Fcdn.example.com%2Fvideo.mp4%3Fa%3D1%26b%3D2');
    expect(url).toContain('name=' + encodeURIComponent('抖音_暴雨.mp4'));
  });

  it('Base URL 末尾斜杠会被清理', () => {
    const url = buildProxyDownloadUrl('https://mp.example.com/', 'https://cdn.example.com/a.mp4');
    expect(url.startsWith('https://mp.example.com/api/v1/download')).toBe(true);
  });
});

describe('saveVideoViaProxy', () => {
  const opts = {
    proxyBaseUrl: 'https://media-parser.example.com',
    mediaUrl: 'https://cdn.example.com/a.mp4?x=1',
    fileName: '抖音_测试.mp4',
  };

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock'), configurable: true, writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(), configurable: true, writable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('请求 /api/v1/download 且带完整文件名，成功后保存为本地文件', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(2048), { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await saveVideoViaProxy(opts);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('https://media-parser.example.com/api/v1/download');
    expect(calledUrl).toContain('name=' + encodeURIComponent('抖音_测试.mp4'));
    expect(out.kind).toBe('saved');
    expect(out.sizeMB).toBeGreaterThan(0);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('HTTP 405 时抛出可读错误，不会假装下载成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<h1>Method Not Allowed</h1>', { status: 405 }),
    ));
    await expect(saveVideoViaProxy(opts)).rejects.toThrow(/405/);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('空文件视为失败', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array(0), { status: 200 }),
    ));
    await expect(saveVideoViaProxy(opts)).rejects.toThrow(/空文件/);
  });
});
