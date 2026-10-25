import { useState } from 'react';
import { getPlatformInfo } from '../core/platformDetector';
import { buildDownloadFileName, guessExt } from '../core/downloadManager';
import { loadAsrSettings } from '../core/settingsService';
import type { ParseResult, VideoResource } from '../core/types';
import { useToast } from './Toast';

interface ResultCardProps {
  result: ParseResult;
  onReparse: () => void;
}

export function ResultCard({ result, onReparse }: ResultCardProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const platform = getPlatformInfo(result.platform);
  const workerBaseUrl = loadAsrSettings().baseUrl.trim().replace(/\/+$/, '');

  const allVideos: VideoResource[] =
    result.videoUrl || result.videoUrls.length
      ? result.videoUrl
        ? [{ url: result.videoUrl, label: '主视频' }, ...result.videoUrls.filter((v) => v.url !== result.videoUrl)]
        : result.videoUrls
      : [];

  const handleDownload = async (res: VideoResource) => {
    if (downloading) return;
    setDownloading(res.url);
    try {
      const fileName = buildDownloadFileName(result.platform, result.title || 'video', guessExt(res.url));
      const proxyUrl = `${workerBaseUrl}/api/v1/proxy?url=${encodeURIComponent(res.url)}`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast(`已开始下载：${fileName}`);
    } catch (e) {
      toast(`下载失败：${(e as Error).message}`, 'error');
    } finally {
      setDownloading(null);
    }
  };

  const hasMedia = allVideos.length > 0 || Boolean(result.audioUrl);
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
