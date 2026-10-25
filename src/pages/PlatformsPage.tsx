import { PLATFORMS } from '../core/constants';

export function PlatformsPage() {
  return (
    <main className="page">
      <div className="container page-narrow">
        <h1 className="page-title">支持平台</h1>
        <p className="page-desc">
          平台实际可用性取决于解析服务后端（默认 media-parser 协议）的支持范围与平台规则。下表为当前架构与依赖说明。
        </p>

        <div className="prose">
          <table>
            <thead>
              <tr>
                <th>平台</th>
                <th>常见链接域名</th>
                <th>状态</th>
                <th>依赖与限制</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>
                    <span className="platform-dot" style={{ background: p.color, width: 8, height: 8, display: 'inline-block', borderRadius: '50%', marginRight: 6 }} />
                    {p.name}
                  </td>
                  <td>
                    <code>{p.domains[0]}</code>
                  </td>
                  <td>
                    <span style={{ color: 'var(--success)' }}>已适配解析协议</span>
                  </td>
                  <td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>依赖说明</h2>
          <ul>
            <li>小红书与视频号的公开链接，部分解析服务需要服务端凭证（Cookie）或动态代理才能完成解析；这由解析服务端配置，与前端无关。</li>
            <li>视频号分享链接有时效性，过期后需重新分享。</li>
            <li>媒体直链可能短暂有效，过期后请「重新解析」获取新地址。</li>
          </ul>

          <h2>平台规则声明</h2>
          <p>
            本站仅面向公开内容，不提供付费内容、DRM、登录权限的绕过手段。不支持 = 明确提示，不假装成功。
            本站与抖音、小红书、微信官方无合作或授权关系。
          </p>
        </div>
      </div>
    </main>
  );
}
