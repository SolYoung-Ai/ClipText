import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/Toast';
import { HomePage } from '../pages/HomePage';

beforeEach(() => {
  localStorage.clear();
});

function seedParserSettings() {
  localStorage.setItem(
    'cliptext.settings.v1',
    JSON.stringify({ baseUrl: 'https://mp.example.com', apiPath: '/api/v1/parse', authMode: 'none', timeoutMs: 5000 }),
  );
}

const okBody = {
  retcode: 200,
  retdesc: '成功',
  succ: true,
  data: {
    platform: '抖音',
    title: '真实接口返回的标题',
    desc: '真实接口返回的文案 #话题',
    video_url: 'https://cdn.example.com/v.mp4',
    cover_url: 'https://cdn.example.com/c.jpg',
    author: { nickname: '作者甲' },
    subtitles: [
      { start: 0.5, end: 2.0, text: '字幕第一句' },
      { start: 2.1, end: 4.0, text: '字幕第二句' },
    ],
  },
};

function renderHome() {
  return render(
    <ToastProvider>
      <HomePage />
    </ToastProvider>,
  );
}

describe('HomePage 解析全流程', () => {
  it('空链接提交：按钮禁用，回车时给出明确错误', async () => {
    renderHome();
    const btn = screen.getByRole('button', { name: '解析视频' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.keyDown(screen.getByLabelText('视频分享链接输入框'), { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(screen.getByText(/请先粘贴或输入分享链接/)).toBeInTheDocument();
    });
  });

  it('解析成功后展示真实结果卡片（标题/文案/字幕）', async () => {
    seedParserSettings();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 })),
    );
    renderHome();
    fireEvent.change(screen.getByLabelText('视频分享链接输入框'), {
      target: { value: 'https://v.douyin.com/abc123/' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析视频' }));
    await waitFor(() => {
      expect(screen.getByText('真实接口返回的标题')).toBeInTheDocument();
    });
    expect(screen.getByText('真实接口返回的文案 #话题')).toBeInTheDocument();
    // 字幕标签可用
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /原始字幕/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: /原始字幕/ }));
    expect(screen.getByText('字幕第一句')).toBeInTheDocument();
    expect(screen.getByText('字幕第二句')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('解析失败显示具体错误而非通用提示', async () => {
    seedParserSettings();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ retcode: 400, retdesc: '链接已过期', data: null, error_code: 'LINK_EXPIRED', succ: false }),
          { status: 400 },
        ),
      ),
    );
    renderHome();
    fireEvent.change(screen.getByLabelText('视频分享链接输入框'), {
      target: { value: 'https://v.douyin.com/expired/' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析视频' }));
    await waitFor(() => {
      expect(screen.getByText(/链接已过期/)).toBeInTheDocument();
    });
    vi.unstubAllGlobals();
  });

  it('未配置解析服务时给出明确引导', async () => {
    renderHome();
    fireEvent.change(screen.getByLabelText('视频分享链接输入框'), {
      target: { value: 'https://v.douyin.com/abc/' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析视频' }));
    await waitFor(() => {
      expect(screen.getByText(/尚未配置解析服务/)).toBeInTheDocument();
    });
  });

  it('解析成功后写入历史记录', async () => {
    seedParserSettings();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 })),
    );
    renderHome();
    fireEvent.change(screen.getByLabelText('视频分享链接输入框'), {
      target: { value: 'https://v.douyin.com/abc123/' },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析视频' }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('cliptext.history.v1') ?? '[]')).toHaveLength(1);
    });
    vi.unstubAllGlobals();
  });
});
