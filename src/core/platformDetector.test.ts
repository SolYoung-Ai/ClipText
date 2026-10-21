import { describe, expect, it } from 'vitest';
import { detectPlatform, isSupportedPlatform } from './platformDetector';

describe('platformDetector', () => {
  it('识别抖音常见域名模式', () => {
    expect(detectPlatform('https://v.douyin.com/abc123/')).toBe('douyin');
    expect(detectPlatform('https://www.douyin.com/video/7123456789')).toBe('douyin');
    expect(detectPlatform('https://www.iesdouyin.com/share/video/123/')).toBe('douyin');
  });

  it('识别小红书常见域名模式', () => {
    expect(detectPlatform('https://xhslink.com/a/abc123')).toBe('xiaohongshu');
    expect(detectPlatform('https://www.xiaohongshu.com/explore/abc123')).toBe('xiaohongshu');
    expect(detectPlatform('https://www.xiaohongshu.com/discovery/item/abc123')).toBe('xiaohongshu');
  });

  it('识别微信视频号域名模式', () => {
    expect(detectPlatform('https://weixin.qq.com/sph/Axv548mzBF')).toBe('wechat');
    expect(detectPlatform('https://channels.weixin.qq.com/xxxx')).toBe('wechat');
  });

  it('识别 B 站（预留）', () => {
    expect(detectPlatform('https://www.bilibili.com/video/BV1xx411c7mD')).toBe('bilibili');
    expect(detectPlatform('https://b23.tv/abc')).toBe('bilibili');
  });

  it('未知平台返回 unknown', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBe('unknown');
    expect(detectPlatform('https://example.com/video/1')).toBe('unknown');
  });

  it('无效 URL 返回 unknown', () => {
    expect(detectPlatform('not a url')).toBe('unknown');
  });

  it('isSupportedPlatform', () => {
    expect(isSupportedPlatform('https://v.douyin.com/abc/')).toBe(true);
    expect(isSupportedPlatform('https://www.youtube.com/watch?v=1')).toBe(false);
  });
});
