# ClipText 测试记录

> 测试执行时间：2026-10-21（首次） / 2026-10-21（部署前回归 + 真实端到端）
> 测试环境：Node v22.23.2 · macOS · Vitest 2.x（jsdom）
> 结果：**13 个测试文件 / 90 个用例全部通过**；`tsc` 类型检查通过；`vite build` 生产构建成功；本地预览 + 真实浏览器冒烟通过；**真实抖音链接端到端验证通过**。

## 1. 前端基础测试（对应需求 15.1）

| 用例 | 覆盖文件 | 通过 |
|---|---|---|
| 空链接提交（按钮禁用 + 回车给出明确错误） | HomePage.test.tsx | ✅ |
| 普通无关文本（无链接） | urlNormalizer / parserAdapter | ✅ |
| 格式错误 URL（非 http/https、残缺 https://） | urlNormalizer / parserAdapter | ✅ |
| 未知平台 URL（YouTube 等 → PLATFORM_UNSUPPORTED） | platformDetector / parserAdapter | ✅ |
| 抖音/小红书/视频号/B站常见域名模式识别 | platformDetector | ✅ |
| 分享文字中包含链接自动提取 | urlNormalizer / parserAdapter / LinkInput | ✅ |
| 超长链接识别 | urlNormalizer | ✅ |
| 中文标题、无封面、无作者、无字幕的降级展示 | responseNormalizer / TextViewer 逻辑 | ✅ |
| 解析服务返回错误 → 具体错误码 | responseNormalizer / parserAdapter / HomePage | ✅ |
| 解析超时（AbortError） | parserClient / parserAdapter | ✅ |
| API 无法跨域（TypeError → CORS_ERROR） | parserClient / parserAdapter / SettingsPage | ✅ |
| 复制功能降级（clipboard mock / fallback 分支） | clipboard.ts + setup mock | ✅ |
| TXT 导出（标题/标签/正文组合） | exportService | ✅ |
| SRT 导出（标准字幕格式校验） | exportService | ✅ |
| JSON 导出（结构保留） | exportService | ✅ |
| 删除历史记录 / 清空历史 / 上限 100 条 | historyService | ✅ |
| 移动端布局 | 响应式 CSS（媒体查询）+ 组件测试；真实设备视口模拟受浏览器后端限制未执行，见 §5 | ⚠️ CSS 验证 |

## 2. 接口测试（对应需求 15.2，Mock 验证协议层）

| 用例 | 覆盖 | 通过 |
|---|---|---|
| 标准成功响应（media-parser retcode/data/succ）完整映射 | responseNormalizer | ✅ |
| 字段缺失 → null / 空数组，不编造 | responseNormalizer | ✅ |
| 错误响应（succ=false + error_code）→ 具体错误码 | responseNormalizer / parserAdapter | ✅ |
| 超时（AbortError）→ TIMEOUT | parserClient | ✅ |
| JSON 解析异常 / 非 JSON → RESPONSE_MALFORMED | responseNormalizer | ✅ |
| API Key 配置（key 参数 / Bearer 头 / 会话内存 / 脱敏） | parserClient / settingsService | ✅ |
| 不同服务返回结构映射（{code,data} 形态 / 小红书形态） | responseNormalizer / parserAdapter | ✅ |
| GET/POST 请求构造、url 编码 | parserClient | ✅ |

> Mock 仅验证代码协议层，**不代表**目标平台解析已通过真实测试（见 §4）。

## 3. 其他模块测试

- settingsService：Key 默认仅会话内存不落盘、勾选后才持久化、清除、脱敏 ✅
- historyService：成功/失败历史、摘要、删除、清空、截断、不含 Key ✅
- downloadManager：文件名清洗与平台前缀、扩展名猜测 ✅
- speechToTextService：未配置报错、成功转录、401/413 映射、空结果、扩展名校验 ✅
- UI：LinkInput（禁用/清空/粘贴提示/平台识别提示/回车）、HomePage（解析成功卡片、错误展示、历史写入）、SettingsPage（连接测试成功/失败、Key 隐藏） ✅

## 4. 真实解析测试（对应需求 15.3，诚实记录）

| 项目 | 结果 |
|---|---|
| 真实连接探测（media-parser 官方演示 mp.ucmao.cn） | 服务可达；浏览器真实请求被 CORS 拦截（官方演示未对 localhost 放行）；前端**正确显示**「连接失败：网络错误或跨域被拦截」——验证了真实请求链路与错误诊断 ✅ |
| 抖音真实解析（本机部署 media-parser 补丁版，API_ONLY） | ✅ **成功**——测试链接 `https://v.douyin.com/ps9jNFfCcRQ/`：返回 retcode 200，真实标题「每次闻到暴雨的味道就异常的兴奋 #暴雨来临#雨水味#暴雨#中性香」、desc、作者「我不是调香师」、真实 video_url（amemv.com 播放直链）、audio_url、cover_url ✅ |
| 小红书真实解析 | ⚠️ 未验证——需服务端 Cookie/xsec_token 凭证 |
| 微信视频号真实解析 | ⚠️ 未验证——需服务端凭证；分享链接有时效性 |
| 真实封面/标题/文案/媒体地址 | ✅ 抖音已验证（见上） |
| 下载真正保存文件 | ✅ **抖音已真实保存**——通过「后端代理下载」（/api/v1/download 媒体代理）在浏览器真实下载 MP4 到本地（999,842 字节，`file` 识别为 ISO Media, MP4）；「下载视频」直连路径按预期被平台 CDN 403/CORS 拦截并诚实降级 ✅ |
| 代理端点安全验证 | ✅ 白名单外域名（example.com）→ 403；缺失 url 参数 → 400；SSRF 公网 IP 校验、体积/超时限制已实现 ✅ |

## 5. 下载验证说明（对应需求 15.4）

- 「取得媒体直链」「浏览器能打开」「浏览器真正保存」三者已在前端下载策略中区分：fetch 保存成功才报「已开始下载」；失败降级为「打开原始地址」并明确提示手动保存；绝不弹出假成功。
- **真实媒体文件的端到端下载验证已通过**（2026-10-21）：线上前端 https://clip.solyoung.top + 本机补丁后端 http://localhost:8051，真实抖音视频经 /api/v1/download 完整保存为本地 MP4 文件（文件名含平台与标题，中文正确处理）。

## 6. 构建验证

- `npm ci` 依赖安装 ✅
- `npm test` 90/90 ✅（新增代理下载地址拼接/编码用例）
- `npm run typecheck`（tsc）✅
- `npm run build` ✅（产物：index.html + assets，~194KB JS / gzip 66KB）
- 本地 `vite preview` + 真实浏览器：首页/指南/支持平台/历史/设置 5 个页面渲染正常，无控制台错误；抖音分享文本粘贴 → 平台识别提示正常；设置页连接测试（真实请求 + CORS 错误）正常 ✅
- GitHub Pages 子路径兼容：`base:'./'` + Hash 路由（刷新无 404）✅

## 7. 已知缺口

1. 小红书 / 微信视频号真实解析：需部署公网解析后端并视平台情况配置服务端凭证后补测（抖音已测通）；
2. 口播转写真实识别：需用户配置语音识别 API（OpenAI 兼容）后以真实文件验证（前端流程与 Mock 已测）；
3. 移动端真实设备视口渲染：浏览器后端不支持视口模拟，已通过 CSS 媒体查询与组件测试保障，建议在手机浏览器做一次目测；
4. 公网解析后端（Render 等）尚未部署：本地后端已验证全链路，公网实例需用户在其账号一键部署（render.yaml 已就绪）。
