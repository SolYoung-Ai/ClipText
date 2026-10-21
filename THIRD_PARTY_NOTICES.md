# 第三方项目引用与许可证说明

## media-parser（协议适配参考）

- 仓库：https://github.com/ucmao/media-parser
- 许可证：MIT License
- 用途：ClipText 的「解析服务协议」以其 `/api/v1/parse` 接口契约（`retcode / retdesc / data / succ` 与 `title / desc / video_url / cover_url / author / subtitles` 等字段）为兼容标准。
- 复用方式：**未复制其任何源码**。仅在本项目 `src/core/responseNormalizer.ts` 中实现了对其公开响应格式的适配映射，并在 README 中给出部署说明，作为可配置的解析后端方案。
- 部署归属：media-parser 需独立部署（Docker / Python），不属于本静态前端仓库。

## SHY-downloader（思路参考）

- 仓库：https://github.com/andyshi70/SHY-downloader
- 许可证：MIT License
- 用途：参考其对微信视频号（在线解析 API / 元宝 Cookie）、抖音（ROUTER_DATA）、小红书（INITIAL_STATE + xsec_token）等平台解析思路，用于评估解析服务的平台能力与依赖。未复制其代码。

## VDownloader（思路参考）

- 仓库：https://github.com/JIaLeChye/VDownloader
- 许可证：仓库未声明明确开源许可证，仅作解析思路参考（抖音 `window._ROUTER_DATA`、小红书 `window.__INITIAL_STATE__`），未复制任何代码。

## 前端运行库

- React / ReactDOM：MIT
- Vite / Vitest / TypeScript / Testing Library：MIT 系许可，见各包 LICENSE。

## 声明

- ClipText 与抖音、小红书、微信官方无任何合作或授权关系。
- 下载内容仅供用户在具有相应权利的范围内使用，请遵守各平台规则与版权要求。
- 本项目不包含、也不协助绕过付费内容、DRM、登录权限或访问控制。
