import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { parseFromText } from './parserAdapter';
import type { ParserSettings } from './types';

const settings: ParserSettings = {
  baseUrl: 'https://mp.example.com',
  apiPath: '/api/v1/parse',
  authMode: 'none',
  apiKey: '',
  timeoutMs: 5000,
};

const okBody = {
  retcode: 200,
  retdesc: '成功',
  succ: true,
  data: {
    platform: '抖音',
    title: '标题',
    desc: '文案',
    video_url: 'https://cdn/v.mp4',
    cover_url: 'https://cdn/c.jpg',
    author: { nickname: '作者' },
  },
};

const mockFetcher = (body: unknown, status = 200) => async () => ({
  status,
  ok: status < 400,
  body,
  elapsedMs: 10,
});

describe('parserAdapter 全流程', () => {
  it('标准成功流程', async () => {
    const r = await parseFromText({
      text: '复制打开抖音 https://v.douyin.com/abc123/ 看看',
      settings,
      fetcher: mockFetcher(okBody),
    });
    expect(r.success).toBe(true);
    expect(r.platform).toBe('douyin');
    expect(r.title).toBe('标题');
  });

  it('空链接提交', async () => {
    await expect(parseFromText({ text: '', settings, fetcher: mockFetcher(okBody) })).rejects.toMatchObject({
      code: 'EMPTY_INPUT',
    });
    await expect(parseFromText({ text: '   ', settings, fetcher: mockFetcher(okBody) })).rejects.toMatchObject({
      code: 'EMPTY_INPUT',
    });
  });

  it('普通无关文本', async () => {
    await expect(parseFromText({ text: '今天天气很好', settings, fetcher: mockFetcher(okBody) })).rejects.toMatchObject({
      code: 'NO_URL',
    });
  });

  it('格式错误的 URL', async () => {
    await expect(parseFromText({ text: 'ftp://x.com/a', settings, fetcher: mockFetcher(okBody) })).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
  });

  it('未知平台链接', async () => {
    await expect(
      parseFromText({ text: 'https://www.youtube.com/watch?v=abc', settings, fetcher: mockFetcher(okBody) }),
    ).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });

  it('未配置解析服务', async () => {
    await expect(
      parseFromText({ text: 'https://v.douyin.com/abc/', settings: { ...settings, baseUrl: '' }, fetcher: mockFetcher(okBody) }),
    ).rejects.toMatchObject({ code: 'SERVICE_NOT_CONFIGURED' });
  });

  it('服务返回错误 → 透传错误码', async () => {
    await expect(
      parseFromText({
        text: 'https://v.douyin.com/abc/',
        settings,
        fetcher: mockFetcher({ retcode: 400, retdesc: '链接已失效', succ: false, error_code: 'LINK_EXPIRED' }, 400),
      }),
    ).rejects.toMatchObject({ code: 'LINK_EXPIRED' });
  });

  it('解析超时', async () => {
    const fetcher = async (): Promise<never> => {
      throw new AppError('TIMEOUT', '解析请求超时', { retryable: true });
    };
    await expect(parseFromText({ text: 'https://v.douyin.com/abc/', settings, fetcher })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('CORS 错误', async () => {
    const fetcher = async (): Promise<never> => {
      throw new AppError('CORS_ERROR', '跨域被拦截', { retryable: true });
    };
    await expect(parseFromText({ text: 'https://v.douyin.com/abc/', settings, fetcher })).rejects.toMatchObject({
      code: 'CORS_ERROR',
    });
  });

  it('不同服务返回结构映射（小红书形态）', async () => {
    const r = await parseFromText({
      text: 'https://xhslink.com/a/abc123',
      settings,
      fetcher: mockFetcher({
        code: 0,
        data: { platform: 'xiaohongshu', title: '笔记标题', desc: '笔记正文', video_url: 'https://cdn/x.mp4' },
      }),
    });
    expect(r.platform).toBe('xiaohongshu');
    expect(r.title).toBe('笔记标题');
    expect(r.videoUrl).toContain('x.mp4');
  });
});
