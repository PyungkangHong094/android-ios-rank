import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactSnapshot, mergeRegistry, expandSnapshot } from '../src/storage.js';

const app = (id, rank, extra = {}) => ({
  rank, id, name: `앱${id}`, developer: `개발사${id}`, icon: `https://img/${id}.png`, releaseDate: null, ...extra,
});

test('compact→merge→expand 라운드트립으로 원본 복원', () => {
  const snap = { 'apple:kr:top-free': [app('a', 1), app('b', 2)], 'play:kr:top-free:all': null };
  const registry = mergeRegistry({}, snap);
  const restored = expandSnapshot(compactSnapshot(snap), registry);
  assert.deepEqual(restored, snap);
});

test('레지스트리 병합 시 새 값이 null이면 기존 값 유지 (플레이 출시일 보존)', () => {
  const registry = { a: { n: '앱a', d: '개발사a', i: 'old.png', r: '2026-01-01' } };
  mergeRegistry(registry, { chart: [app('a', 1, { releaseDate: null, icon: null })] });
  assert.equal(registry.a.r, '2026-01-01');
  assert.equal(registry.a.i, 'old.png');
});

test('구버전(통짜) 스냅샷은 그대로 통과', () => {
  const legacy = { 'apple:kr:top-free': [{ rank: 1, id: 'a', name: '앱a' }] };
  assert.deepEqual(expandSnapshot(legacy, {}), legacy);
});

test('레지스트리에 없는 앱도 안전하게 복원', () => {
  const restored = expandSnapshot({ _v: 2, charts: { c: ['ghost'] } }, {});
  assert.deepEqual(restored.c[0], { rank: 1, id: 'ghost', name: 'ghost', developer: '', icon: null, releaseDate: null });
});
