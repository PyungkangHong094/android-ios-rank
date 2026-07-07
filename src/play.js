// 플레이스토어 — 공식 API가 없어 google-play-scraper 사용 (베스트에포트)
// 구글 HTML이 바뀌면 깨질 수 있으므로 차트 단위로 격리: 실패해도 애플/다른 차트는 진행

import gplay from 'google-play-scraper';

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

export async function collectPlay(config) {
  const charts = {};
  for (const country of config.countries) {
    for (const chart of config.play.charts) {
      for (const cat of config.play.categories) {
        const key = `play:${country}:${chart.key}:${cat.key}`;
        try {
          charts[key] = await fetchPlayChart(country, chart.collection, cat.category, config.topN);
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
