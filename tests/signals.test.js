import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, findCrossMarketSurges, findMomentum } from '../src/signals.js';
import { diffChart } from '../src/diff.js';

const app = (id, rank, name = `앱${id}`) => ({ rank, id, name, releaseDate: null });

test('이름 정규화 — 대소문자·공백·기호 무시', () => {
  assert.equal(normalizeName('Royal Match!'), normalizeName('royalmatch'));
  assert.equal(normalizeName('넷플릭스'), '넷플릭스');
  assert.notEqual(normalizeName('Royal Match'), normalizeName('Royal Kingdom'));
});

test('크로스 마켓: 같은 나라에서 양대 마켓 동시 급등만 매칭', () => {
  const diffs = {
    'apple:kr:top-free': {
      hasBaseline: true, newEntries: [],
      rising: [{ id: 'a1', name: 'Royal Match', rank: 3, delta: 17 }], falling: [], dropouts: [],
    },
    'play:kr:top-free:all': {
      hasBaseline: true, newEntries: [{ id: 'p1', name: 'ROYAL MATCH', rank: 5, isFreshRelease: false }],
      rising: [{ id: 'p2', name: '혼자 급등한 앱', rank: 1, delta: 20 }], falling: [], dropouts: [],
    },
    'play:us:top-free:all': {
      hasBaseline: true, newEntries: [],
      rising: [{ id: 'p3', name: '다른나라 Royal Match', rank: 2, delta: 30 }], falling: [], dropouts: [],
    },
  };
  const surges = findCrossMarketSurges(diffs);
  assert.equal(surges.length, 1);
  assert.equal(surges[0].name, 'Royal Match');
  assert.equal(surges[0].country, 'kr');
  assert.equal(surges[0].apple.delta, 17);
  assert.equal(surges[0].play.delta, null); // 신규 진입
});

test('모멘텀: 연속 상승 + 총 상승폭 충족 시만', () => {
  const d1 = [app('up', 40), app('zigzag', 30), app('slow', 20)];
  const d2 = [app('up', 25), app('zigzag', 35), app('slow', 18)];
  const d3 = [app('up', 10), app('zigzag', 20), app('slow', 16)];
  const m = findMomentum([d1, d2, d3], { minRises: 2, minTotalRise: 15, maxRank: 100 });
  assert.deepEqual(m.map((x) => x.id), ['up']); // zigzag: 중간 하락, slow: 총 4계단뿐
  assert.equal(m[0].totalRise, 30);
  assert.deepEqual(m[0].ranks, [40, 25, 10]);
});

test('모멘텀: 스냅샷 부족하면 빈 결과', () => {
  assert.deepEqual(findMomentum([[app('a', 1)], [app('a', 2)]], { minRises: 2 }), []);
});

test('차트 아웃: 어제 상위권만, 오늘 있으면 제외', () => {
  const yest = [app('gone', 3), app('stay', 5), app('deepGone', 50)];
  const today = [app('stay', 4)];
  const d = diffChart(today, yest, { risingThreshold: 10, newReleaseDays: 14, dropoutTopN: 20, now: Date.now() });
  assert.deepEqual(d.dropouts.map((x) => x.id), ['gone']); // deepGone은 50위라 제외
  assert.equal(d.dropouts[0].prevRank, 3);
  assert.equal(d.dropouts[0].rank, null);
});
