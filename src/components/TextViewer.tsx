import { useMemo, useState } from 'react';
import { copyText } from '../core/clipboard';
import {
  exportPayload,
  exportSubtitlesTxt,
  formatClock,
  triggerExport,
} from '../core/exportService';
import { buildCombinedDraft, captionPayload, countChars, subtitlePayload } from '../core/transcriptService';
import type { ParseResult, TextPayload } from '../core/types';
import { useToast } from './Toast';

interface TextViewerProps {
  result: ParseResult;
  /** ASR 结果（外部注入，随会话保留） */
  asrText: string;
}

type TabId = 'caption' | 'subtitle' | 'asr' | 'combined';

export function TextViewer({ result, asrText }: TextViewerProps) {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('caption');
  const [withTimestamp, setWithTimestamp] = useState(true);
  const [clearEmptyLines, setClearEmptyLines] = useState(true);

  const caption = useMemo(() => captionPayload(result), [result]);
  const subtitle = useMemo(() => subtitlePayload(result), [result]);
  const asrPayload: TextPayload = useMemo(
    () => ({
      source: 'asr',
      available: Boolean(asrText.trim()),
      body: asrText.trim(),
      createdAt: new Date().toISOString(),
    }),
    [asrText],
  );

  const combinedText = useMemo(() => buildCombinedDraft([caption, subtitle, asrPayload]), [caption, subtitle, asrPayload]);

  const tabs: { id: TabId; label: string; available: boolean; count: number }[] = [
    { id: 'caption', label: '发布文案', available: caption.available, count: countChars(caption.title ? caption.title + '\n' + caption.body : caption.body) },
    { id: 'subtitle', label: '原始字幕', available: subtitle.available, count: subtitle.cues?.length ?? 0 },
    { id: 'asr', label: '口播转写', available: asrPayload.available, count: countChars(asrPayload.body) },
    { id: 'combined', label: '统一整理稿', available: combinedText.trim().length > 0, count: countChars(combinedText) },
  ];

  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];

  const currentText = (): string => {
    switch (tab) {
      case 'caption':
        return [caption.title, caption.hashtags?.map((t) => '#' + t).join(' '), caption.body].filter(Boolean).join('\n\n');
      case 'subtitle':
        return subtitle.cues?.length ? exportSubtitlesTxt(subtitle.cues, withTimestamp) : subtitle.body;
      case 'asr':
        return asrPayload.body;
      case 'combined':
        return combinedText;
    }
  };

  const cleaned = (text: string): string => {
    if (!clearEmptyLines) return text;
    return text.replace(/\n{3,}/g, '\n\n');
  };

  const handleCopy = async () => {
    const text = cleaned(currentText());
    if (!text) {
      toast('暂无可复制内容', 'error');
      return;
    }
    const res = await copyText(text);
    if (res.ok) toast(res.fallbackUsed ? '已复制（降级方式）' : '已复制到剪贴板');
    else toast('复制失败，请手动选择文本复制', 'error');
  };

  const handleCopyParagraph = async () => {
    // 复制当前 tab 的第一段（文案场景复制完整正文）
    const text = cleaned(
      tab === 'caption'
        ? [caption.title, caption.body].filter(Boolean).join('\n\n')
        : currentText(),
    );
    if (!text) {
      toast('暂无可复制段落', 'error');
      return;
    }
    const res = await copyText(text);
    toast(res.ok ? '已复制当前段落' : '复制失败', res.ok ? 'info' : 'error');
  };

  const handleExport = (kind: 'txt' | 'srt' | 'json') => {
    let payload: TextPayload;
    if (tab === 'subtitle' && subtitle.cues?.length) {
      payload = {
        ...subtitle,
        body: exportSubtitlesTxt(subtitle.cues, withTimestamp),
      };
    } else if (tab === 'caption') {
      payload = caption;
    } else if (tab === 'asr') {
      payload = asrPayload;
    } else {
      payload = {
        source: 'combined',
        available: true,
        body: combinedText,
        createdAt: new Date().toISOString(),
      } as TextPayload;
    }
    if (!payload.available || !payload.body.trim()) {
      toast('该类型暂未取得数据，无法导出', 'error');
      return;
    }
    const opt = exportPayload(payload, { kind });
    triggerExport(opt);
    toast(`已导出 ${opt.fileName}`);
  };

  return (
    <section className="text-panel" aria-label="文案与字幕">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab.id === t.id}
            className={`tab ${activeTab.id === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            disabled={!t.available && t.id !== 'asr'}
            title={!t.available ? '暂未取得该类数据' : undefined}
          >
            {t.label}
            {!t.available && t.id !== 'asr' ? ' · 未取得' : ''}
          </button>
        ))}
      </div>

      <div className="text-body" role="tabpanel">
        <div className="text-toolbar">
          <button className="btn btn-soft btn-sm" onClick={handleCopy} disabled={!activeTab.available && tab !== 'combined'}>
            复制全部
          </button>
          <button className="btn btn-soft btn-sm" onClick={handleCopyParagraph} disabled={!activeTab.available && tab !== 'combined'}>
            复制当前段落
          </button>
          {tab === 'subtitle' && subtitle.cues?.length ? (
            <label className="checkbox-field" style={{ marginBottom: 0, marginLeft: 4 }}>
              <input
                type="checkbox"
                checked={withTimestamp}
                onChange={(e) => setWithTimestamp(e.target.checked)}
              />
              保留时间戳
            </label>
          ) : null}
          <label className="checkbox-field" style={{ marginBottom: 0, marginLeft: tab === 'subtitle' ? 0 : 4 }}>
            <input
              type="checkbox"
              checked={clearEmptyLines}
              onChange={(e) => setClearEmptyLines(e.target.checked)}
            />
            清除多余空行
          </label>
          <span className="text-count">
            {tab === 'subtitle' ? `${activeTab.count} 条` : `${activeTab.count} 字`}
          </span>
        </div>

        <div className="text-toolbar" style={{ marginBottom: 14 }}>
          <button className="btn btn-soft btn-sm" onClick={() => handleExport('txt')} disabled={!activeTab.available && tab !== 'combined'}>
            导出 TXT
          </button>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => handleExport('srt')}
            disabled={!(tab === 'subtitle' && subtitle.cues?.length)}
            title={tab === 'subtitle' && subtitle.cues?.length ? '导出标准 SRT 字幕' : '仅原始字幕可用 SRT 导出'}
          >
            导出 SRT
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => handleExport('json')} disabled={!activeTab.available && tab !== 'combined'}>
            导出 JSON
          </button>
        </div>

        {tab === 'subtitle' && subtitle.cues?.length ? (
          <ul className="cue-list">
            {subtitle.cues.map((c, i) => (
              <li className="cue-item" key={i}>
                <span className="cue-time">
                  {formatClock(c.start)} → {formatClock(c.end)}
                </span>
                <span className="cue-text">{c.text}</span>
              </li>
            ))}
          </ul>
        ) : activeTab.available || tab === 'combined' ? (
          <div className="text-content">{cleaned(currentText()) || '（无内容）'}</div>
        ) : (
          <div className="text-empty">
            {tab === 'caption' && '暂未取得该类数据：解析服务未返回发布文案。'}
            {tab === 'subtitle' && '暂未取得该类数据：该视频无原生字幕，或解析服务未返回字幕。'}
            {tab === 'asr' && '口播转写：可上传视频/音频文件，或解析服务返回字幕时直接使用。'}
          </div>
        )}

        {tab === 'asr' && (
          <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
            说明：口播转写为 AI 语音识别生成，与平台原生字幕不同源，请勿混用标注。
          </p>
        )}
      </div>
    </section>
  );
}
