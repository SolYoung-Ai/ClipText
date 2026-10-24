import { useRef, useState } from 'react';
import { ASR_FILE_WARN_BYTES, ASR_ACCEPTED_EXT } from '../core/constants';
import { AppError } from '../core/errors';
import {
  fileSizeMB,
  isAcceptedFile,
  transcribeFile,
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
}

export function AsrPanel({ settings, onTranscribed, hasSubtitle, mediaUrl }: AsrPanelProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setFileName(file.name);
    setProgress(`正在上传并识别 ${file.name}（${fileSizeMB(file).toFixed(1)} MB）…`);
    try {
      if (!isAcceptedFile(file)) {
        throw new AppError('ASR_FAILED', `不支持的文件格式，支持：${ASR_ACCEPTED_EXT.join(' / ')}`);
      }
      if (file.size > ASR_FILE_WARN_BYTES) {
        setProgress('文件较大（超过约 25MB），部分服务可能限制，若失败请压缩后重试。');
      }
      const out = await transcribeFile(file, settings);
      onTranscribed(out.text);
      setProgress(`识别完成，耗时 ${(out.durationMs / 1000).toFixed(1)} 秒。结果已填入「口播转写」标签页。`);
      toast('口播转写完成');
    } catch (err) {
      const e = err as AppError;
      setProgress(`识别失败：${e.message}`);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /** 直接对刚解析出来的媒体直链转写（通过 Cloudflare Worker 代理） */
  const runFromUrl = async () => {
    if (busy || !mediaUrl) return;
    setBusy(true);
    setProgress('正在下载视频并转写口播（约 10~30 秒）…');
    try {
      const base = settings.baseUrl.replace(/\/+$/, '');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(`${base}/api/v1/asr-from-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mediaUrl }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const raw = await res.text();
      if (!res.ok) {
        throw new AppError('ASR_FAILED', `转写失败（HTTP ${res.status}）：${raw.slice(0, 200)}`);
      }
      let data: { text?: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        /* ignore */
      }
      const text = (data?.text ?? '').trim();
      if (!text) {
        throw new AppError('ASR_FAILED', '转写返回了空文本');
      }
      onTranscribed(text);
      setProgress(`识别完成，耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。结果已填入「口播转写」标签页。`);
      toast('口播转写完成');
    } catch (err) {
      const e = err as AppError;
      const msg = e.name === 'AbortError' ? '转写超时（2 分钟），请稍后重试' : e.message;
      setProgress(`识别失败：${msg}`);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
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
              正在转写当前视频…
            </>
          ) : (
            '⚡ 一键提取口播文案（自动下载转写）'
          )}
        </button>
      ) : null}

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
        </p>
      )}
    </section>
  );
}
