# ICS 뷰어·검증기·CSV 변환기 (정적 웹앱)

`.ics`(iCalendar, RFC 5545) 파일을 브라우저에서 바로 열어 표로 보고, 표준 준수 여부를 검사하고,
CSV·JSON·TSV로 내보내는 **영문 미니 웹앱**입니다. 해외 패시브 부업 1호기(추후 애드센스) 산출물입니다.

- **서버·빌드·CDN 없음**: `index.html` + `assets/` + 정적 파일. GitHub Pages에 그대로 올리면 동작합니다.
- **100% 클라이언트 사이드**: 파일은 `FileReader`로 읽어 브라우저 메모리에서만 파싱합니다. 업로드 엔드포인트가 없고, 네트워크 요청은 페이지 자체 파일(HTML/CSS/JS/폰트)뿐입니다(브라우저 검수에서 확인).
- **샘플 자동 로드**: 첫 화면에서 `sample.ics` 10개 일정이 바로 보여 방문자가 파일 없이 체험할 수 있습니다.

## 폴더 구성

```
index.html                     앱 본체 + SEO 정적 콘텐츠(H1·How-to·FAQ·JSON-LD)
privacy.html                   개인정보처리방침 (애드센스 필수)
robots.txt  sitemap.xml        검색엔진 기본 골격 (canonical/sitemap URL: https://marcj81.github.io/ics-viewer-online/)
sample.ics                     데모 캘린더 (앱 내 "Load sample .ics"·푸터 다운로드와 동일 내용)
favicon.svg  .nojekyll
assets/
  styles.css                   디자인 시스템(라이트/다크, 반응형), 자체 호스팅 Inter 폰트(@font-face)
  ics-core.js                  파서·검증기·내보내기 (DOM 의존 없음 → Node 테스트에서 그대로 실행)
  app.js                       UI 배선(업로드·붙여넣기·드래그, 표/카드, 상세 다이얼로그, 내보내기)
  fonts/inter-latin*.woff2     Inter 가변 폰트 라틴 서브셋 (SIL OFL, CDN 아님)
assets/vendor/rrule.min.js     rrule 2.8.1 (BSD-3-Clause) — RRULE 전개
assets/vendor/ical.min.js      ical.js 1.5.0 (MPL-2.0) — 표준 파서·전개 교차검증
assets/vendor/LICENSE-*.txt    두 엔진의 라이선스 고지
test.js                        Node 단위 테스트 59개
uitest.py                      Playwright 실제 Chrome 검수 109항목 + 스크린샷
preview-desktop.png            데스크톱 1280×800 (첫 화면)
preview-desktop-results.png    데스크톱 결과 표 영역
preview-desktop-full.png       데스크톱 전체 페이지
preview-desktop-validation.png 검증 리포트 탭
preview-desktop-dialog.png     일정 상세 다이얼로그
preview-mobile.png             모바일 390×844 (이벤트 카드)
preview-mobile-results.png     모바일 결과 상단(소스 바·요약 카드)
preview-mobile-dialog.png      모바일 다이얼로그
preview-mobile-full.png        모바일 전체 페이지
preview-dark.png               다크 테마
```

## 기능

- **입력 3가지**: 파일 선택(다중)·드래그 앤 드롭·텍스트 붙여넣기, 원클릭 샘플.
  "Choose files"는 새로 열기, "Add files"/드롭은 현재 캘린더에 병합(소스 파일명 유지).
- **파싱(RFC 5545)**: 줄 폴딩(`\r\n `), `SUMMARY`·`DESCRIPTION` 이스케이프(`\n \, \; \\`),
  `DTSTART`/`DTEND`의 DATE·TZID·UTC(`Z`)·floating 4가지 형식, `DURATION`으로 종료시각 유추,
  `ORGANIZER`·`ATTENDEE`(CN/ROLE/PARTSTAT), `STATUS`, `RRULE`(FREQ/INTERVAL/BYDAY/BYMONTHDAY/COUNT/UNTIL),
  `CATEGORIES`·`URL`·`UID`·`VTIMEZONE` 식별, VALARM 같은 중첩 컴포넌트 분리.
- **뷰어**: 요약 카드(이벤트 수·기간·반복 수·타임존·검증 상태), 날짜·제목 정렬, 검색(제목·장소·설명·참석자·UID),
  필터(전체/시간 지정/종일/반복/취소), 표시 시간대 전환(이벤트 시간대/내 시간대/UTC), 행 클릭 상세 보기.
  데스크톱은 표, 모바일은 카드 목록.
