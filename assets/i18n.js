/* ==========================================================================
   ICS Viewer & Converter · KO / EN runtime
   English is the default in the markup; this file adds Korean.
   - Language choice: ?lang=ko|en → localStorage('onetap_lang') → navigator.language
   - Static text is translated by exact match on the text node, so the markup
     stays readable and no string is duplicated.
   - Dynamic strings call t('english') from app.js / ics-core.js.
   - Elements holding inline markup get a data-ko-html="…" attribute.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'onetap_lang';
  var DEFAULT_LANG = 'en';
  var OTHER_LANG = 'ko';

  var DICT = {
    /* ---- head / shell ---- */
    'ICS Viewer — a small, free tool for calendar files. Files are processed in your browser only.':
      'ICS 뷰어 — 달력 파일을 위한 작고 무료인 도구입니다. 파일은 브라우저 안에서만 처리됩니다.',
    'Skip to the converter': '변환기로 바로 가기',
    'ICS Viewer': 'ICS 뷰어',
    'calendar file tools': '달력 파일 도구',
    'Viewer': '뷰어',
    'How it works': '쓰는 방법',
    'Supported fields': '지원 항목',
    'FAQ': '자주 묻는 질문',
    'No upload': '업로드 없음',
    'iCalendar · RFC 5545': 'iCalendar · RFC 5545',
    'Main navigation': '주요 메뉴',
    'Footer': '바닥글',
    'ICS Viewer home': 'ICS 뷰어 홈',
    'Results': '결과',
    'Switch colour theme': '색상 테마 바꾸기',
    'Files are processed in this browser tab only': '파일은 이 브라우저 탭에서만 처리됩니다',
    'Adds a UTF-8 byte-order mark so Excel reads accents and non-Latin text correctly':
      'UTF-8 바이트 순서 표시(BOM)를 붙여 Excel에서 강세 문자와 한글이 바르게 보이게 합니다',
    'Choose .ics calendar files': '.ics 달력 파일 선택',
    'Close details': '상세 닫기',
    'Filter events': '일정 필터',
    'Sort events': '일정 정렬',
    'Search events': '일정 검색',
    'Time display': '시간 표시',
    'Repeating events': '반복 일정',
    'Search events, places, people…': '일정·장소·사람 검색…',

    /* ---- hero ---- */
    'Open, validate and convert': '.ics 달력 파일을 열고, 검사하고, 변환합니다',
    'Drop an iCalendar file to read every event in a clean table, check it against RFC 5545, and export it to CSV, Excel or JSON. Parsing runs inside this tab, so your calendar is never uploaded to a server.':
      'iCalendar 파일을 끌어다 놓으면 모든 일정을 깔끔한 표로 읽고, RFC 5545 규격과 대조하고, CSV·Excel·JSON으로 내보냅니다. 해석은 이 탭 안에서 끝나므로 달력이 서버로 올라가지 않습니다.',
    '100% in-browser': '100% 브라우저에서',
    'No sign-up, no install': '가입·설치 없음',
    'Works on phone and desktop': '폰·PC 모두',
    'Free, no file size limit': '무료 · 파일 크기 제한 없음',

    /* ---- dropzone ---- */
    'Drop your .ics files here': '.ics 파일을 여기에 놓으세요',
    'or': '또는',
    'browse': '직접 고르기',
    '— several files and multi-event calendars are supported': '— 파일 여러 개와 일정이 여러 개 든 달력도 됩니다',
    'Choose files': '파일 선택',
    'Paste .ics text': '.ics 텍스트 붙여넣기',
    'Load sample .ics': '예시 .ics 열기',
    'Paste the contents of an .ics file': '.ics 파일의 내용을 붙여넣으세요',
    'Read calendar': '달력 읽기',
    'Cancel': '취소',
    'No calendar loaded': '불러온 달력이 없습니다',
    'Choose a file, paste the text of an .ics file, or try the sample calendar to see how the table and the validation report look.':
      '파일을 고르거나 .ics 텍스트를 붙여넣거나, 예시 달력을 열어 표와 검사 결과가 어떻게 보이는지 확인해 보세요.',
    'Sample data': '예시 데이터',
    'Add files': '파일 추가',
    'Clear': '지우기',

    /* ---- stats ---- */
    'Events': '일정',
    'Date range': '기간',
    'Recurring': '반복',
    'events with an RRULE': 'RRULE이 있는 일정',
    'Time zones': '시간대',
    'Validation': '검사',
    'Validation report': '검사 보고서',

    /* ---- toolbar ---- */
    'All events': '전체 일정',
    'Timed only': '시간 있는 일정만',
    'All-day only': '종일 일정만',
    'Recurring only': '반복 일정만',
    'Cancelled': '취소됨',
    'Start: earliest first': '시작: 빠른 순',
    'Start: latest first': '시작: 늦은 순',
    'Summary: A–Z': '제목: 가나다순',
    'Summary: Z–A': '제목: 역순',
    'Longest first': '긴 일정 먼저',
    'Event time zone': '일정의 시간대',
    'My time zone': '내 시간대',
    'Repeats: expand 12 months': '반복: 12개월 펼치기',
    'Repeats: expand 3 months': '반복: 3개월 펼치기',
    'Repeats: expand 2 years': '반복: 2년 펼치기',
    'Repeats: original rows only': '반복: 원본 행만',
    'Export': '내보내기',
    'all events': '전체 일정',
    'Download CSV': 'CSV 내려받기',
    'Excel BOM': 'Excel BOM',
    'Copy table': '표 복사',
    'Date & time': '날짜·시간',
    'Event': '일정',
    'Duration': '소요 시간',
    'Calendar': '달력',
    'Details': '자세히',

    /* ---- table note ---- */
    'All-day events store their end date as': '종일 일정은 끝 날짜를',
    ', which iCalendar treats as exclusive: a one-day event on 6 March ends on 7 March. CSV and JSON exports keep the values exactly as the file records them. Select a row to see every parsed field.':
      '에 담는데, iCalendar는 이 값을 배타적으로 봅니다. 3월 6일 하루 일정은 3월 7일에 끝나는 것으로 기록됩니다. CSV·JSON 내보내기는 파일에 적힌 값을 그대로 유지합니다. 행을 선택하면 해석된 모든 항목을 볼 수 있습니다.',

    /* ---- features ---- */
    'A calendar reader that respects the file': '파일을 함부로 바꾸지 않는 달력 리더',
    'Most online converters send your calendar to a server and hand back a guess. This one reads the file the way a calendar app does, keeps every property, and tells you where the file breaks the standard.':
      '대부분의 온라인 변환기는 달력을 서버로 보내고 추측한 결과를 돌려줍니다. 이 도구는 달력 앱이 읽는 방식 그대로 파일을 읽고, 모든 항목을 보존하며, 규격에서 어긋난 곳을 짚어 줍니다.',
    'Nothing leaves the tab': '탭 밖으로 나가는 것이 없습니다',
    "The file is read with the browser's file API and parsed in memory. There is no upload endpoint, no account and no tracking of what you open.":
      '파일은 브라우저의 파일 API로 읽어 메모리에서 해석합니다. 업로드 주소도, 계정도, 무엇을 열었는지 기록하는 추적도 없습니다.',
    'RFC 5545 checks': 'RFC 5545 검사',
    'Missing UID, unclosed components, bad dates, unknown time zones and over-long lines are reported as errors or warnings, with the line they came from.':
      'UID 누락, 닫히지 않은 구성 요소, 잘못된 날짜, 알 수 없는 시간대, 지나치게 긴 줄을 오류·경고로 알려 주고 해당 줄 번호를 함께 표시합니다.',
    'CSV that Excel opens': 'Excel에서 바로 열리는 CSV',
    'One row per event, quoted and escaped correctly, with an optional UTF-8 BOM so accented names and non-Latin text arrive intact.':
      '일정마다 한 행, 따옴표와 이스케이프를 정확히 처리했고, UTF-8 BOM을 선택하면 강세 문자와 한글도 깨지지 않습니다.',
    'Recurring schedules': '반복 일정',
    'RRULE values are read and described in plain language — weekly on Monday, every other Thursday, monthly on the 5th — instead of being dropped.':
      'RRULE 값은 버리지 않고 읽어서 쉬운 말로 풀어 줍니다. 매주 월요일, 격주 목요일, 매월 5일처럼 보여 줍니다.',

    /* ---- how it works ---- */
    'How to open and convert an .ics file': '.ics 파일을 열고 변환하는 방법',
    'Three steps, no account. The sample calendar loads on its own so you can try the whole flow before you trust it with your own file.':
      '세 단계면 되고 가입은 필요 없습니다. 예시 달력이 먼저 열려 있으니, 내 파일을 맡기기 전에 전체 흐름을 미리 써 볼 수 있습니다.',
    'Load the file': '파일 불러오기',
    'Drop an .ics file onto the box above, pick it from your device, or paste the text you received by email. Several calendars can be loaded at once and are shown together.':
      '위 상자에 .ics 파일을 끌어다 놓거나, 기기에서 고르거나, 메일로 받은 텍스트를 붙여넣으세요. 달력 여러 개를 한꺼번에 불러와 함께 볼 수 있습니다.',
    'Read the table and the report': '표와 보고서 읽기',
    "Events are sorted by start time. Search by title, place or attendee, switch the time display between the event's own zone, your zone and UTC, and open a row to see every property that was parsed.":
      '일정은 시작 시간 순으로 정렬됩니다. 제목·장소·참석자로 검색하고, 표시 시간을 일정의 시간대·내 시간대·UTC 사이에서 바꾸고, 행을 열어 해석된 모든 항목을 확인하세요.',
    'Export what you need': '필요한 형식으로 내보내기',
    'Download CSV for Excel or Google Sheets, JSON for a script, or copy the table as tab-separated text straight into a spreadsheet. The export follows what is on screen: filters and sort order included.':
      'Excel·구글 스프레드시트용은 CSV, 스크립트용은 JSON으로 내려받거나, 표를 탭으로 구분된 텍스트로 복사해 스프레드시트에 바로 붙여넣으세요. 내보내기는 화면에 보이는 그대로 — 필터와 정렬 순서까지 — 반영됩니다.',

    /* ---- what is ics / properties ---- */
    'What is an .ics file?': '.ics 파일이란?',
    'Supported iCalendar properties': '지원하는 iCalendar 항목',
    'Every property below is parsed from the file as written. Unknown properties are preserved in the parsed event instead of being thrown away.':
      '아래 항목은 모두 파일에 적힌 그대로 해석합니다. 모르는 항목도 버리지 않고 해석된 일정 안에 보존합니다.',
    'iCalendar properties read by this viewer': '이 뷰어가 읽는 iCalendar 항목',
    'Property': '항목',
    'What it holds': '담는 내용',
    'How it appears': '표시되는 곳',
    'Event title': '일정 제목',
    'Event column, with escaped commas and semicolons restored': '일정 열 — 이스케이프된 쉼표와 세미콜론을 되살려 표시',
    'Start and end, as date, zoned time, UTC time or floating time': '시작·끝 — 날짜, 시간대 있는 시각, UTC, 떠 있는 시각',
    'Date & time column, converted to the display zone you choose': '날짜·시간 열 — 고른 표시 시간대로 변환',
    'Length, when the file has no end date': '끝 날짜가 없을 때의 길이',
    'Used to work out the end time and duration': '끝 시각과 소요 시간을 계산할 때 사용',
    'Room, address or link': '회의실·주소·링크',
    'Under the event title and in the details panel': '일정 제목 아래와 상세 패널',
    'Notes, agenda, dial-in details': '메모·안건·접속 번호',
    'Details panel, with line breaks kept': '상세 패널 — 줄바꿈 유지',
    'Names, email addresses, roles and replies': '이름·메일 주소·역할·참석 응답',
    'Details panel, searchable': '상세 패널 — 검색 가능',
    'Confirmed, tentative or cancelled': '확정·미정·취소',
    'Badge on the row; cancelled events are struck through': '행의 배지 — 취소된 일정은 취소선',
    'Recurrence rule with interval, weekdays, count or until date': '간격·요일·횟수·종료일이 담긴 반복 규칙',
    'Recurring badge and a plain-language description': '반복 배지와 쉬운 말 설명',
    'Tags, link and identity of the event': '태그·링크·일정 식별자',
    'Details panel and export columns': '상세 패널과 내보내기 열',
    'Calendar-level declarations': '달력 수준 선언',
    'Checked by the validator': '검사기가 확인',

    /* ---- faq ---- */
    'Questions people ask before using it': '쓰기 전에 많이 묻는 것',
    'Is my calendar file uploaded to a server?': '달력 파일이 서버로 올라가나요?',
    "No. The file is read with the browser's own file API and parsed in memory on this page. Nothing is sent to a server, stored or logged, and the tool keeps working if you go offline after the page has loaded.":
      '아니요. 파일은 브라우저 자체 파일 API로 읽어 이 페이지의 메모리에서 해석합니다. 서버로 보내거나 저장하거나 기록하지 않으며, 페이지를 연 뒤 오프라인이 되어도 계속 동작합니다.',
    'How do I open an .ics file?': '.ics 파일은 어떻게 여나요?',
    "Drop the file onto the box above, choose it from your device, or paste the file's text. Every event appears in a table with its start and end time, location, description, organiser and recurrence rule.":
      '위 상자에 파일을 끌어다 놓거나 기기에서 고르거나 파일 텍스트를 붙여넣으세요. 모든 일정이 시작·끝 시각, 장소, 설명, 주최자, 반복 규칙과 함께 표에 나타납니다.',
    'How do I convert an .ics file to CSV or Excel?': '.ics 파일을 CSV나 Excel로 어떻게 바꾸나요?',
    'Load the file, then press Download CSV. The file is written with UTF-8 and an optional byte-order mark, so Excel opens accented characters and non-Latin text correctly. Each event becomes one row with start, end, UTC times, time zone, summary, location and description.':
      '파일을 불러온 뒤 CSV 내려받기를 누르세요. UTF-8과 선택적인 바이트 순서 표시(BOM)로 저장하므로 Excel에서 강세 문자와 한글이 제대로 열립니다. 일정마다 한 행에 시작·끝, UTC 시각, 시간대, 제목, 장소, 설명이 들어갑니다.',
    'Which iCalendar properties are supported?': '어떤 iCalendar 항목을 지원하나요?',
    "VEVENT properties including SUMMARY, DTSTART, DTEND, DURATION, LOCATION, DESCRIPTION, ORGANIZER, ATTENDEE, STATUS, RRULE, CATEGORIES, URL and UID are read, together with the calendar's VERSION, PRODID and CALSCALE. Date values with a time zone, UTC values, all-day dates, folded lines and escaped characters are handled.":
      'SUMMARY, DTSTART, DTEND, DURATION, LOCATION, DESCRIPTION, ORGANIZER, ATTENDEE, STATUS, RRULE, CATEGORIES, URL, UID 같은 VEVENT 항목과 달력의 VERSION, PRODID, CALSCALE을 읽습니다. 시간대가 붙은 날짜, UTC 값, 종일 날짜, 접힌 줄, 이스케이프 문자도 처리합니다.',
    'Why does a validator show warnings for a file that works?': '잘 열리는 파일인데 왜 경고가 나오나요?',
    'Calendar apps are forgiving, so a file can open everywhere and still break the specification. Missing UID or DTSTAMP values, lines longer than 75 octets and unknown time zone IDs are common warnings that can cause duplicates or wrong times after an import.':
      '달력 앱은 관대해서 규격을 어겨도 열리는 경우가 많습니다. UID나 DTSTAMP 누락, 75옥텟을 넘는 줄, 알 수 없는 시간대 ID는 흔한 경고이며, 다른 곳으로 가져올 때 중복이나 시간 어긋남을 일으킬 수 있습니다.',
    'Does this work on a phone?': '폰에서도 되나요?',
    'Yes. The layout switches to a card list on narrow screens, and the export buttons work the same way in mobile Safari and Chrome.':
      '됩니다. 좁은 화면에서는 카드 목록으로 바뀌고, 내보내기 버튼도 모바일 Safari와 Chrome에서 똑같이 동작합니다.',

    /* ---- footer ---- */
    'Privacy policy': '개인정보처리방침',
    'Sitemap': '사이트맵',
    'Sample .ics': '예시 .ics',
    'This viewer reads calendar files in your browser, so it needs JavaScript. Nothing is uploaded either way.':
      '이 뷰어는 브라우저에서 달력 파일을 읽으므로 JavaScript가 필요합니다. 어느 경우에도 업로드하지 않습니다.',

    /* ---- app.js dynamic ---- */
    ' event': '개 일정',
    ' events': '개 일정',
    'No events found — open the validation report for details': '일정을 찾지 못했습니다 — 자세한 내용은 검사 보고서를 열어 보세요',
    'the sample calendar': '예시 달력',
    'your file': '내 파일',
    'pasted text': '붙여넣은 텍스트',
    ' calendars merged': '개 달력 합침',
    ' file': '개 파일',
    ' files': '개 파일',
    'read in this tab': '이 탭에서 읽음',
    'demo data': '예시 데이터',
    'Cleared': '지웠습니다',
    ' occurrences · ': '회 · ',
    ' repeating': '개 반복',
    ' all-day · ': '개 종일 · ',
    ' timed': '개 시간 지정',
    'All-day range': '종일 기간',
    'first start → last end': '첫 시작 → 마지막 끝',
    'event with an RRULE': 'RRULE이 있는 일정',
    'None': '없음',
    'Floating or all-day only': '떠 있는 시각 또는 종일뿐',
    'Passed': '통과',
    ' warning': '개 경고',
    ' error': '개 오류',
    ' checks run': '개 항목 검사',
    'No problems found': '문제를 찾지 못했습니다',
    'The file is readable, with something to check': '읽을 수 있지만 확인할 것이 있습니다',
    'This file has errors': '이 파일에는 오류가 있습니다',
    'Every required property is present and every date, time zone and recurrence rule could be read.':
      '필수 항목이 모두 있고, 날짜·시간대·반복 규칙을 모두 읽었습니다.',
    'Events were read successfully. The warnings below may still cause duplicates or shifted times when the file is imported somewhere else.':
      '일정은 정상적으로 읽었습니다. 다만 아래 경고는 다른 곳으로 가져올 때 중복이나 시간 어긋남을 일으킬 수 있습니다.',
    'Events that could be read are shown below, but the errors listed here will break the file in a calendar app.':
      '읽을 수 있었던 일정은 아래에 표시했지만, 여기 나온 오류는 달력 앱에서 파일을 깨뜨립니다.',
    ' passed': '개 통과',
    'Errors': '오류',
    'Warnings': '경고',
    'Passed checks': '통과한 검사',
    'passed': '통과',
    'No date': '날짜 없음',
    'DTSTART missing': 'DTSTART 누락',
    'All-day · ends ': '종일 · 끝 ',
    ' (exclusive)': ' (배타적)',
    'All day': '종일',
    'Tentative': '미정',
    'Occurrence ': '발생 ',
    'All-day': '종일',
    'this event': '이 일정',
    'all ': '전체 ',
    ' rows': '개 행',
    ' of ': ' / ',
    'No event matches this search or filter.': '이 검색어나 필터에 맞는 일정이 없습니다.',
    'No events in this file.': '이 파일에 일정이 없습니다.',
    ' repeating event': '개 반복 일정',
    ' repeating events': '개 반복 일정',
    ' expanded into ': '개를 펼쳐 ',
    ' dated rows': '개 날짜 행으로 표시',
    ' rule(s) disagree between engines': '개 규칙의 해석이 엔진마다 다릅니다',
    'rrule.js and ical.js agree on all ': 'rrule.js와 ical.js가 모든 ',
    ' rule(s)': '개 규칙에서 일치',
    'could not expand: ': '펼치지 못함: ',
    ', open details': ' — 상세 열기',
    'When': '일시',
    'Starts': '시작',
    ' (all-day)': ' (종일)',
    'Ends': '끝',
    'Status': '상태',
    'Location': '장소',
    'Categories': '분류',
    'Occurrence': '발생',
    ' in the expanded window': ' — 펼친 범위 기준',
    'Repeats': '반복',
    'Organizer': '주최자',
    ' · line ': ' · ',
    'Description': '설명',
    'Unknown': '알 수 없음',
    'Issues with this event': '이 일정의 문제',
    'Nothing to export': '내보낼 것이 없습니다',
    'CSV ready — ': 'CSV 준비됨 — ',
    ' with Excel BOM': ' (Excel BOM 포함)',
    'JSON ready — ': 'JSON 준비됨 — ',
    'Nothing to copy': '복사할 것이 없습니다',
    ' rows copied as tab-separated text': '개 행을 탭 구분 텍스트로 복사했습니다',
    'Copy failed — select the table and copy manually': '복사하지 못했습니다 — 표를 선택해 직접 복사해 주세요',
    'Switch to light theme': '밝은 테마로 바꾸기',
    'Switch to dark theme': '어두운 테마로 바꾸기',
    'Paste the text of an .ics file first': '.ics 파일 텍스트를 먼저 붙여넣으세요',
    ' occurrences shown for the next ': '개 발생을 앞으로 ',
    ' months': '개월 범위로 표시',
    'Showing one row per event — repeats are listed in the detail view': '일정마다 한 행으로 표시합니다 — 반복은 상세 화면에 나옵니다',

    /* ---- core: validation titles ---- */
    'File structure': '파일 구조',
    'VCALENDAR wrapper': 'VCALENDAR 껍데기',
    'Unique UID': 'UID 중복',
    'DTSTAMP format': 'DTSTAMP 형식',
    'Event fields': '일정 항목',
    'Recurrence rules': '반복 규칙',
    'Strict parsing': '엄격 해석',
    'Version 2.0 is declared.': 'VERSION:2.0이 선언되어 있습니다.',
    'Every event has a UID.': '모든 일정에 UID가 있습니다.',
    'Every event carries a DTSTAMP.': '모든 일정에 DTSTAMP가 있습니다.',
    'Floating (local to reader)': '떠 있는 시각 (읽는 사람의 현지 시각)',
    'less than a minute': '1분 미만'
  };

  var META = {
    ko: {
      title: 'ICS 뷰어 & 변환기 — .ics 파일 열기·검사·CSV 변환',
      description: '.ics 달력 파일을 브라우저에서 열어 모든 일정을 표로 읽고, RFC 5545 규격을 검사하고, CSV·Excel·JSON으로 변환합니다. 파일은 어디로도 업로드되지 않습니다.',
      ogTitle: 'ICS 뷰어 & 변환기 — .ics 파일 열기·검사·변환',
      ogDescription: '.ics 달력을 깔끔한 표로 읽고 RFC 5545 검사 후 CSV·JSON으로 내보내세요. 모든 처리는 브라우저 안에서 끝납니다.'
    }
  };

  /* Keys are matched on whitespace-collapsed text, so store them that way. */
  var DICT_NORM = {};
  Object.keys(DICT).forEach(function (k) {
    var nk = String(k).replace(/\s+/g, ' ').trim();
    if (DICT_NORM[nk] == null) DICT_NORM[nk] = DICT[k];
  });

  var current = DEFAULT_LANG;
  var textOrig = new Map();
  var attrOrig = new WeakMap();
  var htmlOrig = new Map();
  var metaOrig = null;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function isOther() { return current === OTHER_LANG; }

  function detect() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'ko' || q === 'en') return q;
    } catch (e) { /* older engines */ }
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) { /* private mode */ }
    var nav = navigator.language || navigator.userLanguage || '';
    return /^ko/i.test(nav) ? 'ko' : 'en';
  }

  function t(en) {
    if (isOther() && en != null) {
      var key = norm(en);
      if (DICT_NORM[key] != null) return DICT_NORM[key];
    }
    return en;
  }

  function L(en, ko) { return isOther() ? ko : en; }

  function textNodes(root) {
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  function translateTextNode(node) {
    var orig = textOrig.get(node);
    if (orig == null) {
      if (!isOther()) return;
      orig = node.nodeValue;
      textOrig.set(node, orig);
    }
    var key = norm(orig);
    var tr = (isOther() && key) ? DICT_NORM[key] : null;
    if (tr == null && isOther() && /^[·\u00b7]\s/.test(key)) {
      var tail = key.replace(/^[·\u00b7]\s/, '');
      if (DICT_NORM[tail] != null) tr = key.slice(0, key.length - tail.length) + DICT_NORM[tail];
    }
    if (tr != null) {
      var lead = (orig.match(/^\s*/) || [''])[0];
      var trail = (orig.match(/\s*$/) || [''])[0];
      node.nodeValue = lead + tr + trail;
    } else {
      node.nodeValue = orig;
    }
  }

  function translateAttrs(el) {
    var rec = attrOrig.get(el);
    ATTRS.forEach(function (attr) {
      var val = el.getAttribute(attr);
      if (val == null) return;
      if (!rec) { rec = {}; attrOrig.set(el, rec); }
      if (!(attr in rec)) {
        if (!isOther()) return;
        rec[attr] = val;
      }
      var orig = rec[attr];
      var tr = isOther() ? DICT_NORM[norm(orig)] : null;
      el.setAttribute(attr, tr != null ? tr : orig);
    });
  }

  /* Translate one subtree. Used for the first paint and for markup that the
     app writes later (documents, table rows, dialogs). */
  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.hasAttribute && root.hasAttribute('data-ko-html')) {
      if (!htmlOrig.has(root)) htmlOrig.set(root, root.innerHTML);
      root.innerHTML = isOther() ? root.getAttribute('data-ko-html') : htmlOrig.get(root);
      return;
    }
    textNodes(root).forEach(translateTextNode);
    if (root.nodeType === 1) translateAttrs(root);
    Array.prototype.slice.call(root.querySelectorAll('body *')).forEach(translateAttrs);
  }

  var observer = null;
  var muting = false;
  function watch() {
    if (observer || !window.MutationObserver || !isOther()) return;
    observer = new MutationObserver(function (records) {
      if (muting) return;
      muting = true;
      try {
        records.forEach(function (rec) {
          Array.prototype.slice.call(rec.addedNodes || []).forEach(function (n) {
            if (n.nodeType === 1 || n.nodeType === 3) translateTree(n);
          });
        });
      } finally { muting = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyDom() {
    textNodes(document.body).forEach(translateTextNode);
    Array.prototype.slice.call(document.querySelectorAll('[data-ko-html]')).forEach(translateTree);
    Array.prototype.slice.call(document.querySelectorAll('body *')).forEach(translateAttrs);
    if (isOther()) watch();
  }

  function setMeta(attr, name, value) {
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }

  function applyMeta() {
    if (!metaOrig) {
      metaOrig = {
        title: document.title,
        description: (document.querySelector('meta[name="description"]') || {}).content || '',
        ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || '',
        ogDescription: (document.querySelector('meta[property="og:description"]') || {}).content || ''
      };
    }
    var pack = isOther() ? META[OTHER_LANG] : null;
    document.title = pack ? pack.title : metaOrig.title;
    setMeta('name', 'description', pack ? pack.description : metaOrig.description);
    setMeta('property', 'og:title', pack ? pack.ogTitle : metaOrig.ogTitle);
    setMeta('property', 'og:description', pack ? pack.ogDescription : metaOrig.ogDescription);
  }

  function paintButtons() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lang]')).forEach(function (b) {
      var on = b.getAttribute('data-lang') === current;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function apply(lang) {
    current = (lang === 'ko' || lang === 'en') ? lang : DEFAULT_LANG;
    document.documentElement.lang = current;
    applyMeta();
    applyDom();
    paintButtons();
  }

  function set(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
    apply(lang);
    bind();
    fireLang();
  }

  function bind() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lang]')).forEach(function (b) {
      if (b.getAttribute('data-bound') === '1') return;
      b.setAttribute('data-bound', '1');
      b.addEventListener('click', function () { set(b.getAttribute('data-lang')); });
    });
  }

  /* Apps that build text in JS render before this file boots; tell them once
     so their first paint matches the chosen language. */
  function fireLang() {
    try {
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
    } catch (e) { /* older engines */ }
  }

  function boot() {
    apply(detect());
    bind();
    fireLang();
  }

  window.OneTapLang = {
    detect: detect,
    current: function () { return current; },
    set: set,
    apply: apply,
    bind: bind,
    t: t,
    L: L,
    translate: translateTree,
    isKo: function () { return isOther(); }
  };
  window.t = t;
  window.L = L;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
