/*!
 * ics-core.js — RFC 5545 (.ics / iCalendar) parser, validator and exporters.
 * No dependencies. Works in a browser (window.ICSCore) and in Node (vm / require).
 * Everything runs locally; this file never performs a network request.
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var DAY_MS = 86400000;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  var WEEKDAY_NAMES = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function utf8Length(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function localTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }

  function isKnownTimeZone(tz) {
    if (!tz) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
    catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ */
  /* Text and content-line parsing                                       */
  /* ------------------------------------------------------------------ */

  /** RFC 5545 text unescaping: \\n, \\N, \\, \\; \\\\ */
  function unescapeText(value) {
    if (value == null) return '';
    var out = '';
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (ch !== '\\') { out += ch; continue; }
      var next = value.charAt(i + 1);
      if (next === 'n' || next === 'N') { out += '\n'; i++; }
      else if (next === ',') { out += ','; i++; }
      else if (next === ';') { out += ';'; i++; }
      else if (next === '\\') { out += '\\'; i++; }
      else { out += ch; }
    }
    return out;
  }

  /** Fold a content line at 75 octets (RFC 5545 §3.1), never splitting a character. */
  function foldICSLine(line, limit) {
    limit = limit || 75;
    if (utf8Length(line) <= limit) return [line];
    var chars = Array.from(String(line));
    var out = [];
    var cur = '';
    var bytes = 0;
    for (var i = 0; i < chars.length; i++) {
      var w = utf8Length(chars[i]);
      if (bytes + w > limit) {
        out.push(cur);
        cur = ' ';
        bytes = 1;
      }
      cur += chars[i];
      bytes += w;
    }
    out.push(cur);
    return out;
  }

  /** Unfold folded lines (RFC 5545 §3.1) and keep track of physical line numbers. */
  function unfold(text) {
    var src = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var physical = src.split(/\r\n|\r|\n/);
    var out = [];
    var overlong = [];
    for (var i = 0; i < physical.length; i++) {
      var line = physical[i];
      var bytes = utf8Length(line);
      if (bytes > 75) {
        if (overlong.length < 20) overlong.push({ line: i + 1, bytes: bytes });
      }
      if ((line.charAt(0) === ' ' || line.charAt(0) === '\t') && out.length) {
        out[out.length - 1].text += line.slice(1);
        continue;
      }
      out.push({ text: line, line: i + 1 });
    }
    return { lines: out, overlong: overlong };
  }

  /** Parse "NAME;PARAM=VAL;PARAM=\"quoted:value\":raw value" into parts. */
  function parseContentLine(text) {
    var inQuote = false;
    var colon = -1;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === '"') inQuote = !inQuote;
      else if (c === ':' && !inQuote) { colon = i; break; }
    }
    if (colon === -1) return null;

    var head = text.slice(0, colon);
    var value = text.slice(colon + 1);
    var chunks = [];
    var cur = '';
    var q = false;
    for (var j = 0; j < head.length; j++) {
      var ch = head.charAt(j);
      if (ch === '"') { q = !q; cur += ch; }
      else if (ch === ';' && !q) { chunks.push(cur); cur = ''; }
      else cur += ch;
    }
    chunks.push(cur);

    var name = chunks[0].trim().toUpperCase();
    if (!name) return null;

    var params = {};
    for (var k = 1; k < chunks.length; k++) {
      var piece = chunks[k];
      var eq = piece.indexOf('=');
      if (eq === -1) continue;
      var pName = piece.slice(0, eq).trim().toUpperCase();
      var pValue = piece.slice(eq + 1).trim();
      if (pValue.length >= 2 && pValue.charAt(0) === '"' && pValue.charAt(pValue.length - 1) === '"') {
        pValue = pValue.slice(1, -1).replace(/\\"/g, '"');
      }
      if (!params[pName]) params[pName] = [];
      params[pName].push(pValue);
    }
    return { name: name, params: params, value: value };
  }

  /* ------------------------------------------------------------------ */
  /* Date-time parsing and time-zone math                                */
  /* ------------------------------------------------------------------ */

  var tzPartsFmtCache = {};

  function tzPartsFormatter(tz) {
    if (!tzPartsFmtCache[tz]) {
      tzPartsFmtCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    return tzPartsFmtCache[tz];
  }

  /** Wall-clock components of an instant in the given IANA time zone. */
  function wallParts(ms, tz) {
    var parts = tzPartsFormatter(tz).formatToParts(new Date(ms));
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    var hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;
    return {
      y: parseInt(map.year, 10), mo: parseInt(map.month, 10), d: parseInt(map.day, 10),
      h: hour, mi: parseInt(map.minute, 10), s: parseInt(map.second, 10)
    };
  }

  /** Offset of a time zone at an instant, in minutes (east of UTC is positive). */
  function tzOffsetMinutes(ms, tz) {
    var p = wallParts(ms, tz);
    var asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }

  /** Convert a wall-clock time in a given zone into a UTC instant. */
  function zonedToUtc(y, mo, d, h, mi, s, tz) {
    var naive = Date.UTC(y, mo - 1, d, h, mi, s);
    var off1 = tzOffsetMinutes(naive, tz) * 60000;
    var guess = naive - off1;
    var off2 = tzOffsetMinutes(guess, tz) * 60000;
    if (off2 !== off1) {
      var alt = naive - off2;
      // Pick the interpretation whose offset is valid at the resulting instant.
      if (tzOffsetMinutes(alt, tz) * 60000 === off2) return alt;
      return guess;
    }
    return guess;
  }

  function offsetToString(minutes) {
    var sign = minutes < 0 ? '-' : '+';
    var abs = Math.abs(minutes);
    return sign + pad2(Math.floor(abs / 60)) + ':' + pad2(abs % 60);
  }

  /** Parse a DATE or DATE-TIME value; returns null when malformed. */
  function parseDateValue(raw) {
    var v = String(raw).trim();
    var dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (dateOnly) {
      return {
        kind: 'date', hasTime: false, isUtc: false,
        y: +dateOnly[1], mo: +dateOnly[2], d: +dateOnly[3], h: 0, mi: 0, s: 0
      };
    }
    var dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
    if (dateTime) {
      return {
        kind: 'datetime', hasTime: true, isUtc: dateTime[7] === 'Z',
        y: +dateTime[1], mo: +dateTime[2], d: +dateTime[3],
        h: +dateTime[4], mi: +dateTime[5], s: +dateTime[6]
      };
    }
    return null;
  }

  function isRealDate(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  /**
   * Turn a parsed date value plus parameters into a resolved time object.
   * Returns { time, problems } where problems are validation findings.
   */
  function resolveTime(parsedValue, params, label) {
    var problems = [];
    var tzid = params && params.TZID && params.TZID.length ? params.TZID[0] : null;
    if (!parsedValue) return { time: null, problems: problems };

    if (!isRealDate(parsedValue.y, parsedValue.mo, parsedValue.d)) {
      problems.push({
        severity: 'error', code: 'invalid-date',
        message: label + ' is not a real calendar date (' + parsedValue.y + '-' + parsedValue.mo + '-' + parsedValue.d + ').'
      });
    }
    if (parsedValue.hasTime && (parsedValue.h > 23 || parsedValue.mi > 59 || parsedValue.s > 60)) {
      problems.push({
        severity: 'error', code: 'invalid-time',
        message: label + ' has an impossible time of day.'
      });
    }

    var time = {
      kind: parsedValue.kind,
      hasTime: parsedValue.hasTime,
      isUtc: parsedValue.isUtc,
      isFloating: parsedValue.hasTime && !parsedValue.isUtc && !tzid,
      tzid: parsedValue.hasTime && tzid && !parsedValue.isUtc ? tzid : null,
      y: parsedValue.y, mo: parsedValue.mo, d: parsedValue.d,
      h: parsedValue.h, mi: parsedValue.mi, s: parsedValue.s
    };

    if (params && params.VALUE && params.VALUE[0] && params.VALUE[0].toUpperCase() === 'DATE' && parsedValue.hasTime) {
      problems.push({
        severity: 'error', code: 'value-date-with-time',
        message: label + ' declares VALUE=DATE but carries a time of day.'
      });
    }

    time.wallMs = Date.UTC(time.y, time.mo - 1, time.d, time.h, time.mi, time.s);

    if (time.kind === 'date') {
      time.utcMs = time.wallMs;
      time.offset = 0;
    } else if (time.isUtc) {
      time.utcMs = time.wallMs;
      time.offset = 0;
    } else if (time.tzid) {
      if (isKnownTimeZone(time.tzid)) {
        time.utcMs = zonedToUtc(time.y, time.mo, time.d, time.h, time.mi, time.s, time.tzid);
        time.offset = Math.round((time.wallMs - time.utcMs) / 60000);
      } else {
        time.utcMs = time.wallMs;
        time.offset = 0;
        time.unknownZone = true;
        problems.push({
          severity: 'warning', code: 'unknown-tzid',
          message: label + ' uses TZID=' + time.tzid + ', which is not a recognised time zone. Its clock time was kept as written.'
        });
      }
    } else {
      // Floating local time: keep the wall clock as written.
      time.utcMs = time.wallMs;
      time.offset = 0;
    }

    return { time: time, problems: problems };
  }

  function parseDuration(raw) {
    var v = String(raw || '').trim().toUpperCase();
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v);
    if (!m) return null;
    var sign = m[1] === '-' ? -1 : 1;
    var ms = 0;
    if (m[2]) ms += parseInt(m[2], 10) * 7 * DAY_MS;
    if (m[3]) ms += parseInt(m[3], 10) * DAY_MS;
    if (m[4]) ms += parseInt(m[4], 10) * 3600000;
    if (m[5]) ms += parseInt(m[5], 10) * 60000;
    if (m[6]) ms += parseInt(m[6], 10) * 1000;
    if (!ms && v !== 'P0D' && v !== 'PT0S') return null;
    return sign * ms;
  }

  /* ------------------------------------------------------------------ */
  /* Formatting                                                          */
  /* ------------------------------------------------------------------ */

  var displayFmtCache = {};

  function displayFormatter(tz) {
    var key = tz || '__none__';
    if (!displayFmtCache[key]) {
      displayFmtCache[key] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz || undefined,
        hour12: true, hour: 'numeric', minute: '2-digit',
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        timeZoneName: 'short'
      });
    }
    return displayFmtCache[key];
  }

  function wallLabel(y, mo, d, h, mi) {
    var date = MONTHS[(mo - 1) % 12] + ' ' + d + ', ' + y;
    var hour12 = h % 12 === 0 ? 12 : h % 12;
    var time = hour12 + ':' + pad2(mi) + ' ' + (h < 12 ? 'AM' : 'PM');
    return { date: date, time: time };
  }

  /**
   * Format a resolved time for display.
   * mode: 'event' (as written), 'local' (viewer's zone), 'utc'.
   */
  function formatTime(time, mode) {
    if (!time) return null;
    mode = mode || 'event';

    if (time.kind === 'date') {
      var wd = WEEKDAYS[new Date(Date.UTC(time.y, time.mo - 1, time.d)).getUTCDay()];
      return {
        isDate: true,
        date: MONTHS[time.mo - 1] + ' ' + time.d + ', ' + time.y,
        weekday: wd,
        time: 'All day',
        zone: '',
        iso: time.y + '-' + pad2(time.mo) + '-' + pad2(time.d)
      };
    }

    var useZone = null;
    if (mode === 'utc') useZone = 'UTC';
    else if (mode === 'local') useZone = localTimeZone();
    else if (time.tzid && isKnownTimeZone(time.tzid)) useZone = time.tzid;
    else if (time.isUtc) useZone = 'UTC';

    if (useZone) {
      var parts = displayFormatter(useZone).formatToParts(new Date(time.utcMs));
      var map = {};
      for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
      var zoneName = map.timeZoneName || '';
      // A flat "GMT+9" is less useful than the IANA name; show both when short.
      return {
        isDate: false,
        date: map.month + ' ' + map.day + ', ' + map.year,
        weekday: map.weekday + '',
        time: map.hour + ':' + map.minute + ' ' + map.dayPeriod,
        zone: zoneName,
        iso: formatISO(time)
      };
    }

    var label = wallLabel(time.y, time.mo, time.d, time.h, time.mi);
    return {
      isDate: false,
      date: label.date,
      weekday: WEEKDAYS[new Date(Date.UTC(time.y, time.mo - 1, time.d)).getUTCDay()],
      time: label.time,
      zone: '',
      iso: formatISO(time)
    };
  }

  function formatISO(time) {
    if (!time) return '';
    if (time.kind === 'date') return time.y + '-' + pad2(time.mo) + '-' + pad2(time.d);
    var base = time.y + '-' + pad2(time.mo) + '-' + pad2(time.d) + 'T' + pad2(time.h) + ':' + pad2(time.mi) + ':' + pad2(time.s);
    if (time.isUtc) return base + 'Z';
    if (time.tzid && isKnownTimeZone(time.tzid)) return base + offsetToString(time.offset);
    return base;
  }

  function formatCSVTime(time, opts) {
    if (!time) return '';
    if (time.kind === 'date') return time.y + '-' + pad2(time.mo) + '-' + pad2(time.d);
    return time.y + '-' + pad2(time.mo) + '-' + pad2(time.d) + ' ' + pad2(time.h) + ':' + pad2(time.mi);
  }

  function formatUTCClock(time) {
    if (!time || !time.hasTime) return '';
    var p = wallParts(time.utcMs, 'UTC');
    return p.y + '-' + pad2(p.mo) + '-' + pad2(p.d) + ' ' + pad2(p.h) + ':' + pad2(p.mi);
  }

  function zoneLabel(time) {
    if (!time) return '';
    if (time.kind === 'date') return '';
    if (time.isUtc) return 'UTC';
    if (time.tzid) return time.tzid;
    return 'Floating (local to reader)';
  }

  function formatRange(start, end) {
    if (!start) return '';
    if (!end) return formatTime(start).date;
    var a = formatTime(start);
    var b = formatTime(end);
    if (a.isDate && b.isDate) {
      if (start.y === end.y && start.mo === end.mo && start.d === end.d) return a.date;
      return a.date + ' – ' + b.date;
    }
    if (a.date === b.date) return a.date + ', ' + a.time + ' – ' + b.time;
    return a.date + ', ' + a.time + ' – ' + b.date + ', ' + b.time;
  }

  function formatDuration(ms) {
    if (ms == null) return '';
    var totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 1) return 'less than a minute';
    var days = Math.floor(totalMinutes / 1440);
    var hours = Math.floor((totalMinutes % 1440) / 60);
    var minutes = totalMinutes % 60;
    var parts = [];
    if (days) parts.push(days + (days === 1 ? ' day' : ' days'));
    if (hours) parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
    if (minutes) parts.push(minutes + (minutes === 1 ? ' minute' : ' minutes'));
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* RRULE                                                               */
  /* ------------------------------------------------------------------ */

  function parseRRule(raw) {
    if (!raw) return null;
    var map = {};
    String(raw).split(';').forEach(function (chunk) {
      var eq = chunk.indexOf('=');
      if (eq === -1) return;
      map[chunk.slice(0, eq).trim().toUpperCase()] = chunk.slice(eq + 1).trim();
    });
    if (!map.FREQ) return null;
    return map;
  }

  function untilLabel(value) {
    var parsed = parseDateValue(value);
    if (!parsed) return value;
    var t = resolveTime(parsed, {}, 'UNTIL').time;
    var f = formatTime(t);
    return f.date;
  }

  function describeRRule(raw) {
    var rule = parseRRule(raw);
    if (!rule) return '';
    var interval = parseInt(rule.INTERVAL || '1', 10) || 1;
    var freqWords = {
      SECONDLY: 'second', MINUTELY: 'minute', HOURLY: 'hour',
      DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year'
    };
    var unit = freqWords[rule.FREQ];
    if (!unit) return raw;
    var text = interval === 1 ? 'Every ' + unit : 'Every ' + interval + ' ' + unit + 's';

    if (rule.BYDAY) {
      var days = rule.BYDAY.split(',').map(function (d) {
        var code = d.trim().toUpperCase().replace(/^[+-]?\d+/, '');
        return WEEKDAY_NAMES[code] || code;
      });
      if (rule.FREQ === 'WEEKLY') {
        text = (interval === 1 ? 'Every week' : 'Every ' + interval + ' weeks') + ' on ' + days.join(', ');
      } else if (rule.FREQ === 'MONTHLY') {
        text += ' on ' + days.join(', ');
      } else {
        text += ' on ' + days.join(', ');
      }
    }
    if (rule.BYMONTHDAY) {
      var daysOfMonth = rule.BYMONTHDAY.split(',').map(function (d) { return 'the ' + ordinal(parseInt(d, 10)); });
      text += ' on ' + daysOfMonth.join(', ');
    }
    if (rule.BYMONTH) {
      var months = rule.BYMONTH.split(',').map(function (m) {
        var n = parseInt(m, 10);
        return MONTHS_LONG[(n - 1 + 12) % 12];
      });
      text += ' in ' + months.join(', ');
    }
    if (rule.COUNT) {
      var count = parseInt(rule.COUNT, 10);
      text += ' · ' + count + ' occurrences';
    }
    if (rule.UNTIL) text += ' · until ' + untilLabel(rule.UNTIL);
    return text;
  }

  function ordinal(n) {
    if (!isFinite(n)) return String(n);
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ------------------------------------------------------------------ */
  /* Parsing a calendar                                                  */
  /* ------------------------------------------------------------------ */

  function parse(text, options) {
    options = options || {};
    var source = options.source || '';
    var unfolded = unfold(text);
    var lines = unfolded.lines;
    var findings = [];
    var root = { name: 'ROOT', props: [], components: [] };
    var stack = [root];

    for (var i = 0; i < lines.length; i++) {
      var entry = lines[i];
      if (!entry.text.trim()) continue;

      var cl = parseContentLine(entry.text);
      if (!cl) {
        findings.push({
          severity: 'error', code: 'malformed-line',
          message: 'Line ' + entry.line + ' is not a valid iCalendar content line (no ":" separator).',
          line: entry.line
        });
        continue;
      }

      if (cl.name === 'BEGIN') {
        var comp = {
          name: String(cl.value).trim().toUpperCase(),
          props: [], components: [], line: entry.line
        };
        stack[stack.length - 1].components.push(comp);
        stack.push(comp);
        continue;
      }

      if (cl.name === 'END') {
        var want = String(cl.value).trim().toUpperCase();
        var top = stack[stack.length - 1];
        if (top === root) {
          findings.push({
            severity: 'error', code: 'end-without-begin',
            message: 'Line ' + entry.line + ' closes ' + want + ' but no component is open there.',
            line: entry.line
          });
          continue;
        }
        if (top.name !== want) {
          findings.push({
            severity: 'error', code: 'mismatched-end',
            message: 'Line ' + entry.line + ' closes ' + want + ' while ' + top.name +
              ' (opened on line ' + top.line + ') was still open.',
            line: entry.line
          });
          while (stack.length > 1 && stack[stack.length - 1].name !== want) stack.pop();
          if (stack.length > 1) stack.pop();
          continue;
        }
        stack.pop();
        continue;
      }

      stack[stack.length - 1].props.push({
        name: cl.name, params: cl.params, value: cl.value, line: entry.line
      });
    }

    while (stack.length > 1) {
      var unclosed = stack.pop();
      findings.push({
        severity: 'error', code: 'unclosed-component',
        message: unclosed.name + ' opened on line ' + unclosed.line + ' is never closed with END:' + unclosed.name + '.',
        line: unclosed.line
      });
    }

    if (unfolded.overlong.length) {
      findings.push({
        severity: 'warning', code: 'overlong-lines',
        message: unfolded.overlong.length + ' line(s) are longer than the 75-octet limit RFC 5545 sets, so strict parsers may reject the file. First at line ' +
          unfolded.overlong[0].line + ' (' + unfolded.overlong[0].bytes + ' octets).',
        line: unfolded.overlong[0].line
      });
    }

    var calendars = root.components.filter(function (c) { return c.name === 'VCALENDAR'; });
    var strayComponents = root.components.filter(function (c) { return c.name !== 'VCALENDAR'; });

    if (!calendars.length) {
      findings.push({
        severity: 'error', code: 'missing-vcalendar',
        message: 'No BEGIN:VCALENDAR block was found. This does not look like an iCalendar file.'
      });
      if (strayComponents.length) {
        // Some feeds omit the wrapper: still try to read the events inside.
        calendars = [{ name: 'VCALENDAR', props: [], components: strayComponents, line: 0, implicit: true }];
      }
    }

    var events = [];
    var timezoneIds = [];
    var seq = 0;

    calendars.forEach(function (cal) {
      cal.components.forEach(function (comp) {
        if (comp.name === 'VTIMEZONE') {
          var tzProp = comp.props.filter(function (p) { return p.name === 'TZID'; })[0];
          if (tzProp) timezoneIds.push(tzProp.value.trim());
        }
      });
    });

    calendars.forEach(function (cal) {
      cal.components.forEach(function (comp) {
        if (comp.name !== 'VEVENT') return;
        seq += 1;
        events.push(buildEvent(comp, seq, source));
      });
    });

    var calProps = {};
    if (calendars[0]) {
      calendars[0].props.forEach(function (p) {
        if (!calProps[p.name]) calProps[p.name] = [];
        calProps[p.name].push(p.value);
      });
    }

    var duplicates = duplicateUids(events);

    return {
      source: source,
      events: events,
      findings: findings,
      implicitCalendar: !!(calendars[0] && calendars[0].implicit),
      calendar: {
        version: calProps.VERSION ? calProps.VERSION[0].trim() : null,
        prodid: calProps.PRODID ? calProps.PRODID[0].trim() : null,
        calscale: calProps.CALSCALE ? calProps.CALSCALE[0].trim() : null,
        method: calProps.METHOD ? calProps.METHOD[0].trim() : null,
        name: calProps['X-WR-CALNAME'] ? calProps['X-WR-CALNAME'][0] : null,
        timezoneIds: timezoneIds
      },
      duplicateUids: duplicates,
      lineCount: lines.length
    };
  }

  function buildEvent(comp, index, source) {
    var props = {};
    comp.props.forEach(function (p) {
      if (!props[p.name]) props[p.name] = [];
      props[p.name].push(p);
    });
    function one(name) { return props[name] ? props[name][0] : null; }
    function textOf(name) {
      var p = one(name);
      return p ? unescapeText(p.value) : '';
    }

    var issues = [];

    var uid = textOf('UID').trim();
    var summary = textOf('SUMMARY');
    var description = textOf('DESCRIPTION');
    var location = textOf('LOCATION');

    var startProp = one('DTSTART');
    var endProp = one('DTEND');
    var durationProp = one('DURATION');

    var start = null;
    var end = null;

    if (startProp) {
      var parsedStart = parseDateValue(startProp.value);
      if (!parsedStart) {
        issues.push({
          severity: 'error', code: 'invalid-dtstart',
          message: 'DTSTART "' + startProp.value + '" is not a valid iCalendar date or date-time.'
        });
      } else {
        var r = resolveTime(parsedStart, startProp.params, 'DTSTART');
        start = r.time;
        r.problems.forEach(function (p) { issues.push(p); });
      }
    } else {
      issues.push({
        severity: 'error', code: 'missing-dtstart',
        message: 'This event has no DTSTART property, so it has no date to show.'
      });
    }

    if (endProp) {
      var parsedEnd = parseDateValue(endProp.value);
      if (!parsedEnd) {
        issues.push({
          severity: 'error', code: 'invalid-dtend',
          message: 'DTEND "' + endProp.value + '" is not a valid iCalendar date or date-time.'
        });
      } else {
        var re = resolveTime(parsedEnd, endProp.params, 'DTEND');
        end = re.time;
        re.problems.forEach(function (p) { issues.push(p); });
      }
    } else if (durationProp) {
      var ms = parseDuration(durationProp.value);
      if (ms == null) {
        issues.push({
          severity: 'warning', code: 'invalid-duration',
          message: 'DURATION "' + durationProp.value + '" could not be read.'
        });
      } else if (start) {
        var endMs = start.utcMs + ms;
        var p = wallParts(endMs, start.tzid && isKnownTimeZone(start.tzid) ? start.tzid : 'UTC');
        end = {
          kind: start.kind, hasTime: start.hasTime, isUtc: start.isUtc, isFloating: start.isFloating,
          tzid: start.tzid, y: p.y, mo: p.mo, d: p.d, h: p.h, mi: p.mi, s: p.s,
          utcMs: endMs, wallMs: start.kind === 'date' ? endMs : Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s),
          offset: start.offset, derived: true
        };
      }
    }

    if (start && end && end.utcMs < start.utcMs) {
      issues.push({
        severity: 'warning', code: 'end-before-start',
        message: 'DTEND is earlier than DTSTART (' + formatISO(end) + ' < ' + formatISO(start) + '), so the event shows a negative duration.'
      });
    }

    var allDay = !!(start && start.kind === 'date');

    var rruleProp = one('RRULE');
    var rrule = rruleProp ? (parseRRule(rruleProp.value) || null) : null;
    if (rruleProp && !rrule) {
      issues.push({
        severity: 'error', code: 'invalid-rrule',
        message: 'RRULE "' + rruleProp.value + '" has no FREQ part and cannot be interpreted.'
      });
    }

    var status = (textOf('STATUS') || '').trim().toUpperCase();
    if (status && ['TENTATIVE', 'CONFIRMED', 'CANCELLED'].indexOf(status) === -1) {
      issues.push({
        severity: 'warning', code: 'unknown-status',
        message: 'STATUS "' + status + '" is not one of TENTATIVE, CONFIRMED or CANCELLED.'
      });
    }

    var organizerProp = one('ORGANIZER');
    var organizer = organizerProp ? personFrom(organizerProp) : null;
    var attendees = (props.ATTENDEE || []).map(personFrom);

    var categories = textOf('CATEGORIES');
    var categoryList = categories ? categories.split(',').map(function (c) { return c.trim(); }).filter(Boolean) : [];

    var durationMs = start && end ? end.utcMs - start.utcMs : 0;

    return {
      id: 'evt-' + index,
      index: index,
      uid: uid,
      summary: summary || '(No summary)',
      hasSummary: !!summary,
      description: description,
      location: location,
      start: start,
      end: end,
      allDay: allDay,
      durationMs: durationMs,
      durationLabel: start && end ? formatDuration(durationMs) : (start ? 'No end time' : ''),
      status: status,
      organizer: organizer,
      attendees: attendees,
      categories: categoryList,
      url: textOf('URL'),
      rrule: rrule,
      rruleRaw: rruleProp ? rruleProp.value : '',
      recurrenceLabel: rruleProp ? (describeRRule(rruleProp.value) || rruleProp.value) : '',
      recurring: !!rruleProp,
      exdates: (props.EXDATE || []).map(function (p) { return p.value; }),
      dtstamp: textOf('DTSTAMP'),
      sequence: textOf('SEQUENCE'),
      created: textOf('CREATED'),
      lastModified: textOf('LAST-MODIFIED'),
      transp: textOf('TRANSP'),
      issues: issues,
      source: source,
      line: comp.line,
      raw: comp
    };
  }

  function personFrom(prop) {
    var raw = prop.value || '';
    var email = raw.replace(/^mailto:/i, '').trim();
    var cn = prop.params && prop.params.CN ? prop.params.CN[0] : '';
    return {
      name: cn || email || '',
      email: email,
      role: prop.params && prop.params.ROLE ? prop.params.ROLE[0] : '',
      partstat: prop.params && prop.params.PARTSTAT ? prop.params.PARTSTAT[0] : '',
      rsvp: prop.params && prop.params.RSVP ? prop.params.RSVP[0] : ''
    };
  }

  function duplicateUids(events) {
    var seen = {};
    var dups = [];
    events.forEach(function (ev) {
      if (!ev.uid) return;
      if (seen[ev.uid]) dups.push(ev.uid);
      seen[ev.uid] = true;
    });
    return dups;
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */

  function check(id, title, severity, status, message) {
    return { id: id, title: title, severity: severity, status: status, message: message || '' };
  }

  function validate(parsed) {
    var checks = [];
    var events = parsed.events || [];

    parsed.findings.forEach(function (f) {
      checks.push(check(f.code + ':' + (f.line || 0), 'File structure', f.severity,
        f.severity === 'error' ? 'error' : 'warn', f.message));
    });

    if (parsed.implicitCalendar) {
      checks.push(check('implicit-calendar', 'VCALENDAR wrapper', 'warning', 'warn',
        'The file has VEVENT blocks without a surrounding BEGIN:VCALENDAR wrapper. Events were read anyway, but strict calendar apps may refuse it.'));
    }

    var cal = parsed.calendar || {};

    if (!cal.version) {
      checks.push(check('version-missing', 'VERSION:2.0', 'error', 'error',
        'The calendar declares no VERSION property. RFC 5545 requires VERSION:2.0.'));
    } else if (cal.version !== '2.0') {
      checks.push(check('version-value', 'VERSION:2.0', 'error', 'error',
        'VERSION is "' + cal.version + '" but calendar data must be 2.0.'));
    } else {
      checks.push(check('version-ok', 'VERSION:2.0', 'error', 'pass', 'Version 2.0 is declared.'));
    }

    if (!cal.prodid) {
      checks.push(check('prodid-missing', 'PRODID', 'warning', 'warn',
        'PRODID (the identifier of the program that wrote the file) is missing. RFC 5545 requires it.'));
    } else {
      checks.push(check('prodid-ok', 'PRODID', 'warning', 'pass', cal.prodid));
    }

    if (cal.calscale && cal.calscale.toUpperCase() !== 'GREGORIAN') {
      checks.push(check('calscale', 'CALSCALE', 'warning', 'warn',
        'CALSCALE is "' + cal.calscale + '". Only Gregorian dates are supported for display.'));
    }

    if (!events.length) {
      checks.push(check('no-events', 'Events', 'error', 'error',
        parsed.implicitCalendar || parsed.findings.length
          ? 'No VEVENT could be read from this file.'
          : 'The file is valid iCalendar but contains no VEVENT components.'));
    } else {
      checks.push(check('events-found', 'Events', 'error', 'pass',
        events.length + ' event' + (events.length === 1 ? '' : 's') + ' found.'));
    }

    var missingUid = events.filter(function (e) { return !e.uid; });
    if (missingUid.length) {
      checks.push(check('uid-missing', 'UID', 'warning', 'warn',
        missingUid.length + ' of ' + events.length + ' event(s) have no UID. Calendars use UID to update an event later; without it duplicates appear.'));
    } else if (events.length) {
      checks.push(check('uid-ok', 'UID', 'warning', 'pass', 'Every event has a UID.'));
    }

    if (parsed.duplicateUids && parsed.duplicateUids.length) {
      checks.push(check('uid-duplicate', 'Unique UID', 'warning', 'warn',
        'The same UID appears more than once (' + parsed.duplicateUids.slice(0, 3).join(', ') +
        (parsed.duplicateUids.length > 3 ? '…' : '') + '). A calendar app would treat these as the same event.'));
    }

    var missingStamp = events.filter(function (e) { return !e.dtstamp; });
    if (missingStamp.length) {
      checks.push(check('dtstamp-missing', 'DTSTAMP', 'warning', 'warn',
        missingStamp.length + ' event(s) have no DTSTAMP, the time the event was created or last changed.'));
    } else if (events.length) {
      checks.push(check('dtstamp-ok', 'DTSTAMP', 'warning', 'pass', 'Every event carries a DTSTAMP.'));
    }

    var invalidStamps = events.filter(function (e) {
      return e.dtstamp && !parseDateValue(e.dtstamp);
    });
    if (invalidStamps.length) {
      checks.push(check('dtstamp-format', 'DTSTAMP format', 'error', 'error',
        invalidStamps.length + ' DTSTAMP value(s) are not valid UTC date-times (the first is "' + invalidStamps[0].dtstamp + '").'));
    }

    var issueCount = 0;
    var errorCount = 0;
    events.forEach(function (ev) {
      ev.issues.forEach(function (issue) {
        issueCount++;
        if (issue.severity === 'error') errorCount++;
        var title = 'Event ' + ev.index + (ev.summary ? ' · ' + truncate(ev.summary, 48) : '');
        checks.push(check(issue.code + ':event-' + ev.index, title, issue.severity,
          issue.severity === 'error' ? 'error' : 'warn', issue.message));
      });
    });

    if (events.length && !issueCount) {
      checks.push(check('event-fields-ok', 'Event fields', 'error', 'pass',
        'All events contain the fields RFC 5545 requires (DTSTART, UID, DTSTAMP) in a readable format.'));
    }

    var recurring = events.filter(function (e) { return e.recurring; }).length;
    checks.push(check('recurrence', 'Recurrence rules', 'warning', 'pass',
      recurring ? recurring + ' recurring event(s) with a readable RRULE.' : 'No recurring events in this file.'));

    var unknownZones = {};
    events.forEach(function (ev) {
      if (ev.start && ev.start.unknownZone) unknownZones[ev.start.tzid] = true;
      if (ev.end && ev.end.unknownZone) unknownZones[ev.end.tzid] = true;
    });
    var zoneNames = Object.keys(unknownZones);
    if (zoneNames.length) {
      checks.push(check('tz-unknown', 'Time zones', 'warning', 'warn',
        'Unrecognised time zone(s): ' + zoneNames.join(', ') + '. Times in those zones are shown as written.'));
    } else if (events.length) {
      checks.push(check('tz-ok', 'Time zones', 'warning', 'pass', 'Every TZID resolves to a real time zone.'));
    }

    var errors = checks.filter(function (c) { return c.status === 'error'; });
    var warnings = checks.filter(function (c) { return c.status === 'warn'; });

    return {
      status: errors.length ? 'error' : (warnings.length ? 'warning' : 'pass'),
      checks: checks,
      counts: {
        error: errors.length,
        warning: warnings.length,
        pass: checks.filter(function (c) { return c.status === 'pass'; }).length,
        total: checks.length
      }
    };
  }

  function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  /* ------------------------------------------------------------------ */
  /* Stats, sorting, filtering                                           */
  /* ------------------------------------------------------------------ */

  function stats(events) {
    var out = {
      total: events.length, allDay: 0, timed: 0, recurring: 0, cancelled: 0,
      startMs: null, endMs: null, timezones: [], sources: [], noDate: 0
    };
    var tzSet = {};
    var srcSet = {};
    events.forEach(function (ev) {
      if (ev.allDay) out.allDay++; else out.timed++;
      if (ev.recurring) out.recurring++;
      if (ev.status === 'CANCELLED') out.cancelled++;
      if (!ev.start) { out.noDate++; return; }
      var s = ev.start.utcMs;
      var e = ev.end ? ev.end.utcMs : s;
      if (out.startMs === null || s < out.startMs) out.startMs = s;
      if (out.endMs === null || e > out.endMs) out.endMs = e;
      var zone = zoneLabel(ev.start);
      if (zone && zone.indexOf('Floating') === -1) tzSet[zone] = true;
      if (ev.source) srcSet[ev.source] = true;
    });
    out.timezones = Object.keys(tzSet);
    out.sources = Object.keys(srcSet);
    return out;
  }

  function sortEvents(events, sort) {
    var list = events.slice();
    var compare;
    switch (sort) {
      case 'start-desc':
        compare = function (a, b) { return timeOf(b) - timeOf(a) || a.index - b.index; };
        break;
      case 'summary-asc':
        compare = function (a, b) { return a.summary.localeCompare(b.summary) || a.index - b.index; };
        break;
      case 'summary-desc':
        compare = function (a, b) { return b.summary.localeCompare(a.summary) || a.index - b.index; };
        break;
      case 'duration-desc':
        compare = function (a, b) { return (b.durationMs || 0) - (a.durationMs || 0) || timeOf(a) - timeOf(b); };
        break;
      default:
        compare = function (a, b) { return timeOf(a) - timeOf(b) || a.index - b.index; };
    }
    return list.sort(compare);
  }

  function timeOf(ev) {
    if (!ev.start) return Number.MAX_SAFE_INTEGER;
    return ev.start.utcMs;
  }

  function filterEvents(events, options) {
    options = options || {};
    var query = (options.query || '').trim().toLowerCase();
    var filter = options.filter || 'all';
    return events.filter(function (ev) {
      if (filter === 'recurring' && !ev.recurring) return false;
      if (filter === 'allday' && !ev.allDay) return false;
      if (filter === 'timed' && ev.allDay) return false;
      if (filter === 'cancelled' && ev.status !== 'CANCELLED') return false;
      if (!query) return true;
      var haystack = [
        ev.summary, ev.description, ev.location, ev.uid,
        ev.organizer ? ev.organizer.name + ' ' + ev.organizer.email : '',
        ev.attendees.map(function (a) { return a.name + ' ' + a.email; }).join(' '),
        ev.categories.join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  var CSV_COLUMNS = [
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
    { key: 'startUtc', label: 'Start (UTC)' },
    { key: 'endUtc', label: 'End (UTC)' },
    { key: 'timezone', label: 'Time Zone' },
    { key: 'allDay', label: 'All Day' },
    { key: 'summary', label: 'Summary' },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'organizer', label: 'Organizer' },
    { key: 'attendees', label: 'Attendees' },
    { key: 'recurrence', label: 'Recurrence' },
    { key: 'uid', label: 'UID' },
    { key: 'calendar', label: 'Calendar' }
  ];

  function cellValue(ev, key) {
    switch (key) {
      case 'start': return formatCSVTime(ev.start);
      case 'end': return formatCSVTime(ev.end);
      case 'startUtc': return formatUTCClock(ev.start);
      case 'endUtc': return formatUTCClock(ev.end);
      case 'timezone': return ev.allDay ? '' : zoneLabel(ev.start);
      case 'allDay': return ev.allDay ? 'Yes' : 'No';
      case 'summary': return ev.summary;
      case 'location': return ev.location;
      case 'description': return ev.description;
      case 'status': return ev.status ? titleCase(ev.status) : '';
      case 'organizer': return ev.organizer ? (ev.organizer.name ? ev.organizer.name + ' <' + ev.organizer.email + '>' : ev.organizer.email) : '';
      case 'attendees': return ev.attendees.map(function (a) {
        return a.name && a.name !== a.email ? a.name + ' <' + a.email + '>' : a.email;
      }).filter(Boolean).join('; ');
      case 'recurrence': return ev.recurrenceLabel;
      case 'uid': return ev.uid;
      case 'calendar': return ev.source || '';
      default: return '';
    }
  }

  function titleCase(value) {
    return String(value).charAt(0) + String(value).slice(1).toLowerCase();
  }

  function escapeCSV(value) {
    var str = value == null ? '' : String(value);
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /** RFC 4180 CSV with optional UTF-8 BOM for Excel. */
  function toCSV(events, options) {
    options = options || {};
    var columns = options.columns || CSV_COLUMNS;
    var eol = options.eol || '\r\n';
    var rows = [];
    rows.push(columns.map(function (c) { return escapeCSV(c.label); }).join(','));
    events.forEach(function (ev) {
      rows.push(columns.map(function (c) { return escapeCSV(cellValue(ev, c.key)); }).join(','));
    });
    var body = rows.join(eol) + eol;
    return (options.bom === false ? '' : '\uFEFF') + body;
  }

  /** Tab-separated text for pasting into Excel, Sheets or Notion. */
  function toTSV(events, options) {
    options = options || {};
    var columns = options.columns || CSV_COLUMNS;
    function clean(value) {
      return String(value == null ? '' : value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    }
    var rows = [columns.map(function (c) { return clean(c.label); }).join('\t')];
    events.forEach(function (ev) {
      rows.push(columns.map(function (c) { return clean(cellValue(ev, c.key)); }).join('\t'));
    });
    return rows.join('\n');
  }

  function toJSON(events, options) {
    options = options || {};
    var out = events.map(function (ev) {
      return {
        summary: ev.summary,
        start: formatISO(ev.start),
        end: formatISO(ev.end),
        startUtc: ev.start && ev.start.hasTime ? new Date(ev.start.utcMs).toISOString() : null,
        endUtc: ev.end && ev.end.hasTime ? new Date(ev.end.utcMs).toISOString() : null,
        timeZone: ev.allDay ? null : zoneLabel(ev.start) || null,
        allDay: ev.allDay,
        location: ev.location || null,
        description: ev.description || null,
        status: ev.status || null,
        organizer: ev.organizer ? { name: ev.organizer.name || null, email: ev.organizer.email || null } : null,
        attendees: ev.attendees.map(function (a) {
          return { name: a.name || null, email: a.email || null, role: a.role || null, status: a.partstat || null };
        }),
        categories: ev.categories,
        recurrenceRule: ev.rruleRaw || null,
        recurrence: ev.recurrenceLabel || null,
        uid: ev.uid || null,
        url: ev.url || null,
        calendar: ev.source || null
      };
    });
    return JSON.stringify(out, null, options.indent == null ? 2 : options.indent);
  }

  /* ------------------------------------------------------------------ */
  /* Sample calendar                                                     */
  /* ------------------------------------------------------------------ */

  var SAMPLE_LINES = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Northwind Labs//Product Team Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Product Team – March 2026',
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'X-LIC-LOCATION:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:4f3c1a90-standup-2026@northwindlabs.example',
    'DTSTAMP:20260227T160000Z',
    'DTSTART;TZID=America/New_York:20260302T093000',
    'DTEND;TZID=America/New_York:20260302T094500',
    'SUMMARY:Weekly product stand-up',
    'DESCRIPTION:Forty-five minutes\, no slides. Each owner reports what shipped\, what is blocked and what needs a decision this week.\\nJoin from the usual Zoom room or dial in from the calendar invite.',
    'LOCATION:Zoom – Room 2',
    'ORGANIZER;CN=Maya Chen:mailto:maya.chen@northwindlabs.example',
    'ATTENDEE;CN=Maya Chen;ROLE=CHAIR;PARTSTAT=ACCEPTED:mailto:maya.chen@northwindlabs.example',
    'ATTENDEE;CN=Daniel Ruiz;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:daniel.ruiz@northwindlabs.example',
    'ATTENDEE;CN=Priya Nair;ROLE=OPT-PARTICIPANT;PARTSTAT=TENTATIVE:mailto:priya.nair@northwindlabs.example',
    'STATUS:CONFIRMED',
    'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=12',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:7b21e450-design-review-2026@northwindlabs.example',
    'DTSTAMP:20260227T160500Z',
    'DTSTART;TZID=America/New_York:20260303T140000',
    'DTEND;TZID=America/New_York:20260303T153000',
    'SUMMARY:Design review: onboarding v3',
    'DESCRIPTION:Walk through the new empty states and the migration screen. Bring the latest Figma link.',
    'LOCATION:Studio B',
    'ORGANIZER;CN=Ines Duarte:mailto:ines.duarte@northwindlabs.example',
    'ATTENDEE;CN=Maya Chen:mailto:maya.chen@northwindlabs.example',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:2d9e6c11-offsite-2026@northwindlabs.example',
    'DTSTAMP:20260227T160900Z',
    'DTSTART;VALUE=DATE:20260306',
    'DTEND;VALUE=DATE:20260309',
    'SUMMARY:Team offsite',
    'DESCRIPTION:Two nights in the mountains. Sessions in the morning\\; hiking in the afternoon.',
    'LOCATION:Lake Tahoe Lodge',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:5a8f0b23-quarter-close-2026@northwindlabs.example',
    'DTSTAMP:20260227T161200Z',
    'DTSTART:20260310T210000Z',
    'DTEND:20260310T220000Z',
    'SUMMARY:Quarter close sync with London',
    'DESCRIPTION:Numbers lock at 17:00 London time. Finance walks through the bridge before the board pack goes out.',
    'LOCATION:Video call',
    'ORGANIZER;CN=Tom Whitfield:mailto:tom.whitfield@northwindlabs.example',
    'ATTENDEE;CN=Maya Chen:mailto:maya.chen@northwindlabs.example',
    'ATTENDEE;CN=Amara Okafor;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:amara@northwindlabs.example',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:8c4d7e02-retro-2026@northwindlabs.example',
    'DTSTAMP:20260227T161400Z',
    'DTSTART;TZID=Europe/London:20260312T160000',
    'DTEND;TZID=Europe/London:20260312T170000',
    'SUMMARY:Sprint retrospective',
    'DESCRIPTION:What helped\, what hurt\, what we try next sprint. Notes go to the shared doc within an hour.',
    'LOCATION:Meet – sprint room',
    'STATUS:CONFIRMED',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20260521T170000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:1e6b9a44-customer-call-2026@northwindlabs.example',
    'DTSTAMP:20260227T161600Z',
    'DTSTART;TZID=America/Los_Angeles:20260313T080000',
    'DTEND;TZID=America/Los_Angeles:20260313T090000',
    'SUMMARY:Customer call: Brightline',
    'DESCRIPTION:Renewal conversation. They want SSO and a audit log export before Q3.',
    'LOCATION:Phone',
    'ORGANIZER;CN=Daniel Ruiz:mailto:daniel.ruiz@northwindlabs.example',
    'STATUS:TENTATIVE',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:9b0c5d77-planning-2026@northwindlabs.example',
    'DTSTAMP:20260227T161900Z',
    'DTSTART;TZID=America/New_York:20260316T100000',
    'DTEND;TZID=America/New_York:20260316T113000',
    'SUMMARY:Q2 planning workshop',
    'DESCRIPTION:Bring one page per bet: the problem\, the evidence\, the smallest test. We pick three to start in April.',
    'LOCATION:Studio A',
    'ORGANIZER;CN=Maya Chen:mailto:maya.chen@northwindlabs.example',
    'ATTENDEE;CN=Maya Chen:mailto:maya.chen@northwindlabs.example',
    'ATTENDEE;CN=Priya Nair;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:priya.nair@northwindlabs.example',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:3f7a2c88-holiday-2026@northwindlabs.example',
    'DTSTAMP:20260227T162100Z',
    'DTSTART;VALUE=DATE:20260320',
    'SUMMARY:Company holiday – spring day',
    'DESCRIPTION:Offices closed. Support cover is on the published rota.',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:6d2f8b19-office-hours-2026@northwindlabs.example',
    'DTSTAMP:20260227T162300Z',
    'DTSTART;TZID=America/New_York:20260305T160000',
    'DTEND;TZID=America/New_York:20260305T170000',
    'SUMMARY:Open office hours',
    'DESCRIPTION:No agenda. Book a ten-minute slot or just drop in.',
    'LOCATION:Zoom – Room 4',
    'STATUS:CONFIRMED',
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=6',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:0a1b2c3d-cancelled-2026@northwindlabs.example',
    'DTSTAMP:20260227T162500Z',
    'DTSTART;TZID=America/New_York:20260311T110000',
    'DTEND;TZID=America/New_York:20260311T120000',
    'SUMMARY:Vendor demo (moved to April)',
    'DESCRIPTION:Moved because the vendor could not join this week.',
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  // The sample is folded exactly like a calendar app would write it.
  var SAMPLE_ICS = SAMPLE_LINES.reduce(function (acc, line) {
    return acc.concat(foldICSLine(line, 75));
  }, []).join('\r\n');

  /* ------------------------------------------------------------------ */

  var ICSCore = {
    VERSION: VERSION,
    parse: parse,
    validate: validate,
    stats: stats,
    sortEvents: sortEvents,
    filterEvents: filterEvents,
    toCSV: toCSV,
    toTSV: toTSV,
    toJSON: toJSON,
    CSV_COLUMNS: CSV_COLUMNS,
    cellValue: cellValue,
    escapeCSV: escapeCSV,
    describeRRule: describeRRule,
    parseRRule: parseRRule,
    formatTime: formatTime,
    formatISO: formatISO,
    formatRange: formatRange,
    formatDuration: formatDuration,
    parseDateValue: parseDateValue,
    resolveTime: resolveTime,
    zonedToUtc: zonedToUtc,
    tzOffsetMinutes: tzOffsetMinutes,
    wallParts: wallParts,
    isKnownTimeZone: isKnownTimeZone,
    unescapeText: unescapeText,
    foldICSLine: foldICSLine,
    unfold: unfold,
    parseContentLine: parseContentLine,
    utf8Length: utf8Length,
    localTimeZone: localTimeZone,
    SAMPLE_ICS: SAMPLE_ICS
  };

  global.ICSCore = ICSCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = ICSCore;

})(typeof globalThis !== 'undefined' ? globalThis : this);
