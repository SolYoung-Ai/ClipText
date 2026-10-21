import { PLATFORMS } from './constants';
import type { PlatformId } from './types';

/**
 * 平台识别模块（platformDetector）
 * 仅基于域名模式识别，不做正则猜视频 ID；未知平台返回 unknown。
 */
export function detectPlatform(url: string): PlatformId {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  // 去掉 www. 前缀后匹配
  const normalized = host.startsWith('www.') ? host.slice(4) : host;
  for (const p of PLATFORMS) {
    for (const domain of p.domains) {
      // domain 可能含路径前缀（如 weixin.qq.com/sph）
      if (normalized === domain || normalized.endsWith('.' + domain) || host === domain) {
        return p.id;
      }
      // 处理带路径前缀的域名模式
      if (domain.includes('/')) {
        const dom = domain.split('/')[0];
        if (host === dom && url.includes(domain.replace(dom, host))) {
          return p.id;
        }
      }
    }
  }
  return 'unknown';
}

export function getPlatformInfo(id: PlatformId) {
  return PLATFORMS.find((p) => p.id === id) ?? null;
}

export function isSupportedPlatform(url: string): boolean {
  return detectPlatform(url) !== 'unknown';
}
