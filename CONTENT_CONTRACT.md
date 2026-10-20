# 内容约定

一个日报对象：

```json
{
  "date": "YYYY-MM-DD",
  "intro": "本期导读，可选。只根据本期文章概括。",
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

`feed.json` 的 schemaVersion 固定 1，updatedAt 为带时区 ISO 时间或 null，days 按日期倒序。保留全部既有日期，同一天只保存一期。用于去重的原文 URL 去除片段、utm_*、fbclid 与 gclid 参数；对同一文章不能通过改变参数再次推荐。

站点对文本字段按纯文本渲染，不解析 Markdown。不要把说明性的 Markdown 标记带入正文。摘要应保持原推荐的信息量，不因网页归档而缩写；本站不抓取、转载来源站点全文。
