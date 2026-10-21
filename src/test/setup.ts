import '@testing-library/jest-dom/vitest';

// jsdom 环境下 clipboard 不可用，统一 mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  configurable: true,
});

// 默认 mock URL.createObjectURL / revokeObjectURL（jsdom 未实现）
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
}