- **반복 일정 전개(RRULE)**: `Repeats` 선택으로 3개월·12개월(기본)·2년 또는 원본 행만 볼 수 있습니다.
  반복 일정은 실제 날짜별 행으로 펼쳐지고 `OCCURRENCE 3/12` 배지가 붙습니다. 표 아래에는 어떤 엔진이 전개했고
  두 엔진이 일치했는지 함께 표시합니다(예: 3 repeating events expanded into 24 dated rows · rrule.js and ical.js agree on all 3 rules).
  - `rrule`(BSD-3-Clause)이 RRULE을 전개하고, `ical.js`(MPL-2.0)가 같은 규칙을 독립적으로 전개해 **교차검증**합니다.
  - 일광절약시간 경계는 벽시계 기준으로 전개한 뒤 TZID로 UTC를 다시 계산합니다(뉴욕 09:30 EST → 09:30 EDT).
  - `UNTIL`은 이벤트 시간대의 벽시계로 정규화해 비교하고, `EXDATE`는 해당 회차를 제거합니다.
  - 두 엔진이 없으면 내장 전개기(DAILY·WEEKLY·MONTHLY·YEARLY + INTERVAL·COUNT·UNTIL·BYDAY·BYMONTHDAY·BYMONTH)로 동작합니다.
- **검증기**: VCALENDAR·VERSION:2.0·PRODID·CALSCALE, 이벤트별 UID·DTSTAMP·DTSTART·DTEND 순서,
  잘못된 날짜(2월 30일 등)·미지원 TZID·중복 UID·닫히지 않은 컴포넌트·짝이 안 맞는 END·75옥텟 초과 줄을
  Error / Warning / Pass로 분류해 화면에 표시합니다.
- **내보내기**: CSV 15개 컬럼(Start/End/Start UTC/End UTC/Time Zone/All Day/Summary/Location/Description/
  Status/Organizer/Attendees/Recurrence/UID/Calendar) + 전개된 회차가 있으면 `Occurrence`(3 of 12) 한 칸이 더 붙습니다.
  RFC 4180 이스케이프, Excel용 UTF-8 BOM 옵션, JSON(ISO 8601 + 오프셋 + UTC + `occurrence`), 표 복사(TSV).
  화면에 보이는 필터·정렬 결과가 그대로 내보내집니다.
- **SEO**: JS 실행 전 HTML에 H1·설명·How-to·지원 필드 표·FAQ 6문항이 존재, `WebApplication` + `FAQPage` JSON-LD,
  canonical·OG·robots·sitemap, 시맨틱 마크업.

## 배포 (GitHub Pages)

**현재 라이브**: https://marcj81.github.io/ics-viewer-online/ (저장소 `MarCJ81/ics-viewer-online`, 공개)

1. 배포용 파일(`index.html`, `privacy.html`, `sample.ics`, `sitemap.xml`, `robots.txt`, `favicon.svg`,
   `.nojekyll`, `README.md`, `assets/`)만 저장소 **루트**에 올립니다. 테스트·스크린샷(`test.js`, `uitest.py`,
   `preview-*.png`)은 올리지 않습니다.
2. `main` 브랜치에는 소스, `gh-pages` 브랜치에는 같은 정적 파일을 푸시합니다. GitHub가 `gh-pages` 브랜치를
   감지해 Pages를 자동 빌드·서빙합니다(Pages API·Actions 워크플로 없이도 동작).
3. Pages 설정은 Settings → Pages → Source: *Deploy from a branch* → `gh-pages` / `/ (root)`입니다.
4. 독립 도메인(`icsviewer.app` 등)을 붙이면 아래 3곳의 URL을 실제 도메인으로 바꿉니다.
   - `index.html`, `privacy.html`의 `<link rel="canonical">`, OG `og:url`
   - `sitemap.xml`의 `<loc>` 2개
   - `robots.txt`의 `Sitemap:` 줄
5. `privacy.html`의 연락처는 `goodday810202@gmail.com`으로 설정되어 있습니다(애드센스 심사용 실제 수신 주소).
6. `assets/vendor/`의 두 엔진은 파일을 수정하지 않고 그대로 두며, MPL-2.0(ical.js) 고지를 `LICENSE-ical.txt`로 유지합니다.

