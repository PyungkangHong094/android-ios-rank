# rank-android-ios

앱스토어 + 플레이스토어 순위 급등을 매일 아침 9시(KST) 텔레그램으로 브리핑하는 파이프라인.
서버 없음 — GitHub Actions가 매일 실행하고, 순위 스냅샷은 `data/*.json`으로 repo에 커밋됨.

## 구조

```
[수집] 애플 공식 RSS + google-play-scraper
   ↓
[저장] data/YYYY-MM-DD.json (KST 기준)
   ↓
[비교] 어제 스냅샷과 diff → 신규 진입 / 급등(≥10계단) / 급락
   ↓
[발송] 텔레그램 봇
```

- 애플: `rss.marketingtools.apple.com` 공식 피드 — 안 깨짐
- 플레이: 스크래핑이라 깨질 수 있음 — 차트 단위로 격리돼 있어 깨져도 애플 브리핑은 계속 옴

## 웹 대시보드

https://pyungkanghong094.github.io/android-ios-rank/ — GitHub Pages가 repo의 `index.html`과 `data/*.json`을 그대로 서빙. 날짜/스토어/국가 필터로 신규 진입·급등·급락과 Top 50 전체를 볼 수 있고, 스냅샷이 커밋될 때마다 자동 갱신됨 (별도 빌드·서버 없음).

## 설정 (최초 1회)

1. **텔레그램 봇 만들기**: 텔레그램에서 [@BotFather](https://t.me/BotFather) → `/newbot` → 토큰 복사
2. **chat_id 얻기**: 만든 봇에게 아무 메시지 보낸 뒤 브라우저에서
   `https://api.telegram.org/bot<토큰>/getUpdates` 열면 `chat.id` 보임
3. **GitHub Secrets 등록**: repo → Settings → Secrets and variables → Actions
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. 끝. 매일 09:00 KST 자동 실행. 바로 테스트하려면 Actions 탭 → daily-briefing → Run workflow.

## 로컬 실행

```bash
npm install
npm run briefing:dry                  # 발송 없이 콘솔로 브리핑 확인
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... npm run briefing
```

## 커스텀 (`config.json`)

| 키 | 기본값 | 설명 |
|---|---|---|
| `topN` | 50 | 차트당 추적 순위 수 |
| `risingThreshold` | 10 | 급등/급락 판정 계단 수 |
| `newReleaseDays` | 14 | 🔥신작 표시 기준 (출시 N일 이내 + 신규 진입, 애플만) |
| `countries` | kr, us | 국가 |
| `apple.charts` | top-free, top-paid | 애플 RSS는 매출(top-grossing) 차트 미제공 |
| `play.categories` | all, game | google-play-scraper category 키 |

첫 실행은 기준 데이터가 없어서 "첫 수집" 안내만 오고, 둘째 날부터 변동 감지가 시작됨.
