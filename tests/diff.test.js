import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffChart } from '../src/diff.js';

const NOW = new Date('2026-07-07T09:00:00+09:00').getTime();
const OPTS = { risingThreshold: 10, newReleaseDays: 14, now: NOW };
const app = (id, rank, releaseDate = null) => ({ rank, id, name: `앱${id}`, releaseDate });

test('어제 없던 앱은 신규 진입', () => {
  const d = diffChart([app('a', 1), app('b', 2)], [app('b', 1)], OPTS);
  assert.equal(d.newEntries.length, 1);
  assert.equal(d.newEntries[0].id, 'a');
});

test('신규 진입 + 출시 14일 이내면 신작 플래그', () => {
  const d = diffChart([app('a', 1, '2026-07-01'), app('b', 2, '2025-01-01')], [app('c', 1)], OPTS);
  assert.equal(d.newEntries.find((x) => x.id === 'a').isFreshRelease, true);
  assert.equal(d.newEntries.find((x) => x.id === 'b').isFreshRelease, false);
});

test('임계값 이상 상승만 급등, 하락은 급락', () => {
  const today = [app('up', 5), app('flat', 20), app('down', 40)];
  const yest = [app('up', 15), app('flat', 25), app('down', 30)];
  const d = diffChart(today, yest, OPTS);
  assert.deepEqual(d.rising.map((x) => x.id), ['up']);
  assert.equal(d.rising[0].delta, 10);
  assert.deepEqual(d.falling.map((x) => x.id), ['down']);
  assert.equal(d.falling[0].delta, -10);
});

test('9계단 상승은 급등 아님 (경계값)', () => {
  const d = diffChart([app('a', 6)], [app('a', 15)], OPTS);
  assert.equal(d.rising.length, 0);
});

test('기준(어제) 없으면 신규 진입 판정 안 함', () => {
  const d = diffChart([app('a', 1)], null, OPTS);
  assert.equal(d.hasBaseline, false);
  assert.equal(d.newEntries.length, 0);
});

test('오늘 수집 실패(null)면 diff도 null', () => {
  assert.equal(diffChart(null, [app('a', 1)], OPTS), null);
});

test('급등은 상승폭 큰 순으로 정렬', () => {
  const d = diffChart([app('a', 5), app('b', 3)], [app('a', 20), app('b', 30)], OPTS);
  assert.deepEqual(d.rising.map((x) => x.id), ['b', 'a']);
});
