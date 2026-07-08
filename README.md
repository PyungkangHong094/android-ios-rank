# rank-android-ios

앱스토어 + 플레이스토어 순위 급등을 매일 아침 9시(KST) 텔레그램으로 브리핑하고, 웹 대시보드로 전체 순위를 보여주는 파이프라인.
서버 없음 — GitHub Actions가 매일 실행하고, 데이터는 `data/*.json`으로 repo에 커밋됨.

## 구조

```
[수집] 애플 신형 RSS(전체 100위) + 애플 구형 RSS(게임 하위장르·매출 200위) + google-play-scraper(200위)
   ↓     — 국가(KR/US) × 차트(무료/유료/매출) × 카테고리(전체·게임·게임 하위 17종) ≈ 150개 차트
[저장] data/YYYY-MM-DD.json (순위 ID 배열) + data/apps.json (앱 이름·개발사·로고·출시일 레지스트리)
   ↓     — 정규화 저장으로 하루 ~10MB → ~500KB. retentionDays 지난 스냅샷은 자동 삭제
[비교] 어제와 diff → 신규 진입 / 🔥신작(출시 14일 이내) / 급등(≥10계단) / 급락
   ↓     — 플레이 신규 진입 앱만 상세 조회해서 출시일 보강 (요청 최소화)
[신호] 🎯 크로스 마켓 급등(애플+플레이 동시 급등 — 이름 매칭, 가장 강한 트렌드 신호)
   ↓     📈 연속 상승(N일 연속 순위 상승 모멘텀) / 💨 차트 아웃(어제 Top20 → 오늘 차트에서 소멸)
[발송] 텔레그램(주요 카테고리만) + 웹 대시보드(전체 카테고리)
```

- 애플 신형 RSS(`rss.marketingtools.apple.com`): 공식·안정, 전체 무료/유료, 최대 100위
- 애플 구형 RSS(`itunes.apple.com/rss`): 장르별·매출 지원, 최대 200위 — deprecated라 언제든 끊길 수 있고, 끊겨도 다른 차트는 유지됨
- 플레이: 스크래핑(비공식) — 차트 단위 격리 + 재시도 3회 + 요청 간 300ms 간격
- 파이프라인 실패 시 실패 알림이 텔레그램으로 옴

## 웹 대시보드

https://pyungkanghong094.github.io/android-ios-rank/ — 날짜(◀▶)/스토어/국가/카테고리 필터, 앱 이름 검색, 앱 로고, Top 200 전체 테이블(펼침). 기본은 "주요(전체·게임)" 카테고리만 표시되고, 게임 하위장르(캐주얼·퍼즐·RPG 등)는 카테고리 필터로 선택.

## 설정 (최초 1회)

1. **텔레그램 봇 만들기**: [@BotFather](https://t.me/BotFather) → `/newbot` → 토큰 복사
2. **chat_id 얻기**: 봇에게 아무 메시지 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates`에서 `chat.id` 확인
3. **GitHub Secrets 등록**: repo → Settings → Secrets and variables → Actions
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
4. 끝. 매일 09:00 KST 자동 실행. 바로 테스트는 Actions 탭 → daily-briefing → Run workflow.

## 로컬 실행

```bash
npm install
npm test                              # diff·저장 로직 테스트
npm run briefing:dry                  # 발송 없이 콘솔로 브리핑 확인 (수집 몇 분 소요)
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... npm run briefing
```

## 커스텀 (`config.json`)

| 키 | 기본값 | 설명 |
|---|---|---|
| `risingThreshold` | 10 | 급등/급락 판정 계단 수 |
| `dropoutTopN` | 20 | 차트 아웃 감시 범위 (어제 Top N 이내였던 앱만) |
| `momentum` | 2회 연속·총 15계단·100위 이내 | 연속 상승 판정 기준 (스냅샷 3일치부터 자동 활성화) |
| `newReleaseDays` | 14 | 🔥신작 표시 기준 (출시 N일 이내 + 신규 진입) |
| `retentionDays` | 60 | 스냅샷 보존 기간 (지나면 자동 삭제) |
| `briefingCategories` | all, game | 텔레그램에 포함할 카테고리 (대시보드는 항상 전체) |
| `countries` | kr, us | 국가 |
| `apple.topN` / `appleLegacy.topN` / `play.topN` | 100 / 200 / 200 | 차트당 추적 순위 수 (100은 신형 RSS 최대치) |
| `appleLegacy.genres` / `play.categories` | 게임 하위 17종 | 수집 카테고리 |

첫 실행은 기준 데이터가 없어서 "첫 수집" 안내만 오고, 둘째 날부터 변동 감지가 시작됨.
새 카테고리를 추가한 날도 해당 차트는 "첫 수집"으로 취급됨.
