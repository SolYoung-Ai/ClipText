/**
 * 剪贴板辅助（clipboard）
 * 统一处理复制成功/失败反馈，支持 navigator.clipboard 与 execCommand 降级。
 */

export interface CopyResult {
  ok: boolean;
  fallbackUsed: boolean;
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<CopyResult> {
  if (!text) return { ok: false, fallbackUsed: false };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { ok: true, fallbackUsed: false };
    }
  } catch {
    /* fall through */
  }
  const ok = legacyCopy(text);
  return { ok, fallbackUsed: true };
}
