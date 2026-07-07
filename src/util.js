// 일시적 네트워크 실패 대응 — 지수 백오프 재시도

export async function withRetry(fn, { tries = 3, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        const delay = baseDelayMs * 2 ** i;
        console.warn(`  재시도 ${i + 1}/${tries - 1} (${delay}ms 후): ${e.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
