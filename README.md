# ClipText · 多平台短视频解析、下载与文案提取

一条链接，提取视频与文案。

面向短视频创作者、自媒体运营与剪辑人员的**多平台短视频解析工具**：粘贴抖音 / 小红书 / 微信视频号的分享链接，即可在解析服务支持范围内获取视频信息、下载视频、提取发布文案、查看已有字幕，并通过可配置的语音识别服务将口播转为文字。

> 架构本质：**纯静态前端（可部署 GitHub Pages）+ 可配置的解析后端（media-parser 兼容协议）**。
> GitHub Pages 不运行后端，解析能力由你配置的独立解析服务提供——这是本项目的核心设计，不是缺陷。

---

## 一、功能总览

| 功能 | 状态 | 说明 |
|---|---|---|
| 链接识别与平台检测 | ✅ 已实现 | 支持完整 URL、整段分享文字自动提取、中文/英文末尾标点清洗、未知平台明确提示 |
| 视频信息解析展示 | ✅ 已实现（依赖解析服务） | 标题/封面/作者/时长/文案/字幕/图集，缺失字段优雅降级，绝不编造 |
| 视频下载 | ✅ 已实现 | fetch 保存 → `<a download>` → 「打开原始地址」三级策略，失败给出真实原因 |
| 发布文案提取与复制 | ✅ 已实现 | 标题 / 正文 / 话题标签，复制、导出 TXT / JSON，保留原始换行 |
| 已有字幕展示与导出 | ✅ 已实现 | 按时间轴展示、时间戳开关、复制、导出 TXT / **标准 SRT** / JSON |
| 口播转文字（语音识别） | ✅ 已实现（需配置 ASR） | 兼容 OpenAI 风格 `/v1/audio/transcriptions`，文件上传，结果单独标注 |
| 解析服务配置与连接测试 | ✅ 已实现 | Base URL / API 路径 / 认证方式 / API Key（脱敏），真实请求测试 |
| 本地使用历史 | ✅ 已实现 | 浏览器 localStorage，100 条上限，删除/清空/重新解析 |
| 移动端适配 | ✅ 已实现 | 响应式布局、折叠菜单、无横向滚动 |
| B 站等平台扩展 | 🚧 架构预留 | 解析适配层已支持扩展，未完成真实接入 |

**验收口径（重要）**：本项目将「项目完成」与「平台解析完成」分开验收。项目本身（前端交互、配置、错误反馈、导出、历史、构建部署）已完成并全部经过自动化测试；**平台级解析成功与否取决于你配置的解析服务**，前端只负责诚实展示其结果。

## 二、目录结构

```
cliptext/
├── .github/workflows/deploy.yml   # GitHub Actions：测试 + 构建 + 部署 Pages
├── public/                        # 静态资源（favicon）
├── src/
│   ├── core/                      # 业务核心（纯逻辑，可单测）
│   │   ├── types.ts               # 统一数据契约（ParseResult / TextPayload / ...）
│   │   ├── constants.ts           # 平台配置、默认值、存储键
│   │   ├── platformDetector.ts    # 平台识别
│   │   ├── urlNormalizer.ts       # 链接规范化（整段文本提取、标点清洗）
│   │   ├── parserClient.ts        # 统一网络请求层（超时/认证/错误归类）
│   │   ├── parserAdapter.ts       # 解析入口（文本→链接→平台→请求→归一化）
│   │   ├── responseNormalizer.ts  # media-parser 协议响应归一化
│   │   ├── downloadManager.ts     # 下载流程（三级策略）
│   │   ├── transcriptService.ts   # 文案/字幕/整理稿组装
│   │   ├── speechToTextService.ts # 语音识别（OpenAI 风格）
│   │   ├── exportService.ts       # TXT / SRT / JSON 导出
│   │   ├── settingsService.ts     # 设置管理（Key 会话内存优先）
│   │   ├── historyService.ts      # 本地历史（100 条上限）
│   │   ├── serviceTest.ts         # 解析服务连接测试（真实请求）
│   │   ├── clipboard.ts / errors.ts
│   ├── components/                # UI 组件（TopNav/LinkInput/ResultCard/TextViewer/AsrPanel/Toast）
│   ├── pages/                     # 主工具页 / 设置 / 历史 / 指南 / 支持平台
│   ├── hooks/useHashRoute.ts      # 极简 Hash 路由（GitHub Pages 兼容）
│   ├── styles/global.css          # 设计变量（参考 solyoung.top/studio 品牌）
│   └── test/setup.ts
├── index.html / vite.config.ts / tsconfig.json
└── package.json
```

