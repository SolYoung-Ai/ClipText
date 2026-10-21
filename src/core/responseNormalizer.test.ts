import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { normalizeParseResponse, downgradeNoVideo } from './responseNormalizer';

const okBody = {
  retcode: 200,
  retdesc: '成功',
  succ: true,
  data: {
    video_id: '123',
    platform: '抖音',
    title: '测试视频标题',
    desc: '测试文案 #测试话题',
    video_url: 'https://cdn.example.com/video.mp4',
    audio_url: 'https://cdn.example.com/audio.mp3',
    cover_url: 'https://cdn.example.com/cover.jpg',
    author: { nickname: '作者A', avatar: 'https://cdn.example.com/avatar.jpg' },
    subtitles: [
      { start: 0.5, end: 2.1, text: '第一句' },
      { start: 2.2, end: 4.0, text: '第二句' },
    ],
  },
};

function norm(body: unknown, status = 200) {
  return normalizeParseResponse({ status, ok: status < 400, body, requestedUrl: 'https://v.douyin.com/x/' });
}

describe('responseNormalizer（media-parser 协议）', () => {
  it('标准成功响应 → 完整映射', () => {
    const r = norm(okBody);
    expect(r.success).toBe(true);
    expect(r.platform).toBe('douyin');
    expect(r.title).toBe('测试视频标题');
    expect(r.description).toBe('测试文案 #测试话题');
    expect(r.hashtags).toEqual(['测试话题']);
    expect(r.videoUrl).toContain('video.mp4');
    expect(r.videoUrls[0].url).toContain('video.mp4');
    expect(r.audioUrl).toContain('audio.mp3');
    expect(r.coverUrl).toContain('cover.jpg');
    expect(r.author?.name).toBe('作者A');
    expect(r.author?.avatar).toContain('avatar.jpg');
    expect(r.subtitles).toHaveLength(2);
    expect(r.subtitles[0]).toEqual({ start: 0.5, end: 2.1, text: '第一句' });
    expect(r.errorCode).toBeNull();
  });

  it('字段缺失 → null/空数组，不编造', () => {
    const r = norm({
      retcode: 200,
      succ: true,
      data: { platform: '小红书', title: '只有标题' },
    });
    expect(r.title).toBe('只有标题');
    expect(r.description).toBe('');
    expect(r.videoUrl).toBe('');
    expect(r.videoUrls).toEqual([]);
    expect(r.coverUrl).toBe('');
    expect(r.author).toBeNull();
    expect(r.subtitles).toEqual([]);
    expect(r.duration).toBeNull();
    expect(r.platform).toBe('xiaohongshu');
  });

  it('平台字符串映射（含回退到链接识别）', () => {
    expect(norm({ ...okBody, data: { platform: '视频号' } }).platform).toBe('wechat');
    expect(norm({ ...okBody, data: { platform: 'B站' } }).platform).toBe('bilibili');
    // 无 platform 字段时回退到链接域名
    expect(norm({ retcode: 200, succ: true, data: { title: 'x' } }).platform).toBe('douyin');
  });

  it('错误响应（succ=false）→ 具体错误码', () => {
    try {
      norm({
        retcode: 400,
        retdesc: '该链接尚未支持提取 / 解析失败',
        data: null,
        error_code: 'PLATFORM_NOT_SUPPORTED',
        succ: false,
      });
      expect.unreachable();
    } catch (e) {
      const err = e as AppError;
      expect(err.code).toBe('PLATFORM_NOT_SUPPORTED');
    }
  });

  it('链接过期错误映射', () => {
    try {
      norm({ retcode: 400, retdesc: '链接已过期', data: null, error_code: 'LINK_EXPIRED', succ: false });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('LINK_EXPIRED');
    }
  });

  it('HTTP 500 → SERVICE_UNAVAILABLE', () => {
    try {
      norm({}, 500);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('SERVICE_UNAVAILABLE');
    }
  });

  it('HTTP 401 → AUTH_FAILED', () => {
    try {
      norm({}, 401);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('AUTH_FAILED');
    }
  });

  it('非 JSON 响应 → RESPONSE_MALFORMED', () => {
    try {
      norm('<html>oops</html>');
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('RESPONSE_MALFORMED');
    }
  });

  it('未知结构 → RESPONSE_MALFORMED', () => {
    try {
      norm({ hello: 'world' });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('RESPONSE_MALFORMED');
    }
  });

  it('兼容 {code, message, data} 形态', () => {
    const r = norm({ code: 200, message: 'ok', data: { platform: '抖音', title: '兼容形态', video_url: 'https://x.mp4' } });
    expect(r.success).toBe(true);
    expect(r.title).toBe('兼容形态');
    expect(r.videoUrl).toBe('https://x.mp4');
  });

  it('多视频列表映射且不重复主视频', () => {
    const r = norm({
      retcode: 200,
      succ: true,
      data: {
        platform: '抖音',
        video_url: 'https://a.mp4',
        video_list: ['https://a.mp4', 'https://b.mp4', 'https://c.mp4'],
      },
    });
    expect(r.videoUrls).toHaveLength(3);
    expect(r.videoUrls[0].url).toBe('https://a.mp4');
  });

  it('downgradeNoVideo：无视频地址时给出明确降级', () => {
    const r = norm({ retcode: 200, succ: true, data: { platform: '抖音', title: '无视频' } });
    const d = downgradeNoVideo(r);
    expect(d.errorCode).toBe('NO_VIDEO_URL');
  });
});
