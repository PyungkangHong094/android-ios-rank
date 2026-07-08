// 텔레그램 봇 발송 — 4096자 제한 대응 청크 분할, chatId 쉼표 구분 다중 발송 지원

const MAX_LEN = 3800;

function chunk(text) {
  if (text.length <= MAX_LEN) return [text];
  const chunks = [];
  let buf = '';
  for (const lineText of text.split('\n')) {
    if (buf.length + lineText.length + 1 > MAX_LEN) {
      chunks.push(buf);
      buf = lineText;
    } else {
      buf = buf ? `${buf}\n${lineText}` : lineText;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function sendTelegram(text, { token, chatId }) {
  const chatIds = String(chatId).split(',').map((s) => s.trim()).filter(Boolean);
  const errors = [];
  for (const id of chatIds) {
    try {
      for (const part of chunk(text)) {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: id, text: part, disable_web_page_preview: true }),
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      }
      console.log(`텔레그램 발송 완료: ${id}`);
    } catch (e) {
      errors.push(`${id} → ${e.message}`);
    }
  }
  // 일부만 실패하면 성공한 쪽은 유지하고 실패만 알림 (전부 실패 시에만 throw)
  if (errors.length === chatIds.length) throw new Error(`텔레그램 발송 전체 실패: ${errors.join(' / ')}`);
  if (errors.length) console.error(`텔레그램 일부 발송 실패: ${errors.join(' / ')}`);
}
