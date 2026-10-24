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
      // 走 Worker 代理下载，避免 CDN 防盗链 403
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
  if (result.duration != null) metaPills.push(`时长 ${formatDuration(result.duration)}`);
  if (result.author?.name) metaPills.push(`作者 ${result.author.name}`);
  if (result.subtitles.length) metaPills.push(`已有字幕 ${result.subtitles.length} 条`);
  if (result.audioUrl) metaPills.push('含音频');
  if (result.images.length) metaPills.push(`图集 ${result.images.length} 张`);

  return (
    <section className="result-card" aria-label="解析结果">
      <div className="result-main">
        <div className="cover-wrap">
          {result.coverUrl ? (
            <img
              src={result.coverUrl}
              alt={result.title || '视频封面'}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="cover-placeholder">
              <svg width="34" height="34" viewBox="0 0 64 64" fill="none" opacity="0.5">
                <rect x="8" y="14" width="48" height="36" rx="8" stroke="#8a837a" strokeWidth="4" />
                <circle cx="20" cy="24" r="3" fill="#8a837a" />
                <rect x="28" y="22" width="16" height="3" rx="1.5" fill="#8a837a" />
                <rect x="14" y="32" width="36" height="3" rx="1.5" fill="#8a837a" />
              </svg>
              <span>未获取封面</span>
            </div>
          )}
        </div>

        <div className="result-info">
          <div className="result-meta" style={{ marginTop: 0 }}>
            <span className="meta-pill">
              <span className="platform-dot" style={{ background: platform?.color ?? '#8a837a' }} />
              {platform?.name ?? '未知平台'}
            </span>
            {metaPills.map((p) => (
              <span className="meta-pill" key={p}>
                {p}
              </span>
            ))}
          </div>

          <h3 className="result-title" style={{ marginTop: 8 }}>
            {result.title || '(未获取标题)'}
          </h3>

          {result.description ? (
            <p className="result-desc">{result.description}</p>
          ) : (
            <p className="result-desc" style={{ color: 'var(--ink-3)', fontStyle: 'normal' }}>
              未获取发布文案
            </p>
          )}

          {!hasMedia && result.errorCode === 'NO_VIDEO_URL' && (
            <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--warn)' }}>
              该内容未返回视频地址（可能是图集、音频或权限受限内容）。
            </p>
          )}
        </div>
      </div>

      {/* 视频资源列表与下载 */}
      {allVideos.length > 0 && (
        <div className="resource-list">
          <h4>可用媒体资源</h4>
          {allVideos.map((res, i) => (
            <div className="resource-item" key={i}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {res.label && <span className="meta-pill">{res.label}</span>}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={downloading === res.url}
                  onClick={() => handleDownload(res)}
                >
                  {downloading === res.url ? '下载中…' : '下载视频'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 图集（若接口返回） */}
      {result.images.length > 0 && (
        <div className="resource-list" style={{ borderTop: '1px solid var(--border)' }}>
          <h4>图集（{result.images.length} 张）</h4>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {result.images.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer" title={img}>
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

      <div className="resource-list" style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', marginRight: 4 }}>链接可能过期？</span>
          <button className="btn btn-soft btn-sm" onClick={onReparse}>
            重新解析
          </button>
        </div>
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
