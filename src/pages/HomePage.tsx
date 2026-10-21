import { useCallback, useRef, useState } from 'react';
import { AsrPanel } from '../components/AsrPanel';
import { LinkInput } from '../components/LinkInput';
import { ResultCard } from '../components/ResultCard';
import { TextViewer } from '../components/TextViewer';
import { PLATFORMS } from '../core/constants';
import { AppError, toUserMessage } from '../core/errors';
import { addFailedHistory, addHistory } from '../core/historyService';
import { parseFromText } from '../core/parserAdapter';
import { detectPlatform } from '../core/platformDetector';
import { loadAsrSettings, loadParserSettings } from '../core/settingsService';
import { extractUrlFromText } from '../core/urlNormalizer';
import type { ParseResult } from '../core/types';

export function HomePage({ initialLink = '' }: { initialLink?: string }) {
  const [input, setInput] = useState(initialLink);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asrText, setAsrText] = useState('');
  const inputRef = useRef(input);
  inputRef.current = input;

  const runParse = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? inputRef.current).trim();
    if (!text) {
      setError(toUserMessage('EMPTY_INPUT'));
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const settings = loadParserSettings();
      const res = await parseFromText({ text, settings });
      setResult(res);
      addHistory(res);
    } catch (err) {
      const e = err as AppError;
      const message = toUserMessage(e.code ?? 'UNKNOWN', e.message);
      setError(message);
      // 记录失败历史（带平台信息）
      try {
        const ex = extractUrlFromText(text);
        if (ex.ok) {
          addFailedHistory(detectPlatform(ex.url), ex.url, e.message ?? '');
        }
      } catch {
        /* history 记录失败不影响主流程 */
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleSubmit = () => void runParse();
  const handleReparse = () => {
    setResult(null);
    setError(null);
    void runParse();
  };
  const handleClear = () => {
    setInput('');
    setResult(null);
    setError(null);
    setAsrText('');
  };

  return (
    <main className="page">
      <div className="container">
        <section className="hero">
          <h1>一条链接，提取视频与文案</h1>
          <p>粘贴视频分享链接，快速获取视频信息、发布文案与可用字幕。</p>
          <div className="platform-tags">
            {PLATFORMS.filter((p) => p.id !== 'bilibili').map((p) => (
              <span className="platform-tag" key={p.id}>
                <span className="platform-dot" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
          <p className="hero-note">
            支持范围受平台规则、链接类型与解析服务状态影响，不保证 100% 成功。
          </p>
        </section>

        <LinkInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onClear={handleClear}
          loading={loading}
        />

        {loading && (
          <div className="status-bar status-loading" role="status">
            <span className="spinner" />
            正在解析链接，请稍候…
          </div>
        )}

        {error && !loading && (
          <div className="status-bar status-error" role="alert">
            <strong>解析未完成：</strong>
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            <div className="status-bar status-success">
              ✓ 解析成功（平台：{result.platform === 'douyin' ? '抖音' : result.platform === 'xiaohongshu' ? '小红书' : result.platform === 'wechat' ? '微信视频号' : result.platform === 'bilibili' ? 'B站' : '未知'}）
            </div>
            <ResultCard result={result} onReparse={handleReparse} />
            <TextViewer result={result} asrText={asrText} />
            <AsrPanel
              settings={loadAsrSettings()}
              onTranscribed={setAsrText}
              hasSubtitle={result.subtitles.length > 0}
              mediaUrl={result.videoUrl || result.audioUrl || ''}
            />
          </>
        )}

        {!result && !loading && !error && (
          <p style={{ marginTop: 22, fontSize: 13.5, color: 'var(--ink-3)', textAlign: 'center' }}>
            粘贴链接后点击「解析视频」，或直接按回车。
            <br />
            未配置解析服务时，请先在「设置」中填写解析服务地址（默认兼容 media-parser 协议）。
          </p>
        )}
      </div>
    </main>
  );
}
