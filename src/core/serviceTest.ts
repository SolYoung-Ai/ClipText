import { requestParse } from './parserClient';
import { normalizeParseResponse } from './responseNormalizer';
import type { ConnectionTestResult, ParserSettings } from './types';

/**
 * 解析服务连接测试（serviceTest）
 * 使用真实请求验证连接，不允许仅凭输入框非空就显示「连接成功」。
 * 测试链接为抖音公开分享短链（仅用于连通性探测，不作为功能演示数据）。
 */

export const CONNECT_TEST_URL = 'https://v.douyin.com/connect-probe/';

export async function testParserConnection(settings: ParserSettings): Promise<ConnectionTestResult> {
  const testedAt = new Date().toISOString();
  if (!settings.baseUrl.trim()) {
    return { ok: false, message: '请先填写解析服务地址', testedAt };
  }
  try {
    const raw = await requestParse({
      url: settings.baseUrl,
      targetUrl: CONNECT_TEST_URL,
      settings,
      method: 'GET',
    });
    const message = `服务可达 · HTTP ${raw.status} · 响应耗时 ${raw.elapsedMs}ms`;
    // 尝试解析响应结构，判断协议是否兼容
    try {
      const result = normalizeParseResponse({
        status: raw.status,
        ok: raw.ok,
        body: raw.body,
        requestedUrl: CONNECT_TEST_URL,
      });
      return {
        ok: true,
        status: raw.status,
        retcode: 200,
        retdesc: '连接成功，协议兼容（解析返回结构正常）',
        message,
        testedAt,
        platform: result.platform,
      };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      // 服务可达但协议不兼容或链接被拒：仍标记为“已连接”，给出协议诊断
      return {
        ok: true,
        status: raw.status,
        retdesc: `服务已连接；协议诊断：${e.message ?? '结构无法识别'}`,
        message: `${message} · 协议诊断：${e.message ?? '结构无法识别'}`,
        testedAt,
      };
    }
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return {
      ok: false,
      message: `连接失败：${e.message ?? '未知错误'}`,
      testedAt,
    };
  }
}
