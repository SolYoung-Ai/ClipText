import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import { ToastProvider } from './Toast';
import { DEFAULT_PARSER_SETTINGS } from '../core/constants';
import type { ParseResult } from '../core/types';

const result: ParseResult = {
  success: true,
  platform: 'douyin',
  canonicalUrl: 'https://www.douyin.com/video/123',
  title: '测试视频',
  description: '',
  hashtags: [],
  author: null,
  coverUrl: '',
  videoUrl: 'https://api-play-hl.amemv.com/aweme/v1/play/?video_id=abc',
  videoUrls: [],
  audioUrl: '',
  subtitles: [],
  duration: null,
  images: [],
  rawKeys: [],
  errorCode: null,
  errorMessage: null,
};

function renderCard() {
  render(
    <ToastProvider>
      <ResultCard result={result} onReparse={vi.fn()} />
    </ToastProvider>,
  );
}

function stubBrowserDownload() {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock'), configurable: true, writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(), configurable: true, writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

describe('ResultCard 下载视频', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('走解析服务的 /api/v1/download 代理，而不是已失效的 /api/v1/proxy', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return new Response(new Uint8Array(1024), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        });
      }),
    );
    stubBrowserDownload();

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: '下载视频' }));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].startsWith(DEFAULT_PARSER_SETTINGS.baseUrl)).toBe(true);
    expect(calls[0]).toContain('/api/v1/download?');
    expect(calls[0]).not.toContain('/api/v1/proxy');
    expect(calls[0]).toContain(encodeURIComponent(result.videoUrl));
    // 文件名必须带扩展名，否则下载到的是无法播放的无后缀文件
    expect(calls[0]).toContain('.mp4');
    await waitFor(() => expect(screen.getByText(/已保存/)).toBeTruthy());
  });

  it('代理返回 405 时显示真实错误，而不是「已开始下载」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<h1>Method Not Allowed</h1>', { status: 405 })),
    );
    stubBrowserDownload();

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: '下载视频' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('405');
    expect(screen.queryByText(/已保存/)).toBeNull();
  });
});
