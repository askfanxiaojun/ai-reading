#!/usr/bin/env python3
"""Validate and atomically append one daily digest. No network or credentials."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


def canonical_url(value):
    parts = urlsplit(value)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('article URL must be a public http(s) URL without credentials')
    query = [(k, v) for k, v in parse_qsl(parts.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip('/'), urlencode(sorted(query)), ''))


def validate_day(day):
    if not isinstance(day, dict):
        raise ValueError('day must be an object')
    date = day.get('date', '')
    if dt.date.fromisoformat(date).isoformat() != date:
        raise ValueError('date must be YYYY-MM-DD')
    if not isinstance(day.get('intro', ''), str):
        raise ValueError('intro must be a string')
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
        if published is not None:
            if dt.date.fromisoformat(published).isoformat() != published:
                raise ValueError('publishedAt must be YYYY-MM-DD or null')
        minutes = article.get('readingMinutes')
        if minutes is not None and (type(minutes) is not int or minutes < 1):
            raise ValueError('readingMinutes must be a positive integer or null')
        points = article.get('keyPoints')
        if not isinstance(points, list) or not points or any(not isinstance(p, str) or not p.strip() for p in points):
            raise ValueError('keyPoints must be a non-empty list of strings')
    return urls, ids


def merge(feed, day):
    if feed.get('schemaVersion') != 1 or not isinstance(feed.get('days'), list):
        raise ValueError('unsupported feed schema')
    new_urls, new_ids = validate_day(day)
    old_dates = set()
    retained = []
    for old in feed['days']:
        old_urls, old_ids = validate_day(old)
        if old['date'] in old_dates:
            raise ValueError('duplicate archived date')
        old_dates.add(old['date'])
        if old['date'] == day['date']:
            continue
        if new_urls & old_urls or new_ids & old_ids:
            raise ValueError(f'article already recommended on {old["date"]}')
        retained.append(old)
    if next((old for old in feed['days'] if old['date'] == day['date']), None) == day:
        return feed
    return {'schemaVersion': 1, 'updatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'days': sorted([*retained, day], key=lambda d: d['date'], reverse=True)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('digest', type=Path)
    parser.add_argument('--feed', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/feed.json')
    args = parser.parse_args()
    feed = json.loads(args.feed.read_text(encoding='utf-8'))
    merged = merge(feed, json.loads(args.digest.read_text(encoding='utf-8')))
    if merged == feed:
        print('Unchanged: this digest was already published.')
        return
    args.feed.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=args.feed.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(merged, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(temp, args.feed)
    finally:
        Path(temp).unlink(missing_ok=True)
    print(f'Published {len(merged["days"])} daily digests to {args.feed}')


if __name__ == '__main__':
    main()
