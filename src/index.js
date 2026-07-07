// 메인 파이프라인: 수집 → 스냅샷 저장 → 어제와 diff → 브리핑 → 텔레그램 발송
// 사용: node src/index.js [--dry-run]  (--dry-run: 발송 없이 콘솔 출력만)

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectApple } from './apple.js';
import { collectPlay } from './play.js';
import { diffSnapshots } from './diff.js';
import { buildBriefing } from './briefing.js';
import { sendTelegram } from './telegram.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const KST_OFFSET = 9 * 3600 * 1000;

function kstDateStr(ts) {
  return new Date(ts + KST_OFFSET).toISOString().slice(0, 10);
}

async function loadLatestSnapshot(beforeDate) {
  let files;
  try {
    files = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {
    return null;
  }
  const prev = files.filter((f) => f.slice(0, 10) < beforeDate).pop();
  if (!prev) return null;
  return JSON.parse(await readFile(path.join(DATA_DIR, prev), 'utf8'));
}

const dryRun = process.argv.includes('--dry-run');
const now = Date.now();
const today = kstDateStr(now);
const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));

console.log(`== ${today} 수집 시작 ==`);
const snapshot = { ...(await collectApple(config)), ...(await collectPlay(config)) };

const collected = Object.values(snapshot).filter(Boolean).length;
if (collected === 0) {
  console.error('모든 차트 수집 실패 — 스냅샷 저장 안 함');
  process.exit(1);
}

await mkdir(DATA_DIR, { recursive: true });
await writeFile(path.join(DATA_DIR, `${today}.json`), JSON.stringify(snapshot, null, 2));
const dates = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
await writeFile(path.join(DATA_DIR, 'index.json'), JSON.stringify(dates));
console.log(`스냅샷 저장: data/${today}.json (${collected}개 차트)`);

const yesterday = await loadLatestSnapshot(today);
const diffs = diffSnapshots(snapshot, yesterday, config, now);
const briefing = buildBriefing(diffs, today);

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
