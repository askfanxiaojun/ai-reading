# AI 阅读札记

每日三篇 AI 与产品深度阅读。静态网页，无构建依赖、无 API Key，适配 GitHub Pages 项目路径和自定义域名。

## 当前状态

网站源码和发布校验脚本已完成，目标仓库为 askfanxiaojun/ai-reading，使用 main /docs 发布。Pages 和每日同步正在部署验证。`docs/feed.json` 是空归档，不包含示例文章。现有 ChatGPT 定时任务未改动。没有完整取回历史推荐，因此没有伪造历史内容。

## 功能

- 日期归档与日期链接（例如 `/#2026-10-20`）。
- 跨全部归档搜索标题、摘要、核心观点、来源与作者。
- 主题筛选、当前浏览器收藏、浅色与深色模式。
- 正文直接展示摘要和推荐理由，核心观点可展开，附原文链接；不转载原文全文。
- 原生 DOM 文本渲染，不把文章文本当成 HTML；仅接受 HTTP(S) 原文链接。
- 内容读取失败有重试入口；没有内容时显示明确的空状态。

## 部署方式

仓库 `askfanxiaojun/ai-reading` 采用 **main 分支 /docs 目录发布**。

1. 将此目录下全部文件提交到仓库 main 分支。
2. Settings → Pages → Build and deployment → Source 选择 Deploy from a branch，分支 main、目录 /docs，保存。
3. 默认访问地址为 `https://askfanxiaojun.github.io/ai-reading/`，实际应以 GitHub 返回地址为准。
4. 首次部署成功后发布一个真实日报，核验网页能读到该期内容，再更新现有定时任务。

默认不配置自定义域名。需要域名时先确认精确域名，再按 GitHub Pages 域名部署助手流程检查 Pages 和 DNS 当前状态后执行。分支发布时 CNAME 放在 docs/；此包未添加 CNAME，避免绑定未确认的主机名。

## 内容格式

`docs/feed.json` 是唯一公开内容文件：

```json
{"schemaVersion":1,"updatedAt":null,"days":[]}
```

每个 `days` 项包含日期、导读和 3 篇文章。完整字段说明见 `CONTENT_CONTRACT.md`。若有本地执行环境，可运行：

```sh
python3 scripts/publish_digest.py /absolute/path/to/digest.json
```

脚本在替换前校验字段与重复链接，失败不会改动文件；同一天原样重跑不产生变化，修订当期不影响其他日期。URL 会去除跟踪参数后做跨期去重。它只修改本地文件，不执行提交、联网或部署。

## 自动同步

建议让现有 ChatGPT 任务继续生成内容，完成后通过已连接的 GitHub 更新 **同一个** `docs/feed.json`。无需另加模型 API，也无需在公开网页放密钥。待仓库可写、Pages 发布验证成功后，再使用 `AUTOMATION_APPENDIX.md` 的补充指令更新原任务。

不要直接把本包当作已接通的自动化。应进行一次真实写入与线上回读，证明后台任务具备所需 GitHub 工具并能持续写入。写入完成与网页可见分别报告；无法发布时保留原任务的阅读输出，并明确指出同步失败。

## 本地查看

在项目目录运行 `python3 -m http.server 8000 --directory docs`，打开 `http://localhost:8000`。浏览器直接用 file:// 打开可能无法读取 feed.json。

收藏只存在当前浏览器中，不会跨设备同步。网站显示推荐摘要与解读，完整原文仍由来源网站提供。
