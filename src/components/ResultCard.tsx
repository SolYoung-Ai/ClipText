import { useState } from 'react';
import { getPlatformInfo } from '../core/platformDetector';
import { buildDownloadFileName, guessExt, saveVideoViaProxy } from '../core/downloadManager';
import { loadParserSettings } from '../core/settingsService';
import type { ParseResult, VideoResource } from '../core/types';
import { useToast } from './Toast';

interface ResultCardProps {
  result: ParseResult;
  onReparse: () => void;
}

export function ResultCard({ result, onReparse }: ResultCardProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [downloadError, setDownloadError] = useState<{ url: string; message: string } | null>(null);
  const platform = getPlatformInfo(result.platform);
  // 媒体代理由解析服务提供（/api/v1/download），不是 ASR 服务，也不是旧的 /api/v1/proxy
  const proxyBaseUrl = loadParserSettings().baseUrl.trim().replace(/\/+$/, '');

  const allVideos: VideoResource[] =
    result.videoUrl || result.videoUrls.length
      ? result.videoUrl
        ? [{ url: result.videoUrl, label: '主视频' }, ...result.videoUrls.filter((v) => v.url !== result.videoUrl)]
        : result.videoUrls
      : [];

  const handleDownload = async (res: VideoResource) => {
    if (downloading) return;
    setDownloading(res.url);
    setDownloadError(null);
    setProgress('正在连接媒体代理…');
    // 进度回调很频繁，限流到每 200ms 刷新一次界面
    let lastUpdate = 0;
    try {
      const fileName = buildDownloadFileName(result.platform, result.title || 'video', guessExt(res.url));
      const out = await saveVideoViaProxy({
        proxyBaseUrl,
        mediaUrl: res.url,
        fileName,
        onProgress: (received, total) => {
          const now = Date.now();
          if (now - lastUpdate < 200 && received !== total) return;
          lastUpdate = now;
          const mb = (n: number) => (n / 1048576).toFixed(1);
          setProgress(total
            ? `正在下载 ${mb(received)} / ${mb(total)} MB…`
            : `正在下载 ${mb(received)} MB…`);
        },
      });
      toast(`已保存：${out.fileName}（${out.sizeMB.toFixed(1)} MB）`);
    } catch (e) {
      const message = (e as Error).message || '下载失败';
      setDownloadError({ url: res.url, message });
      toast(`下载失败：${message}`, 'error');
    } finally {
      setProgress('');
      setDownloading(null);
    }
  };

  const metaPills: string[] = [];
  if (result.duration != null) metaPills.push(`${formatDuration(result.duration)}`);
  if (result.author?.name) metaPills.push(result.author.name);
  if (result.subtitles.length) metaPills.push(`${result.subtitles.length} 条字幕`);
  if (result.images.length) metaPills.push(`${result.images.length} 张图集`);

  return (
    <section className="result-card" aria-label="解析结果" style={{ marginTop: 20 }}>
      <div className="result-main">
        <div className="cover-wrap" style={{ width: 160, flexShrink: 0 }}>
          {result.coverUrl ? (
            <img
              src={result.coverUrl}
              alt={result.title || '视频封面'}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="cover-placeholder" style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>无封面</span>
            </div>
          )}
        </div>

        <div className="result-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="result-meta" style={{ marginTop: 0, marginBottom: 8 }}>
            <span className="meta-pill" style={{ fontSize: 12 }}>
              <span className="platform-dot" style={{ background: platform?.color ?? '#8a837a' }} />
              {platform?.name ?? '未知'}
            </span>
            {metaPills.map((p) => (
              <span className="meta-pill" key={p} style={{ fontSize: 12 }}>
                {p}
              </span>
            ))}
          </div>

          <h3 className="result-title" style={{ marginTop: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>
            {result.title || '(未获取标题)'}
          </h3>

          {result.description ? (
            <p className="result-desc" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 0 }}>
              {result.description}
            </p>
          ) : null}
        </div>
      </div>

      {allVideos.length > 0 && (
        <div className="resource-list" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {allVideos.map((res, i) => (
            <div className="resource-item" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>
                {res.label || `视频 ${i + 1}`}
              </span>
              <button
                className="btn btn-primary btn-sm"
                disabled={downloading === res.url}
                onClick={() => handleDownload(res)}
                style={{ flexShrink: 0 }}
              >
                {downloading === res.url ? '下载中…' : '下载视频'}
              </button>
            </div>
          ))}
        </div>
      )}

      {progress && (
        <p className="hint" role="status" style={{ marginTop: 10, fontSize: 12.5 }}>
          {progress}
        </p>
      )}

      {downloadError && (
        <div
          role="alert"
          style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <p className="hint" style={{ margin: '0 0 8px', fontSize: 12.5 }}>{downloadError.message}</p>
          <a className="btn btn-soft btn-sm" href={downloadError.url} target="_blank" rel="noopener noreferrer">
            打开原始视频地址
          </a>
        </div>
      )}

      {result.images.length > 0 && (
        <div className="resource-list" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>图集（{result.images.length} 张）</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
            {result.images.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                <img
                  src={img}
                  alt={`图集 ${i + 1}`}
                  loading="lazy"
                  style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button className="btn btn-soft btn-sm" onClick={onReparse}>
          重新解析
        </button>
      </div>
    </section>
  );
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}分${String(r).padStart(2, '0')}秒` : `${r}秒`;
}
