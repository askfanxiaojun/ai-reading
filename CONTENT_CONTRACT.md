# 内容约定

一个日报对象：

```json
{
  "date": "YYYY-MM-DD",
  "intro": "本期导读，可选。只根据本期文章概括。",
  "fullText": "本次在 ChatGPT 对话里给用户的完整三篇推荐正文，原文逐段保留，支持 Markdown",
  "articles": [
    {
      "id": "稳定且全局唯一的文章标识，建议直接使用规范化原文URL",
      "title": "中文标题",
      "originalTitle": "原文标题，可选",
      "url": "https://来源网站/真实文章路径",
      "topic": "Agent 产品",
      "source": "来源名称",
      "author": "作者；未确认则明确填作者未确认",
      "publishedAt": null,
      "readingMinutes": null,
      "summary": "完整的中文观点摘要，可用换行分段",
      "keyPoints": ["核心观点一", "核心观点二"],
      "whyRead": "为何值得 AI 产品经理阅读，含具体工作启发"
    }
  ]
}
```

上面的单篇对象仅说明字段，正式每期必须有三篇。不要将占位符作为真实内容发布。

日期使用 Asia/Shanghai 的推荐日期，严格 YYYY-MM-DD。发布时间未知使用 null，网页显示未确认；预计阅读时长为正整数或 null。主题自由命名但尽量稳定。禁止把 ChatGPT 引用占位符、伪造链接或未经验证的事实写入公开内容；引用用真实来源链接表述。

`docs/index.json` 的 schemaVersion 固定 1，storageMode 固定 `daily-archive-v1`，updatedAt 为带时区 ISO 时间或 null，days 按日期倒序。每个日期必须有唯一完整正文文件，索引只存该期元数据与存储路径，不得包含 fullText。保留全部既有日期，同一天只保存一期。用于去重的原文 URL 去除片段、utm_*、fbclid 与 gclid 参数；对同一文章不能通过改变参数再次推荐。

## 完整正文是唯一阅读主稿

新增或修订日报必须保存非空的 fullText：先写出准备在 ChatGPT 对话里展示的完整推荐，再将同一份正文逐字放入 fullText。不得为网页重新概括、润色、压缩、限制字数或另写简版。保留三篇文章的全部详细解读、论证过程、案例、数据、局限、推荐理由、产品启发、对比表格，以及三篇之间的导读、横向比较和结尾。篇幅以内容需要为准，不因页面长而删减。每篇原文的 7–20 分钟筛选标准不限制解读正文长度。

fullText 可以使用 Markdown。站点安全显示标题、段落、强调、列表、引用、代码块、表格和真实来源链接，直接展示全文，不截断、不折叠正文。未支持的格式按文本保留，原始 Markdown 始终完整存储。内部引用占位符须等义转换为真实来源 URL，除此之外不得改变或删除正文；来源网页全文不属于可转载的对话解读。

articles 是选题元数据与检索索引，summary、keyPoints、whyRead 仍保留，但不能代替 fullText；它们只用于兼容历史记录。存在 fullText 时，页面以它为完整正文，文章卡片仅提供原文入口、信息与收藏。筛选或收藏命中某篇时，该期 fullText 仍完整显示，保留上下文。

旧日报缺少 fullText 时可继续显示已有字段，但不得把它标成已恢复的完整版；界面直接展开已有核心观点。不得根据摘要反向编造历史完整解读。应在拿到原有完整输出后替换同一天，并保留其余日期不变。

发布前与发布后分别比较 fullText 是否与本次对话推荐的正文一致（允许将内部引用标记转为真实 URL）；可使用字符数与 SHA-256 检查传输前后未截断，若不一致应修复再宣称完整同步。不得以“摘要更适合网页”为由删节。


## 阅读层级

完整正文在网页中分为：总体建议、文章 1、文章 2、文章 3、收尾说明。未来推荐可用同一级的二级 Markdown 标题标记三篇文章（例如“## ① ……”）和“## 本期阅读建议”；单篇内部的“核心观点”“为什么值得读”等使用三级标题。开场导读与推荐总表保留在第一篇之前。不要为了结构改写或缩短正文。网页根据这些标题分区并提供本期目录，每篇末尾放原文入口与收藏，所有正文仍默认展开。历史正文保持原样，分区只影响排版。

## 方案 C：每日 JSON 分片 + 轻量索引（发布协议，必读）

现行唯一生产数据源是 `docs/archive/YYYY/MM/YYYY-MM-DD.json`，每个文件完整保存一个日报对象（`date`、`intro`、`articles`、`fullText`），严格不删减 fullText。全站索引位于 `docs/index.json`：顶层为 `schemaVersion: 1`、`storageMode: "daily-archive-v1"`、`updatedAt`、`days`。days 每条含 `date`、`intro`、`path`（相对于 docs 的路径，例如 `archive/2026/11/2026-11-13.json`）、`revision`（该日期正文的版本标记，发布可使用当前带时区 ISO 时间）以及 `articles`（保留原全部文章元数据字段，但没有 fullText）。严禁把完整正文写入 index.json；索引的全文搜索仅覆盖每篇的 title、originalTitle、topic、source、author、summary、whyRead 和 keyPoints；进入具体日期才加载完整正文。旧版 `docs/feed.json` 不再是生产入口，禁止向其中继续追加内容。

每次发布严格按以下顺序：

1. 先读取 main 的 `CONTENT_CONTRACT.md` 和 `docs/index.json`，记录索引当前 blob SHA；用全部历史 articles[].url 规范化去重，保留所有日期/文章。相同日期只修改该日期，不能清空历史。
2. 生成 ChatGPT 将展示的完整 Markdown 正文，作为当期 fullText 逐字存入一个日报对象。校验恰好三篇文章，核实来源、发布时间、阅读时间等；记录 fullText 字符数及 SHA-256（可用时）。
3. 单日文件写入：读取 `docs/archive/YYYY/MM/YYYY-MM-DD.json`；存在时以它的最新 blob SHA 使用 GitHub update_file，不存在时使用 create_file。提交后读回验证日期、文章、fullText 完全相同。如内容完全相同且索引也无变化，不提交。
4. 再读取最新 main 的 `docs/index.json`（避免期间他人新增内容），仅把当日元数据更新/插入 days，路径与日文件一致，revision 更新为本次带时区的 ISO 时间；全部其余日期与字段原样保留，按日期倒序，更新 updatedAt 和 schemaVersion/storageMode，使用当前 index.json SHA 更新索引。并发冲突重新读取和合并后最多重试一次。
5. 重新读回当天文件与索引，验证 index 中三篇 id/url、路径和正文对应，历史日期及条目数未丢失、fullText 与 ChatGPT 逐字一致。发布前先写完整日期文件再更新索引，避免出现“索引有当天但正文不存在”。若第二步失败，保留已提交的日期文件并报告“索引更新失败”，下次可安全继续，不得声称发布成功。
6. 检查网页实际加载的 `index.json` 与当日 archive 文件；若站点尚未更新，报告“GitHub 已提交，网页部署待确认”，不得编造已上线。保留按 `#YYYY-MM-DD` 跳转；站点域名以已验证的实际部署地址为准。

浏览器仍从 localStorage 保存收藏文章 ID，不修改它；旧日期锚点与本期目录由 index + 完整日期正文共同渲染。归档文件名、文章 ID 和日期不因迁移变化。迁移后不要重新创建整站级的 fullText 聚合文件；未来搜索需要完整正文时，考虑静态按月倒排索引，而不是回退到前端每次下载所有日报。
