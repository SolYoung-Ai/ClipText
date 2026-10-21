import { useState } from 'react';
import { useToast } from '../components/Toast';
import { clearAsrSettings, clearParserKey, loadAsrSettings, loadParserSettings, maskKey, saveAsrSettings, saveParserSettings } from '../core/settingsService';
import { testParserConnection } from '../core/serviceTest';
import type { AuthMode, ConnectionTestResult } from '../core/types';

export function SettingsPage() {
  const toast = useToast();
  const [parser, setParser] = useState(() => loadParserSettings());
  const [asr, setAsr] = useState(() => loadAsrSettings());
  const [persistKey, setPersistKey] = useState(() => localStorage.getItem('cliptext.allowKeyPersist.v1') === 'true');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showParserKey, setShowParserKey] = useState(false);
  const [showAsrKey, setShowAsrKey] = useState(false);

  const updateParser = (patch: Partial<typeof parser>) => setParser((p) => ({ ...p, ...patch }));

  const saveParser = () => {
    saveParserSettings(parser, persistKey);
    toast('解析服务设置已保存');
  };

  const runTest = async () => {
    if (!parser.baseUrl.trim()) {
      toast('请先填写解析服务地址', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testParserConnection({ ...parser, apiKey: persistKey ? parser.apiKey : parser.apiKey });
      setTestResult(r);
      toast(r.ok ? '连接测试完成' : '连接测试失败', r.ok ? 'info' : 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleKeyPersistChange = (v: boolean) => {
    setPersistKey(v);
    if (!v) {
      clearParserKey();
      setParser((p) => ({ ...p, apiKey: '' }));
      toast('已清除本地保存的 API Key');
    }
  };

  return (
    <main className="page">
      <div className="container page-narrow">
        <h1 className="page-title">设置</h1>
        <p className="page-desc">配置解析服务与语音识别服务。所有密钥仅由你本人填写，默认仅保存在当前会话中。</p>

        {/* 解析服务 */}
        <section className="settings-section">
          <h2>解析服务</h2>
          <p className="section-desc">
            默认兼容 media-parser 协议（/api/v1/parse）。可指向自建或租用的解析后端；GitHub Pages 仅托管静态前端，不运行后端。
          </p>

          <div className="field">
            <label htmlFor="parser-base">解析服务地址（Base URL）</label>
            <input
              id="parser-base"
              type="url"
              placeholder="https://mp.example.com"
              value={parser.baseUrl}
              onChange={(e) => updateParser({ baseUrl: e.target.value })}
            />
            <p className="field-hint">示例：https://mp.ucmao.cn 或自建服务的 https://你的域名</p>
          </div>

          <div className="field">
            <label htmlFor="parser-path">API 路径</label>
            <input
              id="parser-path"
              type="text"
              value={parser.apiPath}
              onChange={(e) => updateParser({ apiPath: e.target.value.trim() || '/api/v1/parse' })}
            />
            <p className="field-hint">默认 /api/v1/parse（media-parser 标准接口）</p>
          </div>

          <div className="field">
            <label htmlFor="parser-auth">认证方式</label>
            <select
              id="parser-auth"
              value={parser.authMode}
              onChange={(e) => updateParser({ authMode: e.target.value as AuthMode })}
            >
              <option value="none">无认证</option>
              <option value="key">URL 参数 key</option>
              <option value="bearer">Authorization: Bearer</option>
            </select>
            <p className="field-hint">media-parser 微服务模式免鉴权；运营模式使用 key 参数或 Bearer 头</p>
          </div>

          <div className="field">
            <label htmlFor="parser-key">API Key（可选）</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="parser-key"
                type={showParserKey ? 'text' : 'password'}
                placeholder="未填写"
                value={parser.apiKey}
                onChange={(e) => updateParser({ apiKey: e.target.value })}
                autoComplete="off"
              />
              <button className="btn btn-soft btn-sm" type="button" onClick={() => setShowParserKey((v) => !v)}>
                {showParserKey ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="field-hint">
              {parser.apiKey ? `已保存（脱敏显示：${maskKey(parser.apiKey)}）` : '未填写 API Key'}
              。浏览器端直接使用的密钥并非服务器端秘密，请勿在此填写高权限密钥。
            </p>
          </div>

          <label className="checkbox-field">
            <input type="checkbox" checked={persistKey} onChange={(e) => handleKeyPersistChange(e.target.checked)} />
            <span>
              在本浏览器中持久化保存 API Key
              <br />
              <small style={{ color: 'var(--ink-3)' }}>默认关闭：Key 仅保存在当前会话内存，刷新页面后需重新填写。开启后任何能访问此浏览器的人都能看到该 Key。</small>
            </span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveParser}>
              保存解析设置
            </button>
            <button className="btn btn-soft" onClick={runTest} disabled={testing}>
              {testing ? '测试中…' : '测试连接'}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.ok ? 'test-ok' : 'test-fail'}`}>
              <strong>{testResult.ok ? '✓ 连接正常' : '✕ 连接失败'}</strong>
              <br />
              {testResult.message}
              {testResult.retdesc && (
                <>
                  <br />
                  <span style={{ opacity: 0.85 }}>{testResult.retdesc}</span>
                </>
              )}
              <br />
              <span style={{ opacity: 0.7, fontSize: 12 }}>测试时间：{new Date(testResult.testedAt).toLocaleString()}</span>
            </div>
          )}
        </section>

        {/* 语音识别服务 */}
        <section className="settings-section">
          <h2>语音识别服务</h2>
          <p className="section-desc">
            兼容 OpenAI 风格 /v1/audio/transcriptions 接口（multipart 上传）。以你配置的服务协议为准，不同服务可能存在差异。
          </p>

          <div className="field">
            <label htmlFor="asr-base">API Base URL</label>
            <input
              id="asr-base"
              type="url"
              placeholder="https://api.openai.com/v1"
              value={asr.baseUrl}
              onChange={(e) => setAsr((a) => ({ ...a, baseUrl: e.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="asr-path">转录接口路径</label>
            <input
              id="asr-path"
              type="text"
              value={asr.apiPath}
              onChange={(e) => setAsr((a) => ({ ...a, apiPath: e.target.value.trim() || '/audio/transcriptions' }))}
            />
            <p className="field-hint">默认 /audio/transcriptions（将拼接到 Base URL 之后）</p>
          </div>

          <div className="field">
            <label htmlFor="asr-key">API Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="asr-key"
                type={showAsrKey ? 'text' : 'password'}
                placeholder="未填写"
                value={asr.apiKey}
                onChange={(e) => setAsr((a) => ({ ...a, apiKey: e.target.value }))}
                autoComplete="off"
              />
              <button className="btn btn-soft btn-sm" type="button" onClick={() => setShowAsrKey((v) => !v)}>
                {showAsrKey ? '隐藏' : '显示'}
              </button>
            </div>
            {asr.apiKey && <p className="field-hint">已保存（脱敏显示：{maskKey(asr.apiKey)}）。浏览器端 Key 非服务器端秘密。</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label htmlFor="asr-model">模型名称</label>
              <input
                id="asr-model"
                type="text"
                value={asr.model}
                placeholder="whisper-1"
                onChange={(e) => setAsr((a) => ({ ...a, model: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="asr-lang">语言选项</label>
              <select
                id="asr-lang"
                value={asr.language}
                onChange={(e) => setAsr((a) => ({ ...a, language: e.target.value }))}
              >
                <option value="zh">中文（zh）</option>
                <option value="en">英语（en）</option>
                <option value="ja">日语（ja）</option>
                <option value="">自动检测</option>
              </select>
            </div>
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={asr.persistKey}
              onChange={(e) => setAsr((a) => ({ ...a, persistKey: e.target.checked }))}
            />
            <span>在本浏览器中持久化保存语音识别 Key</span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                saveAsrSettings(asr);
                toast('语音识别设置已保存');
              }}
            >
              保存语音识别设置
            </button>
            <button
              className="btn btn-soft"
              onClick={() => toast('语音识别无法仅凭配置测试，需上传实际音频文件后才能验证。')}
            >
              说明
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)' }}>
            语音识别服务不支持「配置空测」：真实转录结果需上传音频/视频文件后验证，见主页「口播转写」面板。
          </p>
        </section>

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
                if (window.confirm('确定清除本地 API 配置吗？')) {
                  clearParserKey();
                  clearAsrSettings();
                  setParser((p) => ({ ...p, apiKey: '', baseUrl: '' }));
                  setAsr((a) => ({ ...a, apiKey: '', baseUrl: '' }));
                  setPersistKey(false);
                  toast('本地 API 配置已清除');
                }
              }}
            >
              清除本地 API 配置
            </button>
          </div>

          <details style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-2)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>查看隐私与数据处理说明</summary>
            <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
              <li>网站为纯静态前端，除你主动配置的解析/语音识别服务外，不向任何第三方发送数据。</li>
              <li>输入链接仅发送给你配置的解析服务；上传文件仅发送给你配置的语音识别服务。</li>
              <li>历史记录、设置与 API Key 默认只存本机浏览器；API Key 默认仅存会话内存。</li>
              <li>清除浏览器数据后，历史记录与本地设置将消失（不提供云端同步）。</li>
              <li>请仅处理你拥有相应权利的公开内容，遵守各平台规则与版权要求。</li>
            </ul>
          </details>
        </section>
      </div>
    </main>
  );
}
