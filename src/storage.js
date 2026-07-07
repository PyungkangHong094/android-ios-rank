// 스냅샷 저장 포맷 v2 — 정규화
// 날짜 파일: { "_v": 2, "charts": { "<chartKey>": ["appId", ...] | null } } (순위 = 배열 인덱스+1)
// 앱 레지스트리(data/apps.json): { "<appId>": { "n": 이름, "d": 개발사, "i": 아이콘URL, "r": 출시일 } }
// 150개 차트 × 200위를 매일 통짜로 저장하면 하루 ~10MB라, 앱 메타데이터는 레지스트리에 한 번만 저장

export function compactSnapshot(snapshot) {
  const charts = {};
  for (const [key, chart] of Object.entries(snapshot)) {
    charts[key] = chart ? chart.map((a) => a.id) : null;
  }
  return { _v: 2, charts };
}

// 오늘 수집분으로 레지스트리 갱신 — 새 값이 없으면(null) 기존 값 유지
// (플레이 출시일은 신규 진입 때 한 번만 조회되므로 기존 값 보존이 필수)
export function mergeRegistry(registry, snapshot) {
  for (const chart of Object.values(snapshot)) {
    if (!chart) continue;
    for (const a of chart) {
      const old = registry[a.id] ?? {};
      registry[a.id] = {
        n: a.name ?? old.n ?? '',
        d: a.developer ?? old.d ?? '',
        i: a.icon ?? old.i ?? null,
        r: a.releaseDate ?? old.r ?? null,
      };
    }
  }
  return registry;
}

// 날짜 파일(v2 또는 구버전 통짜 포맷)을 앱 객체 배열로 복원
export function expandSnapshot(fileJson, registry) {
  if (fileJson?._v !== 2) return fileJson; // 구버전: 이미 풀 객체
  const snapshot = {};
  for (const [key, ids] of Object.entries(fileJson.charts)) {
    snapshot[key] = ids
      ? ids.map((id, i) => {
          const m = registry[id] ?? {};
          return { rank: i + 1, id, name: m.n ?? String(id), developer: m.d ?? '', icon: m.i ?? null, releaseDate: m.r ?? null };
        })
      : null;
  }
  return snapshot;
}
