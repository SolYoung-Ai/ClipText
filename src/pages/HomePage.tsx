import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [slowBackend, setSlowBackend] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asrText, setAsrText] = useState('');
  const inputRef = useRef(input);
  inputRef.current = input;
  /** 超时自动重试标记，防止无限重试 */
  const retriedRef = useRef(false);

  // 解析进行中：每秒刷新已等待时长
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      setRetrying(false);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const doParse = useCallback(async (text: string): Promise<void> => {
    const settings = loadParserSettings();
    try {
      const res = await parseFromText({ text, settings });
      setResult(res);
      addHistory(res);
    } catch (err) {
      const e = err as AppError;
      // 超时通常是后端冷启动，自动重试一次
      if (e.code === 'TIMEOUT' && !retriedRef.current) {
        retriedRef.current = true;
        throw 'RETRY';
      }
      retriedRef.current = false;
      setError(toUserMessage(e.code ?? 'UNKNOWN', e.message));
      try {
        const ex = extractUrlFromText(text);
        if (ex.ok) {
          addFailedHistory(detectPlatform(ex.url), ex.url, e.message ?? '');
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

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
    const settings = loadParserSettings();
    setSlowBackend(settings.baseUrl.includes('onrender.com'));
    try {
      await doParse(text);
    } catch (sig) {
      if (sig === 'RETRY') {
        setRetrying(true);
        setError(null);
        // 给后端一点冷启动时间再重试
        await new Promise((r) => setTimeout(r, 1200));
        await doParse(text);
      }
    } finally {
      setLoading(false);
      retriedRef.current = false;
      setRetrying(false);
    }
  }, [loading, doParse]);

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

  // 解析加载态的分阶段文案，缓解「等待像卡死」的观感
  const loadingStage =
    elapsed < 3
      ? '正在连接解析服务…'
      : elapsed < 12
        ? '正在向平台请求数据…'
        : '正在解析（平台 / 后端处理较慢，请稍候）…';

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
            <span>{retrying ? '首次超时，正在自动重试（后端可能冷启动）…' : loadingStage}</span>
            <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 13 }}>已等待 {elapsed} 秒</span>
            {slowBackend && !retrying && elapsed >= 8 && (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                提示：当前使用的是免费托管后端，闲置后会休眠、首次约需 1 分钟冷启动。如需稳定快速，可在「设置」中改用自建后端。
              </div>
            )}
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
                mediaProxyBaseUrl={loadParserSettings().baseUrl}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
