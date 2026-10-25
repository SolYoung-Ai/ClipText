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

const PLATFORM_LABELS: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  wechat: '视频号',
  bilibili: 'B站',
};

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
      try {
        const ex = extractUrlFromText(text);
        if (ex.ok) {
          addFailedHistory(detectPlatform(ex.url), ex.url, e.message ?? '');
        }
      } catch {
        /* ignore */
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
      <div className="container" style={{ maxWidth: 720 }}>
        <section className="hero" style={{ textAlign: 'center', padding: '48px 0 32px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
            让视频变成素材
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 24 }}>
            解析视频、保存媒体、提取字幕与口播文案
          </p>
          <div className="platform-tags" style={{ justifyContent: 'center' }}>
            {PLATFORMS.map((p) => (
              <span className="platform-tag" key={p.id} style={{ margin: '0 4px' }}>
                <span className="platform-dot" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
        </section>

        <LinkInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onClear={handleClear}
          loading={loading}
        />

        {loading && (
          <div className="status-bar status-loading" role="status" style={{ marginTop: 20 }}>
            <span className="spinner" />
            正在解析链接…
          </div>
        )}

        {error && !loading && (
          <div className="status-bar status-error" role="alert" style={{ marginTop: 20 }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            <div style={{ marginTop: 20 }}>
              <ResultCard result={result} onReparse={handleReparse} />
              <TextViewer result={result} asrText={asrText} />
              <AsrPanel
                settings={loadAsrSettings()}
                onTranscribed={setAsrText}
                hasSubtitle={result.subtitles.length > 0}
                mediaUrl={result.videoUrl || result.audioUrl || ''}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
