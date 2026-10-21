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
}

export function AsrPanel({ settings, onTranscribed, hasSubtitle }: AsrPanelProps) {
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

  return (
    <section className="asr-panel" aria-label="口播转写">
      <h3>口播转文字（语音识别）</h3>
      <p className="hint">
        {hasSubtitle
          ? '该视频已有平台字幕，可直接在「原始字幕」标签页查看与导出。以下为可选补充：'
          : '上传你有权处理的视频/音频文件，使用你配置的语音识别服务转写口播。'}
        转写结果与平台原生字幕不同源，会单独标注。
      </p>

      {!settings.baseUrl.trim() ? (
        <p style={{ fontSize: 13.5, color: 'var(--warn)' }}>
          尚未配置语音识别服务。请前往「设置 → 语音识别服务」填写 API Base URL 与 API Key（兼容 OpenAI 风格 /v1/audio/transcriptions 接口）。
        </p>
      ) : (
        <>
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
                点击选择或拖拽文件到此处
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
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)' }}>
            文件仅在你的浏览器与所配置的语音识别服务之间传输；默认不会发送到其它第三方。
          </p>
        </>
      )}
    </section>
  );
}
