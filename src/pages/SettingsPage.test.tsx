import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('渲染本地数据管理区块', () => {
    renderSettings();
    expect(screen.getByText('本地数据管理')).toBeInTheDocument();
  });

  it('渲染清空解析历史按钮', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: '清空解析历史' })).toBeInTheDocument();
  });

  it('渲染隐私说明折叠面板', () => {
    renderSettings();
    expect(screen.getByText('查看隐私与数据处理说明')).toBeInTheDocument();
  });
});
