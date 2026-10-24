import { useState } from 'react';
import { useToast } from '../components/Toast';
import { clearAsrSettings, clearParserKey, loadAsrSettings, loadParserSettings } from '../core/settingsService';

export function SettingsPage() {
  const toast = useToast();
  const [, setParser] = useState(() => loadParserSettings());
  const [, setAsr] = useState(() => loadAsrSettings());

  return (
    <main className="page">
      <div className="container page-narrow">
        <h1 className="page-title">设置</h1>
        <p className="page-desc">所有配置已默认内置，开箱即用。</p>

        {/* 本地数据管理 */}
        <section className="settings-section">
          <h2>本地数据管理</h2>
          <p className="section-desc">所有数据仅存储在你当前浏览器（localStorage），不会上传到任何第三方。</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (window.confirm('确定清空全部解析历史吗？该操作不可恢复。')) {
                  localStorage.removeItem('cliptext.history.v1');
                  toast('解析历史已清空');
                }
              }}
            >
              清空解析历史
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (window.confirm('确定清除本地缓存配置吗？')) {
                  clearParserKey();
                  clearAsrSettings();
                  setParser((p) => ({ ...p, apiKey: '' }));
                  setAsr((a) => ({ ...a, apiKey: '' }));
                  toast('本地缓存配置已清除');
                }
              }}
            >
              清除本地缓存
            </button>
          </div>

          <details style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-2)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>查看隐私与数据处理说明</summary>
            <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
              <li>网站为纯静态前端，解析与语音识别均通过内置服务完成。</li>
              <li>输入链接仅发送给解析服务；上传文件仅发送给语音识别服务。</li>
              <li>历史记录与设置只存本机浏览器，清除浏览器数据后自动消失。</li>
              <li>请仅处理你拥有相应权利的公开内容，遵守各平台规则与版权要求。</li>
            </ul>
          </details>
        </section>
      </div>
    </main>
  );
}
