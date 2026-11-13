#!/usr/bin/env python3
"""Publish one complete digest to a daily JSON shard and lightweight index.

No network access, external credentials, or GitHub operations. Writes are atomic
per file: the complete daily document is written before the index is updated.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from zoneinfo import ZoneInfo


def canonical_url(value):
    parts = urlsplit(value)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('article URL must be a public http(s) URL without credentials')
    query = [(k, v) for k, v in parse_qsl(parts.query)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip('/'),
                       urlencode(sorted(query)), ''))


def validate_day(day, require_full_text=False):
    if not isinstance(day, dict):
        raise ValueError('day must be an object')
    date = day.get('date', '')
    if dt.date.fromisoformat(date).isoformat() != date:
        raise ValueError('date must be YYYY-MM-DD')
    if not isinstance(day.get('intro', ''), str):
        raise ValueError('intro must be a string')
    if require_full_text or 'fullText' in day:
        if not isinstance(day.get('fullText'), str) or not day['fullText'].strip():
            raise ValueError('fullText must preserve the complete recommendation response')
    articles = day.get('articles')
    if not isinstance(articles, list) or len(articles) != 3:
        raise ValueError('each daily digest must have exactly three verified articles')
    urls, ids = set(), set()
    for article in articles:
        for key in ('id', 'title', 'topic', 'source', 'author', 'summary', 'whyRead', 'url'):
            if not isinstance(article.get(key), str) or not article[key].strip():
                raise ValueError(f'missing required string: {key}')
        url = canonical_url(article['url'])
        if url in urls or article['id'] in ids:
            raise ValueError('duplicate article in daily digest')
        urls.add(url)
        ids.add(article['id'])
        if article.get('originalTitle') is not None and not isinstance(article['originalTitle'], str):
            raise ValueError('originalTitle must be a string or null')
        published = article.get('publishedAt')
        if published is not None and dt.date.fromisoformat(published).isoformat() != published:
            raise ValueError('publishedAt must be YYYY-MM-DD or null')
        minutes = article.get('readingMinutes')
        if minutes is not None and (type(minutes) is not int or minutes < 1):
            raise ValueError('readingMinutes must be a positive integer or null')
        points = article.get('keyPoints')
        if not isinstance(points, list) or any(not isinstance(p, str) or not p.strip() for p in points):
            raise ValueError('keyPoints must be a list of non-empty strings')
    return urls, ids


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def merge_index(index, day, path, revision):
    if index.get('schemaVersion') != 1 or index.get('storageMode') != 'daily-archive-v1' or not isinstance(index.get('days'), list):
        raise ValueError('unsupported index schema')
    new_urls, new_ids = validate_day(day, require_full_text=True)
    retained, seen_dates = [], set()
    for old in index['days']:
        old_urls, old_ids = validate_day(old)
        if old['date'] in seen_dates:
            raise ValueError('duplicate indexed date')
        seen_dates.add(old['date'])
        if old['date'] == day['date']:
            continue
        if new_urls & old_urls or new_ids & old_ids:
            raise ValueError(f'article already recommended on {old["date"]}')
        retained.append(old)
    item = {
        'date': day['date'],
        'intro': day.get('intro', ''),
        'path': path,
        'revision': revision,
        'articles': day['articles'],
    }
    previous = next((x for x in index['days'] if x['date'] == day['date']), None)
    if previous is not None and all(previous.get(k) == item[k] for k in ('date','intro','path','articles')):
        return index
    result = dict(index)
    result['updatedAt'] = revision
    result['days'] = sorted([item, *retained], key=lambda d: d['date'], reverse=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('digest', type=Path, help='A complete daily digest JSON containing fullText')
    parser.add_argument('--index', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/index.json')
    args = parser.parse_args()

    day = read_json(args.digest)
    validate_day(day, require_full_text=True)
    index = read_json(args.index)
    base = args.index.parent
    date = day['date']
    relative_path = f'archive/{date[:4]}/{date[5:7]}/{date}.json'
    daily_path = base / relative_path
    old_day = read_json(daily_path) if daily_path.exists() else None
    if old_day is not None:
        validate_day(old_day, require_full_text=True)

    revision = dt.datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')
    new_index = merge_index(index, day, relative_path, revision)
    if old_day == day and new_index == index:
        print('Unchanged: this digest is already published.')
        return

    if old_day != day:
        atomic_json(daily_path, day)
        if read_json(daily_path) != day:
            raise RuntimeError('daily shard verification failed; index not modified')
    if new_index != index:
        atomic_json(args.index, new_index)
    if read_json(daily_path) != day or read_json(args.index)['days'] != new_index['days']:
        raise RuntimeError('post-publish verification failed')
    print(f'Published {date} to {daily_path}; {len(new_index["days"])} dates indexed.')


if __name__ == '__main__':
    main()
