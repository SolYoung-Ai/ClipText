import { useEffect, useRef, useState } from 'react';
import { extractAudioWav, EXTRACT_MIN_BYTES } from '../core/audioExtractor';
import { ASR_FILE_WARN_BYTES, ASR_ACCEPTED_EXT } from '../core/constants';
import { AppError } from '../core/errors';
import {
  fetchMediaFileViaProxy,
  fileSizeMB,
  isAcceptedFile,
  transcribeFile,
  transcribeFromUrl,
} from '../core/speechToTextService';
import type { AsrSettings } from '../core/types';
import { useToast } from './Toast';

interface AsrPanelProps {
  settings: AsrSettings;
  onTranscribed: (text: string) => void;
  /** 是否已有字幕（有则提示可直接使用） */
  hasSubtitle: boolean;
  /** 当前解析结果的媒体直链（音频优先），存在时显示「直接转写当前视频」 */
  mediaUrl?: string;
  /** 解析服务地址：提供媒体代理下载，用于绕开平台对服务器直连下载的拦截 */
  mediaProxyBaseUrl?: string;
}

export function AsrPanel({ settings, onTranscribed, hasSubtitle, mediaUrl, mediaProxyBaseUrl }: AsrPanelProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  /** 所有自动路径都失败时置位，引导用户手动上传本地文件 */
  const [downloadBlocked, setDownloadBlocked] = useState(false);
  /** 已等待秒数：免费实例转写较慢，长时间无反馈会让人以为卡死 */
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  // 每次解析结果变化（mediaUrl 改变）都重置拦截状态
  useEffect(() => {
    setDownloadBlocked(false);
  }, [mediaUrl]);

  /** 上传前先抽音轨：几十 MB 的视频通常可压到几 MB，上传更快也更不容易超限 */
  const transcribeUpload = async (file: File): Promise<string> => {
    let upload = file;
    if (file.size >= EXTRACT_MIN_BYTES) {
      setProgress(`正在提取音轨以加快上传（原文件 ${fileSizeMB(file).toFixed(1)} MB）…`);
      const wav = await extractAudioWav(file, { fileName: file.name });
      if (wav && wav.size < file.size) {
        upload = wav;
      }
    }
    setProgress(`正在上传并识别 ${upload.name}（${fileSizeMB(upload).toFixed(1)} MB）…`);
    const out = await transcribeFile(upload, settings, { timeoutMs: 300000 });
    return out.text;
  };

  const run = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setFileName(file.name);
    try {
      if (!isAcceptedFile(file)) {
        throw new AppError('ASR_FAILED', `不支持的文件格式，支持：${ASR_ACCEPTED_EXT.join(' / ')}`);
      }
      if (file.size > ASR_FILE_WARN_BYTES) {
        setProgress('文件较大（超过约 25MB），正在压缩音轨后上传…');
      }
      const text = await transcribeUpload(file);
      onTranscribed(text);
      setProgress('识别完成，结果已填入「口播转写」标签页。');
      setDownloadBlocked(false);
      toast('口播转写完成');
    } catch (err) {
      const e = err as AppError;
      setProgress(`识别失败：${e.message}`);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /**
   * 一键提取当前视频的口播文案。
   * 链路：后端直连下载转写 → 失败则经媒体代理下载 → 浏览器上传转写。
   * 这样即使平台 CDN 拦截服务器下载（403/502），功能依然可用。
   */
  const runFromUrl = async () => {
    if (busy || !mediaUrl) return;
    setBusy(true);
    setDownloadBlocked(false);
    setFileName('');
    const started = Date.now();
    try {
      let text = '';
      setProgress('正在请求后端下载并转写（免费实例较慢，1 分钟视频约需 2~3 分钟）…');
      try {
        // 免费实例 CPU 较弱，转写耗时可能是音频时长的数倍，超时必须给足
        text = (await transcribeFromUrl(mediaUrl, settings, { timeoutMs: 600000 })).text;
      } catch (directErr) {
        const de = directErr as AppError;
        // 只有「后端下载被平台拦截」才值得改走代理重取；
        // 认证失败、转写超时、引擎缺失等问题换路径也没用，直接向上抛。
        if (!mediaProxyBaseUrl || de.code !== 'DOWNLOAD_FAILED') throw de;
        setProgress('后端直连下载被平台拦截，正在通过媒体代理重新取回视频…');
        const { file, sizeMB } = await fetchMediaFileViaProxy({
          proxyBaseUrl: mediaProxyBaseUrl,
          mediaUrl,
          fileName: '口播素材',
          onProgress: (received, total) => {
            const mb = (received / 1048576).toFixed(1);
            setProgress(total ? `正在下载视频 ${Math.min(100, Math.round((received / total) * 100))}%…` : `正在下载视频（已接收 ${mb} MB）…`);
          },
        });
        setFileName(file.name);
        setProgress(`视频已取回（${sizeMB.toFixed(1)} MB），准备转写…`);
        text = await transcribeUpload(file);
      }
      onTranscribed(text);
      setProgress(`识别完成，耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。结果已填入「口播转写」标签页。`);
      toast('口播转写完成');
    } catch (err) {
      const e = err as AppError;
      const msg = e.name === 'AbortError' ? '转写超时，请稍后重试' : e.message;
      if (e.code === 'DOWNLOAD_FAILED') setDownloadBlocked(true);
      setProgress(`识别失败：${msg}`);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  /** 自动下载被拦截时，引导用户改用本地视频文件上传 */
  const pickLocalFile = () => {
    if (busy) return;
    fileRef.current?.click();
  };

  return (
    <section className="asr-panel" aria-label="口播转写">
      <h3>口播转文字（语音识别）</h3>
      <p className="hint">
        {hasSubtitle
          ? '该视频已有平台字幕，可直接在「原始字幕」标签页查看与导出。'
          : '解析视频后，点击下方按钮自动提取口播文案，无需手动下载上传。'}
        转写结果与平台原生字幕不同源，会单独标注。
      </p>

      {mediaUrl ? (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: 12, width: '100%' }}
          onClick={runFromUrl}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="spinner" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }} />
              正在转写当前视频…{elapsed >= 3 ? ` 已等待 ${elapsed} 秒` : ''}
            </>
          ) : (
            '⚡ 一键提取口播文案（自动下载转写）'
          )}
        </button>
      ) : null}

      {downloadBlocked && (
        <div className="asr-fallback" role="alert" style={{ marginBottom: 12 }}>
          <p className="hint" style={{ marginBottom: 10 }}>
            自动路径（后端直连 + 媒体代理）都没能取到视频，最后一步可以手动完成：先用上方「视频下载」把视频存到本机，再点下面的按钮选择该文件转写。
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={pickLocalFile}
              disabled={busy}
              style={{ flex: '1 1 auto' }}
            >
              📁 选择本地视频文件转写
            </button>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                setDownloadBlocked(false);
                void runFromUrl();
              }}
              disabled={busy || !mediaUrl}
            >
              重试自动提取
            </button>
          </div>
        </div>
      )}

      <div
        className={`file-drop ${dragging ? 'dragging' : ''}`}
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void run(f);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        {busy ? (
          <span>
            <span className="spinner" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }} />
            正在识别…
          </span>
        ) : (
          <>
            或：点击选择 / 拖拽视频文件手动上传转写
            <br />
            <span style={{ fontSize: 12 }}>支持 mp3 / wav / m4a / mp4 / mov / webm，单文件建议 ≤ 25MB</span>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,audio/*,video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(f);
          e.target.value = '';
        }}
      />
      {progress && (
        <p className="asr-progress" role="status">
          {fileName && <strong>{fileName}</strong>} {progress}
          {busy && elapsed >= 5 ? `（已等待 ${elapsed} 秒）` : ''}
        </p>
      )}
    </section>
  );
}
