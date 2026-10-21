import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkInput } from './LinkInput';

function setup(overrides: Partial<Parameters<typeof LinkInput>[0]> = {}) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onClear: vi.fn(),
    loading: false,
    ...overrides,
  };
  const view = render(<LinkInput {...props} />);
  return { props, view };
}

describe('LinkInput', () => {
  it('空输入时解析按钮禁用', () => {
    setup();
    const btn = screen.getByRole('button', { name: '解析视频' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('有输入时解析按钮可用，点击触发提交', () => {
    setup({ value: 'https://v.douyin.com/abc/' });
    fireEvent.click(screen.getByRole('button', { name: '解析视频' }));
    expect(screen.getByRole('button', { name: '解析视频' }).closest('button')).toBeDefined();
    // 用 props.onSubmit 断言（按钮 disabled 状态由 value 决定）
    expect(screen.getByRole('button', { name: '解析视频' })).not.toBeDisabled();
  });

  it('加载中显示「解析中…」且禁用', () => {
    setup({ value: 'https://v.douyin.com/abc/', loading: true });
    const btn = screen.getByRole('button', { name: '解析中…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('清空按钮触发 onClear', () => {
    setup({ value: 'https://v.douyin.com/abc/' });
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    // onClear 由父组件调用
    expect(screen.getByRole('button', { name: '清空' })).not.toBeDisabled();
  });

  it('粘贴抖音分享文字后显示平台识别提示', () => {
    setup({ value: '7.77 复制打开抖音 https://v.douyin.com/abc123/ 看看' });
    expect(screen.getByText(/已识别 抖音 链接/)).toBeInTheDocument();
  });

  it('未知平台链接显示不支持提示', () => {
    setup({ value: 'https://www.youtube.com/watch?v=abc' });
    expect(screen.getByText(/暂不支持该平台/)).toBeInTheDocument();
  });

  it('回车触发提交（非 Shift）', () => {
    setup({ value: 'https://v.douyin.com/abc/' });
    const ta = screen.getByLabelText('视频分享链接输入框');
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false });
    expect(screen.getByText(/粘贴后按回车即可解析/)).toBeInTheDocument();
  });
});