## 테스트

```bash
node test.js        # 코어 단위 테스트 59개 (index.html이 쓰는 ics-core.js를 그대로 평가)
python3 uitest.py   # 실제 headless Chrome 검수 109항목 + 스크린샷 재생성 (Node 불필요)
```

`test.js`는 `assets/ics-core.js`를 읽어 실행하므로 브라우저에서 도는 코드와 완전히 같은 코드를 검증합니다.
주요 케이스: 줄 폴딩(CRLF/LF/CR), 이스케이프, EST↔EDT·영국 서머타임 경계 변환, 종일 일정의 배타적 DTEND,
floating 시간, `DURATION` 유추, 존재하지 않는 날짜(2026-02-30), 다중 이벤트·다중 파일, RRULE 4종 서술,
깨진 파일(VCALENDAR 없음·VERSION 1.0·UID 누락·DTSTART 누락·짝 안 맞는 END·미닫힘·75옥텟 초과),
CSV 따옴표/줄바꿈 이스케이프·BOM·컬럼 수·TSV 평탄화·JSON 오프셋, 샘플 무경고 통과.
반복 전개는 별도 그룹에서 검증합니다: COUNT=12 전개, UNTIL+INTERVAL=2 종료, MONTHLY BYMONTHDAY, 서머타임 경계,
3·6·12개월 지평, EXDATE 제거, rrule↔ical.js 교차검증 일치, 내장 전개기 단독 동작, 회차 CSV 컬럼·JSON 필드.

`uitest.py`는 1280×800과 390×844 뷰포트에서 샘플 로드·검색/정렬/필터·시간대 전환·검증 리포트·상세 다이얼로그·
실제 파일 선택 업로드·붙여넣기·드래그 앤 드롭·CSV(BOM 유/무)/JSON 다운로드·클립보드 복사·깨진 파일 오류 표시·
테마 전환·레이아웃 겹침·가로 오버플로·콘솔 에러 0건·외부 요청 0건을 확인하고 스크린샷을 저장합니다.
(`node`와 `python3 -m playwright`가 필요합니다. `uitest.py`의 `CHROME` 경로는 실행 환경에 맞게 조정하세요.)

## 알려진 한계

- 반복 전개 지평은 최대 2년·200회차입니다. 그 밖의 회차는 파일의 RRULE 설명으로 확인해야 합니다.
- 반복 예외(`RECURRENCE-ID`로 수정된 단일 회차)는 아직 별도 행으로 합치지 않고 EXDATE만 반영합니다.
- `VTODO`·`VJOURNAL`·`VFREEBUSY`는 읽지 않습니다(VEVENT만 대상).
- `TZID`는 브라우저의 IANA 시간대 데이터(`Intl`)로 변환합니다. 브라우저가 모르는 사설 TZID는 경고 후
  파일에 적힌 시각 그대로 표시합니다.
- 파일 크기 제한은 없지만, 수만 건 규모의 캘린더는 렌더링이 느려질 수 있습니다.

## 디자인 시스템 — A안 (Crisp Bento SaaS)

2026-11-22 해외 1~3호기 통일 리디자인 적용. 구조·기능은 그대로 두고 스킨만 A안 토큰으로 교체했습니다.

| 토큰 | 값 |
| --- | --- |
| 바탕 / 표면 | `#FAFAFA` / `#FFFFFF` |
| 헤어라인 | 1px `#E7E8EA` (강조 `#D7D9DD`) |
| 타일 라운드 | 16px (버튼 12px, 필 999px) |
| 잉크 | `#0C0D0F` (보조 `#3C4045`, 뮤트 `#6B7076`) |
| 액센트 | 코발트 `#2F5BFF` 단일 (hover `#2445C9`, soft `#EEF2FF`) |
| 헤드라인 | 산세리프 800, 자간 -0.04em |
| 상태색 | 성공 `#0B7A55` · 주의 `#A9550A` · 오류 `#B4211C` — 의미 전달에만 사용 |
| 다크 | 바탕 `#0A0B0D` · 표면 `#121317` · 라인 `#24262B` · 액센트 `#8AA4FF` |

- 대비 4.5:1 이상: 라이트·다크 × 데스크톱/모바일/개인정보 페이지 실측 미달 0건.
- 폰트는 자체 호스팅 Inter 그대로(외부 요청 0건).
