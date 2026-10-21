import { describe, expect, it } from 'vitest';
import { extractUrlFromText, isValidHttpUrl } from './urlNormalizer';

describe('urlNormalizer', () => {
  it('空输入', () => {
    expect(extractUrlFromText('')).toEqual({ ok: false, url: '', reason: 'EMPTY' });
    expect(extractUrlFromText('   ')).toEqual({ ok: false, url: '', reason: 'EMPTY' });
  });

  it('普通无关文本（无链接）', () => {
    expect(extractUrlFromText('今天天气不错')).toEqual({ ok: false, url: '', reason: 'NO_URL' });
    expect(extractUrlFromText('hello world 123')).toEqual({ ok: false, url: '', reason: 'NO_URL' });
  });

  it('格式错误的 URL（非 http/https）', () => {
    expect(extractUrlFromText('ftp://example.com/video')).toEqual({ ok: false, url: '', reason: 'INVALID_PROTOCOL' });
    expect(extractUrlFromText('https://')).toEqual({ ok: false, url: '', reason: 'INVALID_URL' });
  });

  it('直接完整 URL', () => {
    const r = extractUrlFromText('https://v.douyin.com/abc123/');
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://v.douyin.com/abc123/');
  });

  it('分享文字中包含链接', () => {
    const r = extractUrlFromText('6.66 复制打开抖音，看看【xx的作品】https://v.douyin.com/abc123/ 复制此链接');
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://v.douyin.com/abc123/');
  });

  it('链接后带中文标点', () => {
    expect(extractUrlFromText('https://v.douyin.com/abc123/。').url).toBe('https://v.douyin.com/abc123/');
    expect(extractUrlFromText('https://xhslink.com/a/abc，快来看').url).toBe('https://xhslink.com/a/abc');
    expect(extractUrlFromText('https://v.douyin.com/abc123/，').url).toBe('https://v.douyin.com/abc123/');
  });

  it('链接后带英文标点', () => {
    expect(extractUrlFromText('https://v.douyin.com/abc123/.').url).toBe('https://v.douyin.com/abc123/');
    expect(extractUrlFromText('https://v.douyin.com/abc123/?foo=1&bar=2').url).toContain('?foo=1&bar=2');
  });

  it('超长链接仍能识别', () => {
    const long = 'https://v.douyin.com/' + 'a'.repeat(500) + '/';
    const r = extractUrlFromText(long);
    expect(r.ok).toBe(true);
    expect(r.url).toHaveLength(long.length);
  });

  it('isValidHttpUrl 判断', () => {
    expect(isValidHttpUrl('https://v.douyin.com/abc/')).toBe(true);
    expect(isValidHttpUrl('http://xhslink.com/a/abc')).toBe(true);
    expect(isValidHttpUrl('随便的文字')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});
