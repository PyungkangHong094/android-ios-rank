// 애플 순위 수집 — 두 피드 병행
// 1) 신형 공식 RSS (rss.marketingtools.apple.com): 전체 무료/유료, 최대 100위, 스키마 안정적
// 2) 구형 RSS (itunes.apple.com/rss): 장르별(게임 하위장르 포함) + 매출, 최대 200위.
//    deprecated 상태라 언제든 끊길 수 있어 차트 단위로 격리 (끊겨도 신형 RSS 차트는 유지)

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
    icon: app.artworkUrl100 ?? null,
    releaseDate: app.releaseDate ?? null,
  }));
}

export async function fetchAppleLegacyChart(country, feed, genreId, limit) {
  const genre = genreId ? `/genre=${genreId}` : '';
  const url = `https://itunes.apple.com/${country}/rss/${feed}/limit=${limit}${genre}/json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apple legacy RSS ${res.status}: ${url}`);
  const json = await res.json();
  const entries = [].concat(json.feed?.entry ?? []);
  if (!entries.length) throw new Error(`Apple legacy RSS 빈 응답: ${url}`);
  return entries.map((e, i) => ({
    rank: i + 1,
    id: e.id?.attributes?.['im:id'],
    name: e['im:name']?.label ?? '',
    developer: e['im:artist']?.label ?? '',
    icon: e['im:image']?.slice(-1)[0]?.label ?? null,
    releaseDate: e['im:releaseDate']?.label?.slice(0, 10) ?? null,
  }));
}

export async function collectApple(config) {
  const charts = {};
  for (const country of config.countries) {
    // 신형 RSS: 전체 무료/유료
    for (const chart of config.apple.charts) {
      const key = `apple:${country}:${chart}`;
      try {
        charts[key] = await withRetry(() => fetchAppleChart(country, chart, config.apple.topN));
        console.log(`[apple] ${key} — ${charts[key].length}개`);
      } catch (e) {
        console.error(`[apple] ${key} 실패: ${e.message}`);
        charts[key] = null;
      }
    }
    // 구형 RSS: 전체 매출
    if (config.appleLegacy?.overallGrossing) {
      const key = `apple:${country}:top-grossing`;
      try {
        charts[key] = await withRetry(() => fetchAppleLegacyChart(country, 'topgrossingapplications', null, config.appleLegacy.topN));
        console.log(`[apple] ${key} — ${charts[key].length}개`);
      } catch (e) {
        console.error(`[apple] ${key} 실패: ${e.message}`);
        charts[key] = null;
      }
    }
    // 구형 RSS: 게임 + 하위장르
    for (const chart of config.appleLegacy?.charts ?? []) {
      for (const genre of config.appleLegacy?.genres ?? []) {
        const key = `apple:${country}:${chart.key}:${genre.key}`;
        try {
          charts[key] = await withRetry(() => fetchAppleLegacyChart(country, chart.feed, genre.id, config.appleLegacy.topN));
          console.log(`[apple] ${key} — ${charts[key].length}개`);
        } catch (e) {
          console.error(`[apple] ${key} 실패: ${e.message}`);
          charts[key] = null;
        }
      }
    }
  }
  return charts;
}
