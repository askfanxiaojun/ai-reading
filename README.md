# AI 阅读札记

[打开网站](https://askfanxiaojun.github.io/ai-reading/)

每天推荐三篇 AI 与产品深度文章，保留每一期在 ChatGPT 对话中展示的完整 Markdown 解读。支持按日期归档、文章标题/元数据/摘要/关键观点搜索、浏览器本地收藏和深浅色模式。

## 数据架构：方案 C（轻量索引 + 每日正文）

静态网站托管在 GitHub Pages；如果绑定 Cloudflare Pages，同样可以直接使用 main 分支的 `docs` 目录，不需要数据库和后端。

- `docs/index.json`：日期、文章元数据、摘要、关键观点及每日文件位置，不含任何完整 `fullText`。
- `docs/archive/YYYY/MM/YYYY-MM-DD.json`：单日完整三篇推荐（保留 `fullText` 原文、元数据和介绍）。
- `docs/app.js`：首屏只加载索引和当前日期正文；切换日期时按需请求对应分片，并缓存已读日期；搜索/收藏直接利用索引，不批量下载全部历史正文。
- 日期链接继续使用 `#YYYY-MM-DD`；收藏的本地存储文章 ID 不变，不会因拆分丢失。
- 搜索覆盖元数据与摘要，不执行跨历史正文全文检索；如果未来需要全文章搜索，再新增分片倒排索引。

不要重新创建或写入 `docs/feed.json`。发布规范与完整正文要求见 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)。

## 发布新的每日推荐

已连接 GitHub 的 ChatGPT 自动化应先创建/更新单日 archive 文件（并读回检查），再更新轻量索引（保留全部已有日期）。若同一天重复发布，仅替换当天，不清空历史；利用最新文件 SHA 避免冲突。索引的 `revision` 用于变更后刷新日期正文缓存。

本地还可以用无需凭证、无网络访问的验证和发布脚本：

```sh
python3 scripts/publish_digest.py /absolute/path/to/digest.json
```

该脚本校验恰好三篇、历史链接去重、完整正文、同日重跑幂等；先原子写入单日文件，再原子更新 `docs/index.json`。它**不会自动提交到 GitHub**，需要使用 Git 提交改动。

## 本地查看

```sh
python3 -m http.server 8000 --directory docs
```

访问 http://localhost:8000 。完整解读按原文存储，不转载来源文章全文。收藏仅保存在当前浏览器，不能跨设备同步。
