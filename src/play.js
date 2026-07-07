// 플레이스토어 — 공식 API가 없어 google-play-scraper 사용 (베스트에포트)
// 구글 HTML이 바뀌면 깨질 수 있으므로 차트 단위로 격리: 실패해도 애플/다른 차트는 진행

import gplay from 'google-play-scraper';
import { withRetry } from './util.js';

export async function fetchPlayChart(country, collection, category, limit) {
  const apps = await gplay.list({
    collection: gplay.collection[collection],
    category: gplay.category[category],
    country,
    num: limit,
  });
  return apps.map((app, i) => ({
    rank: i + 1,
    id: app.appId,
    name: app.title,
    developer: app.developer,
    releaseDate: null, // list API는 출시일 미제공
    url: app.url,
  }));
}

// 신규 진입 앱만 상세 조회해서 출시일 보강 (전체 조회는 요청량 20배라 회피)
// diff의 newEntries와 스냅샷 양쪽에 releaseDate를 채워 🔥신작 감지와 대시보드 표시를 가능하게 함
export async function enrichPlayNewEntries(diffs, snapshot, { newReleaseDays, now, maxPerChart = 10 }) {
  for (const [key, d] of Object.entries(diffs)) {
    if (!key.startsWith('play:') || !d?.newEntries?.length) continue;
    const country = key.split(':')[1];
    for (const app of d.newEntries.slice(0, maxPerChart)) {
      try {
        const detail = await gplay.app({ appId: app.id, country });
        const released = detail.released ? new Date(detail.released) : null;
        if (released && !Number.isNaN(released.getTime())) {
          app.releaseDate = released.toISOString().slice(0, 10);
          app.isFreshRelease = (now - released.getTime()) / 86400000 <= newReleaseDays;
          const snapEntry = snapshot[key]?.find((a) => a.id === app.id);
          if (snapEntry) snapEntry.releaseDate = app.releaseDate;
        }
      } catch (e) {
        console.warn(`[play] ${app.id} 출시일 조회 실패: ${e.message}`);
      }
    }
  }
}

export async function collectPlay(config) {
  const charts = {};
  for (const country of config.countries) {
    for (const chart of config.play.charts) {
      for (const cat of config.play.categories) {
        const key = `play:${country}:${chart.key}:${cat.key}`;
        try {
          charts[key] = await withRetry(() => fetchPlayChart(country, chart.collection, cat.category, config.topN));
          console.log(`[play] ${key} — ${charts[key].length}개`);
        } catch (e) {
          console.error(`[play] ${key} 실패: ${e.message}`);
          charts[key] = null;
        }
      }
    }
  }
  return charts;
}
