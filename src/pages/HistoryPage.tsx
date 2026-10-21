import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { clearHistory, deleteHistoryItem, listHistory } from '../core/historyService';
import { getPlatformInfo } from '../core/platformDetector';
import type { HistoryItem } from '../core/types';

interface HistoryPageProps {
  onOpenLink: (text: string) => void;
}

export function HistoryPage({ onOpenLink }: HistoryPageProps) {
  const toast = useToast();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(listHistory());
  }, []);

  const handleDelete = (id: string) => {
    setItems(deleteHistoryItem(id));
    toast('已删除该条记录');
  };

  const handleClearAll = () => {
    if (window.confirm('确定清空全部解析历史吗？该操作不可恢复。')) {
      setItems(clearHistory());
      toast('已清空历史记录');
    }
  };

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">历史记录</h1>
            <p className="page-desc" style={{ marginBottom: 0 }}>
              仅存储在本机浏览器（最多 100 条）。清除浏览器数据后记录会消失，属正常行为。
            </p>
          </div>
          {items.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
              清空全部
            </button>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          {items.length === 0 ? (
            <div className="text-body" style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '40px 10px' }}>
              暂无解析历史。回到首页解析一条链接后，记录会显示在这里。
            </div>
          ) : (
            items.map((item) => {
              const p = getPlatformInfo(item.platform);
              return (
                <div className="history-item" key={item.id}>
                  <span className="platform-dot" style={{ background: p?.color ?? '#8a837a', width: 10, height: 10, flexShrink: 0 }} />
                  <div className="history-main">
                    <div className="history-title">{item.title}</div>
                    <div className="history-sub">{item.url}</div>
                    <div className="history-badges">
                      <span className="badge">{p?.name ?? '未知平台'}</span>
                      {item.success ? (
                        <>
                          {item.summary.hasVideo && <span className="badge">视频</span>}
                          {item.summary.hasCaption && <span className="badge">文案</span>}
                          {item.summary.hasSubtitle && <span className="badge">字幕</span>}
                          {item.summary.hasAudio && <span className="badge">音频</span>}
                          {item.summary.hasCover && <span className="badge">封面</span>}
                        </>
                      ) : (
                        <span className="badge badge-fail">解析失败{item.errorMessage ? `：${item.errorMessage}` : ''}</span>
                      )}
                      <span className="badge">{new Date(item.parsedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {item.success && (
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => {
                          onOpenLink(item.url);
                        }}
                      >
                        重新解析
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
