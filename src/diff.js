// 어제 스냅샷 vs 오늘 스냅샷 diff — 신규 진입 / 급등 / 급락 판정

export function diffChart(today, yesterday, { risingThreshold, newReleaseDays, dropoutTopN = 20, now }) {
  if (!today) return null;
  const prevRank = new Map((yesterday ?? []).map((a) => [a.id, a.rank]));
  const hasBaseline = yesterday != null;

  const newEntries = [];
  const rising = [];
  const falling = [];

  const todayIds = new Set(today.map((a) => a.id));
  for (const app of today) {
    const prev = prevRank.get(app.id);
    if (prev == null) {
      if (hasBaseline) {
        const isFreshRelease =
          app.releaseDate != null &&
          (now - new Date(app.releaseDate).getTime()) / 86400000 <= newReleaseDays;
        newEntries.push({ ...app, isFreshRelease });
      }
      continue;
    }
    const delta = prev - app.rank; // 양수 = 상승
    if (delta >= risingThreshold) rising.push({ ...app, prevRank: prev, delta });
    else if (delta <= -risingThreshold) falling.push({ ...app, prevRank: prev, delta });
  }

  // 차트 아웃: 어제 상위권(≤ dropoutTopN)이었는데 오늘 차트에서 사라진 앱 — 급락보다 강한 신호
  const dropouts = (yesterday ?? [])
    .filter((a) => a.rank <= dropoutTopN && !todayIds.has(a.id))
    .map((a) => ({ ...a, prevRank: a.rank, rank: null }));

  newEntries.sort((a, b) => a.rank - b.rank);
  rising.sort((a, b) => b.delta - a.delta);
  falling.sort((a, b) => a.delta - b.delta);
  dropouts.sort((a, b) => a.prevRank - b.prevRank);

  return { hasBaseline, newEntries, rising, falling, dropouts };
}

export function diffSnapshots(todaySnap, yesterdaySnap, config, now) {
  const result = {};
  const opts = {
    risingThreshold: config.risingThreshold,
    newReleaseDays: config.newReleaseDays,
    dropoutTopN: config.dropoutTopN,
    now,
  };
  for (const [key, chart] of Object.entries(todaySnap)) {
    result[key] = diffChart(chart, yesterdaySnap?.[key] ?? null, opts);
  }
  return result;
}
