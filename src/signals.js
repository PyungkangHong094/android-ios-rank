// 고급 신호: 크로스 마켓 급등(양대 마켓 동시 급등) + 연속 상승 모멘텀

// 스토어 간 앱 ID가 달라 이름으로 매칭 — 소문자화 + 공백/기호 제거
export function normalizeName(name) {
  return String(name).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// 같은 나라에서 애플·플레이 양쪽 모두 급등(또는 신규 진입)한 앱 — 가장 강한 트렌드 신호
export function findCrossMarketSurges(diffs) {
  // store → country → normName → {name, rank, delta|null(신규), chartKey}
  const byStore = { apple: new Map(), play: new Map() };

  for (const [key, d] of Object.entries(diffs)) {
    if (!d?.hasBaseline) continue;
    const [store, country] = key.split(':');
    if (!byStore[store]) continue;
    for (const app of [...d.rising, ...d.newEntries]) {
      const norm = `${country}:${normalizeName(app.name)}`;
      if (!norm.split(':')[1]) continue;
      const cur = byStore[store].get(norm);
      // 여러 차트에 걸리면 가장 좋은 순위 기준
      if (!cur || app.rank < cur.rank) {
        byStore[store].set(norm, { name: app.name, country, rank: app.rank, delta: app.delta ?? null, chartKey: key });
      }
    }
  }

  const surges = [];
  for (const [norm, apple] of byStore.apple) {
    const play = byStore.play.get(norm);
    if (play) surges.push({ name: apple.name, country: apple.country, apple, play });
  }
  surges.sort((a, b) => Math.min(a.apple.rank, a.play.rank) - Math.min(b.apple.rank, b.play.rank));
  return surges;
}

// 연속 상승 모멘텀: 최근 N번의 스냅샷에서 매일 순위가 오르고 총 상승폭이 기준 이상인 앱
// history: 오래된 것 → 최신(오늘) 순서의 차트 배열(각각 앱 객체 배열). 오늘 차트는 필수.
export function findMomentum(history, { minRises = 2, minTotalRise = 15, maxRank = 100 } = {}) {
  const days = history.filter(Boolean);
  if (days.length < minRises + 1) return []; // 상승 횟수 + 1개의 스냅샷 필요

  const rankMaps = days.map((chart) => new Map(chart.map((a) => [a.id, a.rank])));
  const today = days[days.length - 1];
  const result = [];

  for (const app of today) {
    if (app.rank > maxRank) continue;
    const ranks = rankMaps.map((m) => m.get(app.id));
    if (ranks.some((r) => r == null)) continue; // 전 기간 차트에 있어야 함
    let rises = 0;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] < ranks[i - 1]) rises++;
      else { rises = 0; break; } // 하루라도 안 오르면 연속 아님
    }
    const totalRise = ranks[0] - ranks[ranks.length - 1];
    if (rises >= minRises && totalRise >= minTotalRise) {
      result.push({ ...app, ranks, totalRise, days: rises });
    }
  }
  result.sort((a, b) => b.totalRise - a.totalRise);
  return result;
}

// 전체 차트에 대해 모멘텀 계산 — snapshots: 오래된 것 → 최신 순서의 스냅샷 배열
export function findMomentumAll(snapshots, opts) {
  const momentums = {};
  const latest = snapshots[snapshots.length - 1];
  for (const key of Object.keys(latest)) {
    const history = snapshots.map((s) => s?.[key] ?? null);
    if (!history[history.length - 1]) continue;
    const m = findMomentum(history, opts);
    if (m.length) momentums[key] = m;
  }
  return momentums;
}