## 三、本地预览

```bash
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
npm test           # 运行全部单元/组件/接口 Mock 测试（90 个用例）
npm run build      # 类型检查 + 生产构建 → dist/
npm run preview    # 预览生产构建
```

## 四、部署到 GitHub Pages

**本仓库已实际部署上线**：仓库 [SolYoung-Ai/ClipText](https://github.com/SolYoung-Ai/ClipText)，线上地址 **https://clip.solyoung.top**（备用 https://solyoung-ai.github.io/ClipText/）。

### 4.1 一键部署（推荐）

仓库已包含 `.github/workflows/deploy.yml`：

1. 把本项目推送到 GitHub 仓库（`git push` 到 `main` 分支即可触发）；
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**；
3. 工作流会自动执行：`npm ci` → `npm test` → 类型检查 → `npm run build` → 上传 `dist` → 部署；
4. 部署完成后站点地址为 `https://<你的用户名>.github.io/<仓库名>/`。

### 4.2 构建与子路径说明

- Vite 已配置 `base: './'`（相对路径），任意子路径部署均正常；
- 路由使用 **Hash 路由**（`/#/settings` 等），页面刷新不会出现 404，无需服务端 rewrite；
- 工作流不含任何 API Key、Cookie 或私人凭证。

### 4.3 自定义域名

线上已绑定 **clip.solyoung.top**：仓库根 `public/CNAME` 含该域名（构建时自动带入 dist），DNS 需要一条 CNAME 记录 `clip → solyoung-ai.github.io`。`base: './'` 不会破坏已有域名配置。

## 五、解析服务配置（必读）

前端不内置解析能力。首次使用需在「设置 → 解析服务」填写：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| 解析服务地址（Base URL） | 空 | 如 `https://mp.example.com`（media-parser 兼容服务） |
| API 路径 | `/api/v1/parse` | media-parser 标准接口 |
| 认证方式 | 无认证 | 微服务模式免鉴权；运营模式用 `key` 参数或 `Bearer` 头 |
| API Key | 空 | 可选，**默认仅存会话内存**；勾选后才持久化到本机浏览器 |

保存后点击「测试连接」会发起**真实请求**验证，不会仅凭输入非空就显示成功。

### 5.1 推荐后端：media-parser（ClipText 补丁版）

- 上游仓库：<https://github.com/ucmao/media-parser>（MIT）；**已 fork 并打补丁**：[SolYoung-Ai/media-parser](https://github.com/SolYoung-Ai/media-parser)
- 平台覆盖：抖音（含字幕）、小红书、视频号等 50+；响应协议即本前端适配的协议。
- **为什么需要补丁**：上游原生 API 未携带 CORS 响应头，浏览器前端（clip.solyoung.top）无法直接跨域调用；且平台 CDN 直链在浏览器里常被 403 拦截。fork 补丁新增：
  - `cors_patch.py`：全 API CORS 头（来源可用 `CORS_ALLOW_ORIGINS` 环境变量控制，默认 `*`）；
  - `media_proxy.py`：`/api/v1/download` 媒体代理下载端点（服务端拉取 + 流式返回 + attachment 头，含域名白名单与 SSRF 防护，仅转发到平台媒体 CDN，不会被滥用为公共代理）；
  - `server.py`：CORS + 代理合一的 WSGI 入口；`render.yaml`：Render 一键部署蓝图。
- 部署方式：
  - **Render 一键部署**：新建 Web Service 时选择/导入 `SolYoung-Ai/media-parser` 仓库，采用 `render.yaml` Blueprint（或 Web Service 手动选择 Python 环境），环境变量按 `render.yaml` 设置（`API_ONLY=true`、`TRUST_PROXY_HEADERS=true`、`CORS_ALLOW_ORIGINS=*`），startCommand `gunicorn -b 0.0.0.0:$PORT --timeout 120 server:app`；
  - **本机直接使用（零成本、立即可用）**：`git clone` fork 仓库 → `pip install -r requirements.txt` → `API_ONLY=true CORS_ALLOW_ORIGINS='*' python server.py`（默认端口 8051）→ 前端设置页 Base URL 填 `http://localhost:8051`。浏览器允许 https 页面访问 localhost，本机跑后端即可「直接使用」；
  - **Docker Compose**：`git clone` → `docker compose up -d --build`（需自行应用补丁）→ `http://localhost:8051`。
- 免费托管评估：media-parser 是常驻服务，**免费层可运行但有限制**——Render/Railway/Zeabur 免费实例会休眠（闲置 15 分钟左右休眠，首次请求冷启动约 1 分钟）、CPU/内存配额有限、每月免费时长有限；云函数类平台需自备可常驻运行环境。免费方案会失效的典型条件：实例休眠、流量/时长超限、平台风控。**请勿把免费额度宣传为永久不限量**；自建（家庭服务器/闲置主机）或按量付费实例是更稳的选择。
- 获取 API Base URL：部署后为 `http://<主机>:8051`（或你的域名），路径保持 `/api/v1/parse`。

### 5.2 为什么必须有解析服务

- 平台分享短链（`v.douyin.com/xxx`、`xhslink.com/xxx`）的跳转目标需要服务端解析，浏览器跨域限制无法直接读取；
- 平台返回的媒体地址、字幕、图集需要服务端抓取与去水印；
- 纯前端只能做到「发起请求 + 展示结果」，无法代替解析后端。

### 5.3 密钥安全须知

- API Key 由你本人填写，默认仅保存在当前浏览器会话内存（刷新即需重填）；勾选持久化后存入本机 localStorage；
- **浏览器端直接使用的密钥并非服务器端秘密**：任何能访问该浏览器的人都能看到，请勿填写高权限密钥；
- 仓库源码、构建产物与 GitHub Actions 中不含任何密钥。

## 六、语音识别（口播转文字）配置

「口播转文字」与平台发布文案、原生字幕是**三种不同来源**，前端分别展示与导出，绝不混用。

**两种使用方式**：
1. **本机零成本方案（已实测可用）**：后端 fork（SolYoung-Ai/media-parser）内置了 faster-whisper 本地推理，**无需任何外部 API Key、零费用**。启动后端时设置 `ASR_MODEL=base`（首次自动下载 ~145MB 模型），前端 ASR Base URL 填后端地址（如 `http://localhost:8051`），Key 留空，模型填 `base`。主页会出现「⚡ 直接转写当前视频口播（免上传）」按钮——点击即由后端下载视频并本地转写，约 3~10 秒出结果。
2. **外部 OpenAI 兼容服务**：如果你想用云端 ASR（OpenAI whisper-1 / Groq / SiliconFlow 等），在「设置 → 语音识别服务」填写：
   - API Base URL：如 `https://api.openai.com/v1`；
   - 转录接口路径：默认 `/v1/audio/transcriptions`（OpenAI 风格 multipart 上传）；
   - API Key：自填；模型名称：如 `whisper-1`；语言：默认中文 `zh`。

使用：主页「口播转写」面板上传你有权处理的音视频文件（建议 ≤25MB），或直接点「直接转写当前视频口播」，转写结果填入「口播转写」标签页，支持复制与导出 TXT/SRT/JSON。转写结果单独标注为 AI 识别，与平台原生字幕区分。

## 七、三个平台目前支持什么（诚实声明）

| 平台 | 前端适配 | 真实解析 | 依赖 |
|---|---|---|---|
| 抖音 | ✅ 域名识别/协议适配完整 | ✅ **已用真实链接端到端验证**（2026-10-21，本机后端） | 公开链接即可；服务端可免 Cookie 解析 |
| 小红书 | ✅ 域名识别/协议适配完整 | ⏳ 待验证（依赖服务端凭证） | 部分链接需服务端凭证（Cookie / xsec_token） |
| 微信视频号 | ✅ 域名识别/协议适配完整 | ⏳ 待验证（依赖服务端凭证） | 分享链接有时效性；部分情况需服务端凭证 |
| 哔哩哔哩 | ⚠️ 仅平台识别（预留） | ❌ 未接入 | 需在解析服务支持后启用 |

**本仓库不内置任何平台的后端抓取逻辑**，也未内置第三方公共解析接口（公共接口不稳定且不可作为永久基础设施）。接入真实解析 = 部署/配置一个 media-parser 兼容服务（见第五节）。抖音为已实测平台，小红书/视频号取决于你部署的后端能力。

## 八、什么情况会导致解析失败

- 链接无效 / 已过期（视频号尤其有时效性）/ 私密 / 需登录的内容；
- 解析服务未配置 / 服务未启动 / 地址错误 / CORS 未放行 / API Key 错误；
- 平台规则调整，解析服务暂不支持该链接类型；
- 未知平台链接（仅支持前三平台，B站为预留）。

前端会对每种情况给出**具体错误码与可执行建议**（超时、CORS、认证失败、链接过期、平台不支持、服务不可用等），不会隐藏错误或伪装成功。

## 九、哪些功能已完成 / 未完成真实接入

**已完成（前端 + 本地能力）**：全部 UI、链接识别、协议适配层、下载三级策略 + 后端代理下载、文案/字幕/整理稿查看与导出（含标准 SRT）、本地文件转写流程、设置与连接测试、本地历史、错误诊断、移动端、自动化测试、构建与部署流水线。

**真实接入状态（2026-10-21 实测）**：
1. 抖音：✅ **真实解析 + 真实下载全部验证通过**——用公开抖音链接（v.douyin.com/ps9jNFfCcRQ/）在本机后端完成：解析出真实标题/文案/作者/封面/视频直链/音频；通过「后端代理下载」在浏览器真实保存 MP4 到本地（999,842 字节，文件类型正确）；
2. 口播转写的真实识别 → 需配置语音识别 API（见第六节），尚未配置；
3. 小红书 / 视频号 → 需部署公网后端（Render 等）并视平台情况配置服务端凭证后验证；
4. B 站真实接入 → 解析服务支持后，前端已预留适配位。

## 十、费用 / 凭证 / 外部服务

- 网站本身：零成本（GitHub Pages 免费托管）；
- 解析服务：media-parser 自部署（你的服务器/Docker）或免费/按量托管实例——免费层有休眠、时长、流量限制；本机自跑后端零成本；
- 语音识别：使用你自己的 API Key（OpenAI 兼容服务，按量计费）；
- 无需平台账号密码，本站不索取、不存储任何平台凭证。

## 十一、隐私、安全与平台规则

- 链接仅发送给你配置的解析服务；文件仅发送给你配置的语音识别服务；历史与设置仅存本机；
- 不绕过付费内容、DRM、登录权限；不提供平台账号密码输入；
- 解析后端的 URL 校验、限流与代理安全属后端职责（media-parser 已内置访问控制与限流；本项目的媒体代理端点另加域名白名单 + 公网 IP 校验 + 体积/超时限制，杜绝 SSRF 与公共代理滥用）；
- 下载内容仅供你在具有相应权利的范围内使用，遵守平台规则与版权要求；
- 本站与抖音、小红书、微信官方无任何合作关系。

## 十二、测试记录

见 [TESTING.md](./TESTING.md)。已运行：**13 个测试文件、90 个用例全部通过**；生产构建成功（JS 194KB / gzip 66KB）；本地预览 + 真实浏览器冒烟通过；对 media-parser 官方演示服务做了真实连接探测（服务可达但 CORS 拒绝，前端正确报告跨域错误）；**真实端到端验证**：本机后端 + 真实抖音链接完成解析/文案/下载全流程；线上 https://clip.solyoung.top 部署验证通过。

## 十三、开源许可证

- ClipText 源码：MIT（本仓库 LICENSE）
- 第三方项目引用与许可证：见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
