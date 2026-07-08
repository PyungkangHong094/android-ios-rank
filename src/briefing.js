// diff 결과를 텔레그램용 텍스트 브리핑으로 변환

const CHART_LABEL = {
  'top-free': '무료',
  'top-paid': '유료',
  'top-grossing': '매출',
};
const STORE_LABEL = { apple: '🍎 앱스토어', play: '🤖 플레이' };
const COUNTRY_LABEL = { kr: '🇰🇷', us: '🇺🇸' };
const CAT_LABEL = { all: '전체', game: '게임' };

function chartTitle(key) {
  const [store, country, chart, cat] = key.split(':');
  const parts = [STORE_LABEL[store] ?? store, COUNTRY_LABEL[country] ?? country, CHART_LABEL[chart] ?? chart];
  if (cat) parts.push(CAT_LABEL[cat] ?? cat);
  return parts.join(' ');
}

function line(app) {
  if (app.totalRise != null) {
    return `  ${app.rank}위 ${app.name} (${app.ranks.join('→')}, ${app.days}일 연속 ▲${app.totalRise})`;
  }
  if (app.rank == null) {
    return `  ${app.prevRank}위→OUT ${app.name}`;
  }
  if (app.delta != null) {
    const arrow = app.delta > 0 ? `▲${app.delta}` : `▼${-app.delta}`;
    return `  ${app.rank}위 ${app.name} (${app.prevRank}→${app.rank}, ${arrow})`;
  }
  const fresh = app.isFreshRelease ? ' 🔥신작' : '';
  return `  ${app.rank}위 ${app.name}${fresh}`;
}

function crossMarketLine(s) {
  const fmt = (m) => (m.delta != null ? `${m.rank}위(▲${m.delta})` : `${m.rank}위(NEW)`);
  return `  ${COUNTRY_LABEL[s.country] ?? s.country} ${s.name} — 🍎${fmt(s.apple)} · 🤖${fmt(s.play)}`;
}

export function buildBriefing(diffs, dateStr, {
  maxPerSection = 5, dashboardUrl = null, briefingCategories = null,
  crossMarket = [], momentums = {},
} = {}) {
  const out = [`📊 앱마켓 데일리 브리핑 — ${dateStr}`];
  let hasSignal = false;

  // 크로스 마켓 급등 — 양대 마켓 동시 급등은 가장 강한 신호라 맨 위에
  if (crossMarket.length) {
    hasSignal = true;
    out.push(`\n🎯 크로스 마켓 급등 (애플+플레이 동시) ${crossMarket.length}개\n` +
      crossMarket.slice(0, maxPerSection * 2).map(crossMarketLine).join('\n'));
  }

  for (const [key, d] of Object.entries(diffs)) {
    // 하위 카테고리는 대시보드 전용 — 텔레그램은 주요 카테고리만 (안 그러면 150개 차트가 다 옴)
    const cat = key.split(':')[3] ?? 'all';
    if (briefingCategories && !briefingCategories.includes(cat)) continue;
    if (d == null) {
      out.push(`\n${chartTitle(key)}\n  ⚠️ 수집 실패 (다음 실행에서 재시도)`);
      continue;
    }
    if (!d.hasBaseline) {
      out.push(`\n${chartTitle(key)}\n  첫 수집 — 내일부터 변동 감지 시작`);
      continue;
    }
    const sections = [];
    if (d.newEntries.length) {
      sections.push(`🆕 신규 진입 ${d.newEntries.length}개\n` + d.newEntries.slice(0, maxPerSection).map(line).join('\n'));
    }
    if (d.rising.length) {
      sections.push(`🚀 급등 ${d.rising.length}개\n` + d.rising.slice(0, maxPerSection).map(line).join('\n'));
    }
    if (momentums[key]?.length) {
      sections.push(`📈 연속 상승 ${momentums[key].length}개\n` + momentums[key].slice(0, maxPerSection).map(line).join('\n'));
    }
    if (d.falling.length) {
      sections.push(`📉 급락 ${d.falling.length}개\n` + d.falling.slice(0, maxPerSection).map(line).join('\n'));
    }
    if (d.dropouts?.length) {
      sections.push(`💨 차트 아웃 ${d.dropouts.length}개\n` + d.dropouts.slice(0, maxPerSection).map(line).join('\n'));
    }
    if (sections.length) {
      hasSignal = true;
      out.push(`\n${chartTitle(key)}\n${sections.join('\n')}`);
    }
  }

  if (!hasSignal && out.length === 1) out.push('\n오늘은 특이 변동 없음 ✨');
  if (dashboardUrl) out.push(`\n📈 전체 순위 보기: ${dashboardUrl}`);
  return out.join('\n');
}
