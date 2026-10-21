import { useEffect, useRef, useState } from 'react';
import { describeUrl } from '../core/parserAdapter';
import { extractUrlFromText, normalizeInput } from '../core/urlNormalizer';

interface LinkInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
}

export function LinkInput({ value, onChange, onSubmit, onClear, loading }: LinkInputProps) {
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState<{ kind: 'link' | 'platform' | 'none'; text: string }>({
    kind: 'none',
    text: '',
  });
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 输入变化时做链接与平台预检提示（仅提示，不请求）
  useEffect(() => {
    const text = normalizeInput(value);
    if (!text) {
      setHint({ kind: 'none', text: '' });
      return;
    }
    const extracted = extractUrlFromText(text);
    if (!extracted.ok) {
      setHint({ kind: 'none', text: '' });
      return;
    }
    const info = describeUrl(extracted.url);
    if (info.platform === 'unknown') {
      setHint({ kind: 'platform', text: '已识别到链接，但暂不支持该平台（支持抖音 / 小红书 / 微信视频号）' });
    } else {
      setHint({ kind: 'platform', text: `已识别 ${info.name} 链接 · ${info.note}` });
    }
  }, [value]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text.trim());
        taRef.current?.focus();
      }
    } catch {
      // 剪贴板权限被拒时提示用户手动粘贴
      taRef.current?.focus();
      alert('无法读取剪贴板，请手动粘贴（Ctrl/Cmd + V）。');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 空输入时也交给父级，由其给出明确错误反馈（按钮禁用仅阻止点击）
      if (!loading) onSubmit();
    }
  };

  return (
    <div className={`input-panel ${focused ? 'focused' : ''}`}>
      <div className="input-wrap">
        <textarea
          ref={taRef}
          className="input-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="粘贴抖音 / 小红书 / 微信视频号分享链接…支持粘贴整段分享文字，自动识别其中的链接"
          aria-label="视频分享链接输入框"
          rows={3}
        />
        <div className="input-actions">
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading || !normalizeInput(value)}>
            {loading ? '解析中…' : '解析视频'}
          </button>
          <button className="btn btn-ghost" onClick={handlePaste} type="button">
            粘贴
          </button>
          <button className="btn btn-soft" onClick={onClear} type="button" disabled={!value}>
            清空
          </button>
        </div>
      </div>
      <div className="paste-tip">
        <span>粘贴后按回车即可解析</span>
        {hint.kind === 'platform' && <span className="link-detected">{hint.text}</span>}
      </div>
    </div>
  );
}
