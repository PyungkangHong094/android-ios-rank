// 어제 스냅샷 vs 오늘 스냅샷 diff — 신규 진입 / 급등 / 급락 판정

export function diffChart(today, yesterday, { risingThreshold, newReleaseDays, now }) {
  if (!today) return null;
  const prevRank = new Map((yesterday ?? []).map((a) => [a.id, a.rank]));
  const hasBaseline = yesterday != null;

  const newEntries = [];
  const rising = [];
  const falling = [];

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

  newEntries.sort((a, b) => a.rank - b.rank);
  rising.sort((a, b) => b.delta - a.delta);
  falling.sort((a, b) => a.delta - b.delta);

  return { hasBaseline, newEntries, rising, falling };
}

export function diffSnapshots(todaySnap, yesterdaySnap, config, now) {
  const result = {};
  const opts = {
    risingThreshold: config.risingThreshold,
    newReleaseDays: config.newReleaseDays,
    now,
  };
  for (const [key, chart] of Object.entries(todaySnap)) {
    result[key] = diffChart(chart, yesterdaySnap?.[key] ?? null, opts);
  }
  return result;
}
