// 애플 공식 마케팅 RSS — 무료, 인증 불필요, 스키마 안정적
// https://rss.marketingtools.apple.com/api/v2/{country}/apps/{chart}/{limit}/apps.json

import { withRetry } from './util.js';

export async function fetchAppleChart(country, chart, limit) {
  const url = `https://rss.marketingtools.apple.com/api/v2/${country}/apps/${chart}/${limit}/apps.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apple RSS ${res.status}: ${url}`);
  const json = await res.json();
  return json.feed.results.map((app, i) => ({
    rank: i + 1,
    id: app.id,
    name: app.name,
    developer: app.artistName,
    releaseDate: app.releaseDate ?? null,
    url: app.url,
  }));
}

export async function collectApple(config) {
  const charts = {};
  for (const country of config.countries) {
    for (const chart of config.apple.charts) {
      const key = `apple:${country}:${chart}`;
      try {
        charts[key] = await withRetry(() => fetchAppleChart(country, chart, config.topN));
        console.log(`[apple] ${key} — ${charts[key].length}개`);
      } catch (e) {
        console.error(`[apple] ${key} 실패: ${e.message}`);
        charts[key] = null;
      }
    }
  }
  return charts;
}
