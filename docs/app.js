'use strict';
const $ = id => document.getElementById(id);
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading works without storage. */ } };
const stored = readLocal('ai-reading:saved', []);
const bookmarks = new Set(Array.isArray(stored) ? stored.filter(x => typeof x === 'string') : []);
let days = [], selected = '', topic = '全部', onlySaved = false;
const preferredTheme = readLocal('ai-reading:theme', null);
document.documentElement.dataset.theme = preferredTheme === 'dark' || (preferredTheme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
$('theme').onclick = () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; saveLocal('ai-reading:theme', next); };
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const urlSafe = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const formatDate = value => { const parts = value.split('-'); return `${Number(parts[1])}月${Number(parts[2])}日`; };
const hashDate = () => location.hash.slice(1).split('--')[0];
function editionParts(text, articles = []) {
  const headings=[]; let offset=0, fenced=false;
  for(const line of text.split(/(?<=\n)/)) {
    if(/^```/.test(line)) fenced=!fenced;
    const m=!fenced && line.match(/^(#{1,3})[ \t]+([^\n\r]+)/);
    if(m) headings.push({start:offset,level:m[1].length,title:m[2]});
    offset+=line.length;
  }
  const isArticle=h=>/^(?:[①②③④⑤⑥⑦⑧⑨⑩]|(?:第\s*)?[一二三四五六七八九十\d]+\s*(?:[篇、.．：:]|\s*[|｜]))/.test(h.title) || articles.some(a=>[a.title,a.originalTitle].filter(Boolean).some(t=>h.title.includes(t)));
  const candidates=headings.filter(isArticle);
  const level=candidates.length?Math.min(...candidates.map(h=>h.level)):2;
  const boundaries=headings.filter(h=>h.level<=level);
  const parts=[];
  if(!boundaries.length) return [{kind:'overview',label:'总体建议',raw:text}];
  if(boundaries[0].start>0) parts.push({kind:'overview',label:'总体建议',raw:text.slice(0,boundaries[0].start)});
  let articleIndex=0;
  boundaries.forEach((h,i)=>{
    const article=isArticle(h), closing=/阅读建议|阅读顺序|结语|总结|收尾|最后|小结/.test(h.title) && !article;
    const kind=article?'article':closing?'closing':'overview';
    parts.push({kind,label:article?`文章 ${++articleIndex}`:closing?'收尾说明':'总体建议',articleIndex:article?articleIndex-1:null,raw:text.slice(h.start,boundaries[i+1]?.start??text.length)});
  });
  return parts;
}
function editionReader(edition) {
  const wrapper=el('div',null,'edition-reader'); wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','本期完整推荐正文');
  editionParts(edition.fullText,edition.articles).forEach((part,i)=>{
    const panel=fullReader(part.raw); panel.classList.add('reading-panel',`reading-${part.kind}`); panel.id=`${edition.date}--section-${i}`; panel.setAttribute('aria-label',part.label);
    const flag=el('div',null,'section-flag'); flag.append(el('span',part.kind==='article'?String(part.articleIndex+1).padStart(2,'0'):part.kind==='closing'?'END':'READ', 'section-number'),el('span',part.label)); panel.prepend(flag);
    if(part.kind==='article' && edition.articles[part.articleIndex]) {
      const article=edition.articles[part.articleIndex], actions=el('div',null,'reading-actions');
      const link=el('a','阅读原文 ↗'); link.href=urlSafe(article.url); link.target='_blank'; link.rel='noopener noreferrer';
      const save=el('button',bookmarks.has(article.id)?'★ 已收藏':'☆ 收藏这篇'); save.setAttribute('aria-label',`收藏：${article.title}`); save.setAttribute('aria-pressed',String(bookmarks.has(article.id))); save.onclick=()=>{if(bookmarks.has(article.id))bookmarks.delete(article.id);else bookmarks.add(article.id);saveLocal('ai-reading:saved',[...bookmarks]);render();};
      actions.append(link,save); panel.append(actions);
    }
    wrapper.append(panel);
  });
  return wrapper;
}
// Safe, dependency-free Markdown display; the original fullText remains unchanged in the feed.
function inlineMarkdown(node, text) {
  text = text.replace(/\\\n/g,'\n');
  const tokens = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    node.append(document.createTextNode(text.slice(start, match.index)));
    const value = match[0];
    if (value.startsWith('`')) node.append(el('code',value.slice(1,-1)));
    else if (value.startsWith('**')) node.append(el('strong',value.slice(2,-2)));
    else if (value.startsWith('*')) node.append(el('em',value.slice(1,-1)));
    else { const m = value.match(/^\[([^\]]+)\]\((.+)\)$/); const a = el('a',m[1]); a.href = urlSafe(m[2].replace(/\\&/g,'&')); a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); }
    start = match.index + value.length;
  }
  node.append(document.createTextNode(text.slice(start)));
}
function fullReader(text) {
  const node = el('section',null,'full-reader'); node.setAttribute('aria-label','本期完整推荐正文');
  const lines = text.split(/\r?\n/); let i = 0;
  const special = line => /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|>\s?|```|\s*$)/.test(line);
  while(i < lines.length) {
    const line = lines[i];
    if(!line.trim()) { i++; continue; }
    if(line.startsWith('```')) { const block=[]; i++; while(i<lines.length && !lines[i].startsWith('```')) block.push(lines[i++]); if(i<lines.length) i++; const pre=el('pre'); pre.append(el('code',block.join('\n'))); node.append(pre); continue; }
    const heading=line.match(/^(#{1,6})\s+(.*)$/);
    if(heading) { const h=el('h'+Math.min(6,heading[1].length+1)); inlineMarkdown(h,heading[2]); node.append(h); i++; continue; }
    if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { node.append(el('hr')); i++; continue; }
    if(i+1<lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i+1])) {
      const cells=s=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
      const wrap=el('div',null,'table-scroll'), table=el('table'), head=el('thead'), row=el('tr');
      for(const value of cells(line)) { const th=el('th'); inlineMarkdown(th,value); row.append(th); } head.append(row); table.append(head); i+=2;
      const body=el('tbody'); while(i<lines.length && lines[i].includes('|') && lines[i].trim()) { const tr=el('tr'); for(const value of cells(lines[i++])) { const td=el('td'); inlineMarkdown(td,value); tr.append(td); } body.append(tr); } table.append(body); wrap.append(table); node.append(wrap); continue;
    }
    const list=line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/);
    if(list) { const ordered=Boolean(list[2]), ul=el(ordered?'ol':'ul'); if(ordered) ul.start=Number(list[2]); while(i<lines.length) { const m=lines[i].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/); if(!m || Boolean(m[2])!==ordered) break; const li=el('li'); inlineMarkdown(li,m[3]); ul.append(li); i++; } node.append(ul); continue; }
    if(/^>/.test(line)) { const block=[]; while(i<lines.length && /^>/.test(lines[i])) block.push(lines[i++].replace(/^>\s?/,'')); const quote=el('blockquote'); inlineMarkdown(quote,block.join('\n')); node.append(quote); continue; }
    const paragraph=[line]; i++; while(i<lines.length && !special(lines[i]) && !(i+1<lines.length && lines[i].includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i+1]))) paragraph.push(lines[i++]);
    const p=el('p'); inlineMarkdown(p,paragraph.join('\n')); node.append(p);
  }
  return node;
}
function validFeed(feed) {
  if (feed.schemaVersion !== 1 || !Array.isArray(feed.days)) throw Error('数据格式有误');
  const dates = new Set();
  for (const day of feed.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || dates.has(day.date) || !Array.isArray(day.articles) || !day.articles.length) throw Error('日期或文章列表有误');
    dates.add(day.date);
    if(day.fullText != null && (typeof day.fullText !== 'string' || !day.fullText.trim())) throw Error('完整正文有误');
    const ids = new Set();
    for (const a of day.articles) {
      if (!a.id || ids.has(a.id) || !urlSafe(a.url) || !['title','topic','source','author','summary','whyRead'].every(k => typeof a[k] === 'string' && a[k].trim()) || !Array.isArray(a.keyPoints) || !a.keyPoints.every(p => typeof p === 'string')) throw Error('文章字段不完整');
      ids.add(a.id);
    }
  }
  return feed.days.slice().sort((a,b) => b.date.localeCompare(a.date));
}
function chooseDate(date) { selected = date; if(date) location.hash = date; render(); }
function renderNav() {
  $('dates').replaceChildren();
  for (const day of days) { const b = el('button', null, 'date-button' + (selected === day.date ? ' active' : '')); b.append(el('span', `${day.date.slice(0,4)} · ${formatDate(day.date)}`), el('small', `${day.articles.length} 篇`)); if(selected === day.date) b.setAttribute('aria-current','date'); b.onclick = () => chooseDate(day.date); $('dates').append(b); }
  const toc=$('edition-nav');
  if(toc) {
    toc.replaceChildren(); const edition=days.find(d=>d.date===selected);
    if(edition?.fullText) {
      toc.append(el('div','本期目录','toc-heading'));
      editionParts(edition.fullText,edition.articles).forEach((part,i)=>{
        const a=el('a',null,'toc-link'); a.href=`#${edition.date}--section-${i}`;
        a.append(el('span',part.label,'toc-label'));
        if(part.kind==='article' && edition.articles[part.articleIndex]) a.append(el('small',edition.articles[part.articleIndex].topic));
        toc.append(a);
      });
    }
  }
  $('topics').replaceChildren();
  for (const name of ['全部', ...new Set(days.flatMap(d => d.articles.map(a => a.topic)))]) { const b = el('button', name, topic === name ? 'active' : ''); b.setAttribute('aria-pressed', String(topic === name)); b.onclick = () => { topic = name; render(); }; $('topics').append(b); }
}
function card(article, date, compact = false) {
  const node = el('article', null, 'card'), top = el('div', null, 'card-top'), key = article.id;
  const star = el('button', bookmarks.has(key) ? '★' : '☆', 'bookmark'); star.setAttribute('aria-label', `收藏：${article.title}`); star.setAttribute('aria-pressed', String(bookmarks.has(key))); star.onclick = () => { if(bookmarks.has(key)) bookmarks.delete(key); else bookmarks.add(key); saveLocal('ai-reading:saved', [...bookmarks]); render(); };
  top.append(el('span', article.topic, 'topic'), star); node.append(top, el('h3', article.title));
  if(article.originalTitle) node.append(el('p', article.originalTitle, 'original-title'));
  const meta = el('div', null, 'meta');
  for(const value of [article.source, article.author, article.publishedAt ? `发布于 ${article.publishedAt}` : '发布日期未确认', article.readingTimeLabel || (article.readingMinutes ? `约 ${article.readingMinutes} 分钟` : '阅读时长未确认')]) meta.append(el('span', value));
  if(onlySaved || $('search').value.trim()) meta.append(el('span', `收录于 ${date}`));
  node.append(meta);
  if(!compact) {
  node.append(el('p', article.summary, 'summary'));
  const reason = el('div', null, 'reason'); reason.append(el('strong','为什么值得读'),el('p',article.whyRead)); node.append(reason);
  if(article.keyPoints.length) { const section = el('section'), list = el('ol', null, 'points'); section.append(el('h4', '核心观点')); for(const point of article.keyPoints) list.append(el('li', point)); section.append(list); node.append(section); }
  }
  const a = el('a', '阅读原文 ↗', 'article-link'); a.href = urlSafe(article.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); return node;
}
function empty(title, message) { const node = el('div',null,'empty'); node.append(el('div','卷','empty-icon'),el('strong',title),el('p',message)); $('content').append(node); }
function render() {
  renderNav(); $('content').replaceChildren();
  if(!days.length) { empty('第一期，等待与你见面。','每日推荐接入后，这里会按日期保留每一期的摘要、核心观点和推荐理由。'); return; }
  const q = $('search').value.trim().toLocaleLowerCase(), global = Boolean(q || onlySaved);
  const matches = days.flatMap(d => (!global && d.date !== selected) ? [] : d.articles.filter(a => (topic === '全部' || a.topic === topic) && (!onlySaved || bookmarks.has(a.id)) && (!q || [d.fullText,a.title,a.originalTitle,a.topic,a.source,a.author,a.summary,a.whyRead,...a.keyPoints].join(' ').toLocaleLowerCase().includes(q))).map(a => ({a,date:d.date})));
  const heading = el('div',null,'day-heading'); heading.append(el('h2',global ? (onlySaved ? '收藏与搜索' : '搜索结果') : `${formatDate(selected)} · 今日阅读`),el('span', `${matches.length} 篇${global ? ' · 全部归档' : ' · 慢慢读，不着急'}`)); $('content').append(heading);
  const day = days.find(d => d.date === selected); if(!global && day?.intro) $('content').append(el('p',day.intro,'day-intro'));
  if(!matches.length) empty('这里暂时没有文章。', onlySaved ? '点击文章右上角的星标，即可加入收藏。收藏保存在当前浏览器。' : '换个关键词或主题，再找一找。');
  else {
    for(const date of [...new Set(matches.map(item=>item.date))]) {
      const edition=days.find(d=>d.date===date);
      if(edition.fullText) {
        if(global) $('content').append(el('h3',`${date} · 完整推荐`));
        $('content').append(editionReader(edition));
        if(editionParts(edition.fullText,edition.articles).filter(p=>p.kind==='article').length===edition.articles.length) continue;
        $('content').append(el('h3','本期原文与收藏','source-heading'));
      }
      for(const item of matches.filter(item=>item.date===date)) $('content').append(card(item.a,item.date,Boolean(edition.fullText)));
    }
  }
}
$('search').addEventListener('input',render);
$('saved').onclick = () => { onlySaved = !onlySaved; $('saved').setAttribute('aria-pressed',String(onlySaved)); render(); };
window.addEventListener('hashchange', () => { const date = hashDate(); if(days.some(d => d.date === date) && selected!==date) { selected = date; render(); } });
async function load() {
  try {
    const response = await fetch('./feed.json', {cache:'no-cache'}); if(!response.ok) throw Error('请求失败');
    const feed = await response.json(); days = validFeed(feed);
    selected = days.some(d => d.date === hashDate()) ? hashDate() : days[0]?.date || '';
    $('stats').textContent = `${days.length} 期归档 · ${days.reduce((n,d)=>n+d.articles.length,0)} 篇深度阅读`;
    $('day-count').textContent = `${days.length} 期`;
    if(feed.updatedAt) $('updated').textContent = `最近收录 ${new Date(feed.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`;
    $('status').textContent = ''; render();
    if(location.hash.includes('--section-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch { $('status').replaceChildren(el('span','暂时无法载入内容，请检查网络后重试。 ')); const retry = el('button','重新加载'); retry.onclick = load; $('status').append(retry); }
}
load();
