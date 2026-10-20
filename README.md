# AI 阅读札记

[打开网站](https://askfanxiaojun.github.io/ai-reading/)

每日三篇 AI 与产品深度阅读，按日期归档，支持全文搜索、主题筛选、浏览器收藏和深浅色模式。

## 发布状态

GitHub Pages 已启用，发布源为 main 分支 /docs 目录，HTTPS 已开启。2026-10-20 首期三篇内容已发布并通过线上读取与交互验证；本期沿用原推荐选题，摘要根据可核实来源重新整理。

现有 ChatGPT「推荐AI产品文章」任务已增加 GitHub 归档指令，保留原有每日上午 9 点附近的运行安排与筛选规则。首次无人值守运行仍待后续执行验证，不能把本次交互中的发布测试等同于后台任务已成功运行。未来任务若缺少 GitHub 写入能力，应明确报告同步失败并保留完整推荐。

## 内容与更新

唯一公开内容文件是 `docs/feed.json`，数据规范见 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md)。更新内容时保留其他全部日期，携带 GitHub 当前文件 SHA 进行更新，发生冲突应重新读取合并；不要覆盖历史。发布存在短暂延迟。

可选本地发布：

```sh
python3 scripts/publish_digest.py /absolute/path/to/digest.json
```

脚本校验恰好三篇、规范化链接去重、同日重跑幂等，以及失败时保留原文件。脚本不联网、不执行提交。

## 本地查看

```sh
python3 -m http.server 8000 --directory docs
```

访问 http://localhost:8000 。网页没有模型 API Key 或构建依赖。内容按纯文本渲染，只提供摘要、解读与来源链接，不转载原文全文。收藏保存在当前浏览器，不跨设备同步。
