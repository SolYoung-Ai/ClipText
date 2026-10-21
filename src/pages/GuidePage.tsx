export function GuidePage() {
  return (
    <main className="page">
      <div className="container page-narrow">
        <h1 className="page-title">使用指南</h1>
        <p className="page-desc">ClipText 是一个静态前端工具：粘贴分享链接 → 配置的解析服务解析 → 展示并导出。三步上手。</p>

        <div className="prose">
          <h2>第一步：配置解析服务（首次使用必需）</h2>
          <p>
            本站为纯静态前端（可部署于 GitHub Pages），本身不包含解析后端。解析能力由你配置的
            <strong> media-parser 兼容解析服务</strong>提供。打开「设置」，填写：
          </p>
          <ul>
            <li>解析服务地址（Base URL），例如自建服务 <code>https://your-host.example.com</code>；</li>
            <li>API 路径（默认 <code>/api/v1/parse</code>）；</li>
            <li>认证方式与 API Key（如服务要求）。</li>
          </ul>
          <p>点击「测试连接」做真实请求验证。未配置解析服务时，首页会明确提示，不会假装解析成功。</p>

          <h2>第二步：粘贴链接解析</h2>
          <ol>
            <li>复制抖音 / 小红书 / 微信视频号的分享内容（可直接粘贴整段文字，自动识别链接）；</li>
            <li>粘贴到首页输入框，按回车或点击「解析视频」；</li>
            <li>等待解析结果（期间显示真实加载状态）。</li>
          </ol>
          <p>
            平台分享短链接（如 <code>v.douyin.com/xxx</code>、<code>xhslink.com/xxx</code>）需解析服务端处理跳转
            （浏览器无法直接读取跨域重定向），这也是必须配置解析后端的原因之一。
          </p>

          <h2>第三步：使用结果</h2>
          <ul>
            <li><strong>下载视频</strong>：解析成功且取得媒体地址后可用。受浏览器跨域限制，若未触发保存，使用「打开原始地址」手动保存。</li>
            <li><strong>发布文案</strong>：查看标题、正文与话题标签，支持复制与导出 TXT / JSON。</li>
            <li><strong>原始字幕</strong>：解析服务返回字幕时按时间轴展示，支持复制、导出 TXT / SRT / JSON。</li>
            <li><strong>口播转写</strong>：配置语音识别服务后，上传你有权处理的音视频文件，AI 转写结果单独标注，不与原生字幕混淆。</li>
          </ul>

          <h2>什么情况会导致解析失败</h2>
          <ul>
            <li>链接无效、已过期（视频号链接尤其有时效性）、私密或需登录的内容；</li>
            <li>解析服务未配置 / 不可达 / CORS 被拦截 / 认证失败；</li>
            <li>平台规则调整导致解析服务暂不支持该链接；</li>
            <li>未知平台链接（目前支持抖音、小红书、微信视频号；B站为架构预留）。</li>
          </ul>
          <p>失败时会显示具体原因与下一步建议，不会隐藏错误。</p>

          <h2>隐私说明</h2>
          <ul>
            <li>你的链接只发送给配置的解析服务；文件只发送给配置的语音识别服务；</li>
            <li>历史记录与设置仅存本机浏览器；API Key 默认仅存会话内存；</li>
            <li>请仅处理你有权访问和处理的内容，遵守平台规则与版权要求；</li>
            <li>本站与抖音、小红书、微信官方无任何合作关系。</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
