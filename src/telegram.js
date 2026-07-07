// 텔레그램 봇 발송 — 4096자 제한 대응 청크 분할

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
  for (const part of chunk(text)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: part, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`텔레그램 발송 실패 ${res.status}: ${body}`);
    }
  }
}
