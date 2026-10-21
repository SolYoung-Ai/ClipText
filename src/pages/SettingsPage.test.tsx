import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/Toast';
import { SettingsPage } from '../pages/SettingsPage';

function renderSettings() {
  return render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>,
  );
}

describe('SettingsPage', () => {
  it('空服务地址时测试连接给出明确提示', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(screen.getByText(/请先填写解析服务地址/)).toBeInTheDocument();
    });
  });
  it('连接测试使用真实请求并显示结果', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ retcode: 200, succ: true, data: { platform: '抖音' } }), { status: 200 }),
      ),
    );
    renderSettings();
    fireEvent.change(screen.getByLabelText('解析服务地址（Base URL）'), {
      target: { value: 'https://mp.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(screen.getByText(/服务可达/)).toBeInTheDocument();
    });
    vi.unstubAllGlobals();
  });

  it('连接失败显示具体原因', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderSettings();
    fireEvent.change(screen.getByLabelText('解析服务地址（Base URL）'), {
      target: { value: 'https://down.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(screen.getByText(/✕ 连接失败/)).toBeInTheDocument();
    });
    vi.unstubAllGlobals();
  });

  it('API Key 默认隐藏输入', () => {
    renderSettings();
    const keyInput = screen.getByLabelText('API Key（可选）') as HTMLInputElement;
    expect(keyInput.type).toBe('password');
  });
});
