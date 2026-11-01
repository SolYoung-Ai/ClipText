import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AsrPanel } from './AsrPanel';
import { ToastProvider } from './Toast';
import type { AsrSettings } from '../core/types';

const settings: AsrSettings = {
  baseUrl: 'https://media-parser.example.com',
  apiPath: '/v1/audio/transcriptions',
  apiKey: '',
  model: 'tiny',
  language: 'zh',
  persistKey: false,
};

const MEDIA = 'https://sns-video.xhscdn.com/abc.mp4';

function renderPanel(onTranscribed = vi.fn()) {
  render(
    <ToastProvider>
      <AsrPanel
        settings={settings}
        onTranscribed={onTranscribed}
        hasSubtitle={false}
        mediaUrl={MEDIA}
        mediaProxyBaseUrl="https://media-parser.example.com"
      />
    </ToastProvider>,
  );
  return onTranscribed;
}

describe('AsrPanel 一键提取口播文案', () => {
  it('后端直连下载被拦截时，自动改走媒体代理并上传转写', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes('/api/v1/asr-from-url')) {
          return new Response('{"error":"下载视频失败: HTTP 403"}', { status: 502 });
        }
        if (String(url).includes('/api/v1/download')) {
          return new Response(new Uint8Array(2048), { status: 200, headers: { 'Content-Type': 'video/mp4' } });
        }
        return new Response(JSON.stringify({ text: '这是从视频里识别出来的口播文案' }), { status: 200 });
      }),
    );

    const onTranscribed = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /一键提取口播文案/ }));

    await waitFor(() => expect(onTranscribed).toHaveBeenCalledWith('这是从视频里识别出来的口播文案'));

    // 三条链路依次发生：后端直连 → 媒体代理 → 文件上传转写
    expect(calls[0]).toContain('/api/v1/asr-from-url');
    expect(calls[1]).toContain('/api/v1/download');
    expect(calls[2]).toBe('https://media-parser.example.com/v1/audio/transcriptions');
    vi.unstubAllGlobals();
  });

  it('后端直连成功时不再走代理，节省一次下载', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ text: '直连转写成功' }), { status: 200 });
      }),
    );

    const onTranscribed = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /一键提取口播文案/ }));
    await waitFor(() => expect(onTranscribed).toHaveBeenCalledWith('直连转写成功'));
    expect(calls).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('所有自动路径失败时给出兜底引导，而不是只显示一句报错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/api/v1/download')
          ? new Response('域名不在白名单', { status: 403 })
          : new Response('{"error":"下载视频失败: HTTP 403"}', { status: 502 }),
      ),
    );

    const onTranscribed = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /一键提取口播文案/ }));

    await waitFor(() => expect(screen.getByText(/都没能取到视频/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /选择本地视频文件转写/ })).toBeInTheDocument();
    expect(onTranscribed).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
