// 메인 파이프라인: 수집 → 어제와 diff → 신규앱 출시일 보강 → 저장(정규화+보존기간 정리) → 브리핑 → 텔레그램 발송
// 사용: node src/index.js [--dry-run]  (--dry-run: 발송 없이 콘솔 출력만)

import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectApple } from './apple.js';
import { collectPlay, enrichPlayNewEntries } from './play.js';
import { diffSnapshots } from './diff.js';
import { buildBriefing } from './briefing.js';
import { sendTelegram } from './telegram.js';
import { compactSnapshot, mergeRegistry, expandSnapshot } from './storage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const KST_OFFSET = 9 * 3600 * 1000;

function kstDateStr(ts) {
  return new Date(ts + KST_OFFSET).toISOString().slice(0, 10);
}

async function listSnapshotDates() {
  try {
    return (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
  } catch {
    return [];
  }
}

async function loadJSON(file, fallback = null) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

const dryRun = process.argv.includes('--dry-run');
const now = Date.now();
const today = kstDateStr(now);
const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));

console.log(`== ${today} 수집 시작 ==`);
const snapshot = { ...(await collectApple(config)), ...(await collectPlay(config)) };

const collected = Object.values(snapshot).filter(Boolean).length;
const total = Object.keys(snapshot).length;
console.log(`수집: ${collected}/${total}개 차트 성공`);
if (collected === 0) {
  console.error('모든 차트 수집 실패 — 스냅샷 저장 안 함');
  process.exit(1);
}

await mkdir(DATA_DIR, { recursive: true });
const registry = (await loadJSON('apps.json', {})) ?? {};

const prevDate = (await listSnapshotDates()).filter((d) => d < today).pop() ?? null;
const yesterday = prevDate ? expandSnapshot(await loadJSON(`${prevDate}.json`), registry) : null;
const diffs = diffSnapshots(snapshot, yesterday, config, now);
await enrichPlayNewEntries(diffs, snapshot, { newReleaseDays: config.newReleaseDays, now });

mergeRegistry(registry, snapshot);
await writeFile(path.join(DATA_DIR, 'apps.json'), JSON.stringify(registry));
await writeFile(path.join(DATA_DIR, `${today}.json`), JSON.stringify(compactSnapshot(snapshot)));

// 보존기간 지난 스냅샷 정리 (repo 비대화 방지)
const cutoff = kstDateStr(now - config.retentionDays * 86400000);
for (const d of await listSnapshotDates()) {
  if (d < cutoff) {
    await unlink(path.join(DATA_DIR, `${d}.json`));
    console.log(`보존기간 경과 삭제: data/${d}.json`);
  }
}
await writeFile(path.join(DATA_DIR, 'index.json'), JSON.stringify(await listSnapshotDates()));
console.log(`스냅샷 저장: data/${today}.json (${collected}개 차트, 레지스트리 ${Object.keys(registry).length}개 앱)`);

const briefing = buildBriefing(diffs, today, {
  dashboardUrl: config.dashboardUrl,
  briefingCategories: config.briefingCategories,
});

console.log('\n----- 브리핑 -----\n' + briefing + '\n------------------');

if (dryRun) {
  console.log('(dry-run — 발송 생략)');
} else {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수 필요');
    process.exit(1);
  }
  await sendTelegram(briefing, { token, chatId });
  console.log('텔레그램 발송 완료');
}
