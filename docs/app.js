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
function validFeed(feed) {
  if (feed.schemaVersion !== 1 || !Array.isArray(feed.days)) throw Error('数据格式有误');
  const dates = new Set();
  for (const day of feed.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || dates.has(day.date) || !Array.isArray(day.articles) || !day.articles.length) throw Error('日期或文章列表有误');
    dates.add(day.date);
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
  $('topics').replaceChildren();
  for (const name of ['全部', ...new Set(days.flatMap(d => d.articles.map(a => a.topic)))]) { const b = el('button', name, topic === name ? 'active' : ''); b.setAttribute('aria-pressed', String(topic === name)); b.onclick = () => { topic = name; render(); }; $('topics').append(b); }
}
function card(article, date) {
  const node = el('article', null, 'card'), top = el('div', null, 'card-top'), key = article.id;
  const star = el('button', bookmarks.has(key) ? '★' : '☆', 'bookmark'); star.setAttribute('aria-label', `收藏：${article.title}`); star.setAttribute('aria-pressed', String(bookmarks.has(key))); star.onclick = () => { if(bookmarks.has(key)) bookmarks.delete(key); else bookmarks.add(key); saveLocal('ai-reading:saved', [...bookmarks]); render(); };
  top.append(el('span', article.topic, 'topic'), star); node.append(top, el('h3', article.title));
  if(article.originalTitle) node.append(el('p', article.originalTitle, 'original-title'));
  const meta = el('div', null, 'meta');
  for(const value of [article.source, article.author, article.publishedAt ? `发布于 ${article.publishedAt}` : '发布日期未确认', article.readingMinutes ? `约 ${article.readingMinutes} 分钟` : '阅读时长未确认']) meta.append(el('span', value));
  if(onlySaved || $('search').value.trim()) meta.append(el('span', `收录于 ${date}`));
  node.append(meta, el('p', article.summary, 'summary'));
  const reason = el('div', null, 'reason'); reason.append(el('strong','为什么值得读'),el('p',article.whyRead)); node.append(reason);
  if(article.keyPoints.length) { const details = el('details'), list = el('ol', null, 'points'); details.append(el('summary', '展开核心观点')); for(const point of article.keyPoints) list.append(el('li', point)); details.append(list); node.append(details); }
  const a = el('a', '阅读原文 ↗', 'article-link'); a.href = urlSafe(article.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); return node;
}
function empty(title, message) { const node = el('div',null,'empty'); node.append(el('div','卷','empty-icon'),el('strong',title),el('p',message)); $('content').append(node); }
function render() {
  renderNav(); $('content').replaceChildren();
  if(!days.length) { empty('第一期，等待与你见面。','每日推荐接入后，这里会按日期保留每一期的摘要、核心观点和推荐理由。'); return; }
  const q = $('search').value.trim().toLocaleLowerCase(), global = Boolean(q || onlySaved);
  const matches = days.flatMap(d => (!global && d.date !== selected) ? [] : d.articles.filter(a => (topic === '全部' || a.topic === topic) && (!onlySaved || bookmarks.has(a.id)) && (!q || [a.title,a.originalTitle,a.topic,a.source,a.author,a.summary,a.whyRead,...a.keyPoints].join(' ').toLocaleLowerCase().includes(q))).map(a => ({a,date:d.date})));
  const heading = el('div',null,'day-heading'); heading.append(el('h2',global ? (onlySaved ? '收藏与搜索' : '搜索结果') : `${formatDate(selected)} · 今日阅读`),el('span', `${matches.length} 篇${global ? ' · 全部归档' : ' · 慢慢读，不着急'}`)); $('content').append(heading);
  const day = days.find(d => d.date === selected); if(!global && day?.intro) $('content').append(el('p',day.intro,'day-intro'));
  if(!matches.length) empty('这里暂时没有文章。', onlySaved ? '点击文章右上角的星标，即可加入收藏。收藏保存在当前浏览器。' : '换个关键词或主题，再找一找。');
  else for(const item of matches) $('content').append(card(item.a,item.date));
}
$('search').addEventListener('input',render);
$('saved').onclick = () => { onlySaved = !onlySaved; $('saved').setAttribute('aria-pressed',String(onlySaved)); render(); };
window.addEventListener('hashchange', () => { const date = location.hash.slice(1); if(days.some(d => d.date === date)) { selected = date; render(); } });
async function load() {
  try {
    const response = await fetch('./feed.json', {cache:'no-cache'}); if(!response.ok) throw Error('请求失败');
    const feed = await response.json(); days = validFeed(feed);
    selected = days.some(d => d.date === location.hash.slice(1)) ? location.hash.slice(1) : days[0]?.date || '';
    $('stats').textContent = `${days.length} 期归档 · ${days.reduce((n,d)=>n+d.articles.length,0)} 篇深度阅读`;
    $('day-count').textContent = `${days.length} 期`;
    if(feed.updatedAt) $('updated').textContent = `最近收录 ${new Date(feed.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`;
    $('status').textContent = ''; render();
  } catch { $('status').replaceChildren(el('span','暂时无法载入内容，请检查网络后重试。 ')); const retry = el('button','重新加载'); retry.onclick = load; $('status').append(retry); }
}
load();
