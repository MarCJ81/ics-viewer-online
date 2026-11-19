/* ==========================================================================
   ICS Viewer & Converter — UI logic
   Depends on assets/ics-core.js (window.ICSCore). No network calls anywhere.
   ========================================================================== */
(function () {
  'use strict';

  var C = window.ICSCore;
  if (!C) return;

  var $ = function (id) { return document.getElementById(id); };

  var ICONS = {
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21 20H3z"/><path d="M12 9v5M12 17.2v.1"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.1"/></svg>'
  };

  var state = {
    files: [],
    parsed: [],
    events: [],
    reports: [],
    isSample: false,
    query: '',
    filter: 'all',
    sort: 'start-asc',
    tzMode: 'event',
    tab: 'events',
    selectedId: null
  };

  /* ------------------------------------------------------------------ */
  /* Loading                                                             */
  /* ------------------------------------------------------------------ */

  function readFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return Promise.resolve([]);
    return Promise.all(files.map(function (file) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve({ name: file.name, text: String(reader.result || '') });
        };
        reader.onerror = function () {
          resolve({ name: file.name, text: '' });
        };
        reader.readAsText(file, 'utf-8');
      });
    }));
  }

  function loadTexts(items, options) {
    options = options || {};
    var append = !!options.append && state.files.length > 0;
    if (!append) {
      state.files = [];
      state.parsed = [];
    }
    items.forEach(function (item) {
      state.files.push({ name: item.name, text: item.text });
    });

    state.isSample = !!options.sample;
    reparse();
    renderAll();

    var count = state.events.length;
    var report = combinedReport();
    if (count) {
      if (!options.quiet) {
        toast(count + (count === 1 ? ' event' : ' events') + ' read from ' + describeSources());
      }
      if (report.status === 'error') setTab('validation');
    } else {
      setTab('validation');
      toast('No events found — open the validation report for details');
    }
  }

  function reparse() {
    state.parsed = [];
    state.events = [];
    state.reports = [];

    state.files.forEach(function (file) {
      var parsed = C.parse(file.text, { source: file.name });
      parsed.events.forEach(function (ev, i) {
        ev.id = 'evt-' + state.events.length;
        ev.globalIndex = state.events.length + 1;
        state.events.push(ev);
      });
      state.parsed.push(parsed);
      state.reports.push(C.validate(parsed));
    });
  }

  function describeSources() {
    if (state.isSample) return 'the sample calendar';
    if (state.files.length === 1) return state.files[0].name || 'your file';
    return state.files.length + ' files';
  }

  function loadSample() {
    loadTexts([{ name: 'sample.ics', text: C.SAMPLE_ICS }], { sample: true, append: false });
    setTab('events');
  }

  function clearAll() {
    state.files = [];
    state.parsed = [];
    state.events = [];
    state.reports = [];
    state.isSample = false;
    state.query = '';
    $('search').value = '';
    renderAll();
    toast('Cleared');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    var hasData = state.events.length > 0 || state.files.length > 0;
    $('results').hidden = !hasData;
    $('empty-state').hidden = hasData;
    var card = document.querySelector('.tool-card');
    if (card) card.classList.toggle('has-results', hasData);

    if (!hasData) {
      $('source-name').textContent = '';
      return;
    }

    renderSourceBar();
    renderStats();
    renderValidation();
    renderTable();
    applyTab();
  }

  function renderSourceBar() {
    var label;
    if (state.isSample) label = 'sample.ics';
    else if (state.files.length === 1) label = state.files[0].name || 'pasted text';
    else label = state.files.length + ' calendars merged';
    $('source-name').textContent = label;

    var badge = $('sample-badge');
    badge.hidden = !state.isSample;

    var meta = [];
    meta.push(state.files.length + (state.files.length === 1 ? ' file' : ' files'));
    meta.push('read in this tab');
    if (state.isSample) meta.push('demo data');
    $('source-meta').textContent = meta.join(' · ');
  }

  function renderStats() {
    var s = C.stats(state.events);
    $('stat-events').textContent = formatNumber(s.total);
    $('stat-events-sub').textContent = s.allDay + ' all-day · ' + s.timed + ' timed';

    if (s.startMs != null) {
      var a = C.formatTime(msToTime(s.startMs), state.tzMode);
      var b = C.formatTime(msToTime(s.endMs), state.tzMode);
      var sameDay = a.date === b.date;
      var sameYear = a.date.slice(-4) === b.date.slice(-4);
      $('stat-range').textContent = sameDay
        ? a.date
        : (sameYear ? a.date.replace(/,\s*\d{4}$/, '') + ' – ' + b.date : a.date + ' – ' + b.date);
      $('stat-range-sub').textContent = sameDay ? (a.isDate ? 'All-day range' : '') : 'first start → last end';
    } else {
      $('stat-range').textContent = '—';
      $('stat-range-sub').textContent = '';
    }

    $('stat-recurring').textContent = formatNumber(s.recurring);
    $('stat-recurring').parentNode.querySelector('.stat-sub').textContent =
      s.recurring === 1 ? 'event with an RRULE' : 'events with an RRULE';

    $('stat-zones').textContent = s.timezones.length ? String(s.timezones.length) : 'None';
    $('stat-zones-sub').textContent = s.timezones.length
      ? s.timezones.slice(0, 2).join(', ') + (s.timezones.length > 2 ? ' +' + (s.timezones.length - 2) : '')
      : 'Floating or all-day only';

    var report = combinedReport();
    var val = $('stat-validation');
    val.textContent = report.status === 'pass' ? 'Passed'
      : report.status === 'warning' ? report.counts.warning + ' warning' + (report.counts.warning === 1 ? '' : 's')
      : report.counts.error + ' error' + (report.counts.error === 1 ? '' : 's');
    val.className = 'stat-value small';
    val.style.color = report.status === 'pass' ? 'var(--green)'
      : report.status === 'warning' ? 'var(--amber)' : 'var(--red)';
    $('stat-validation-sub').textContent = report.counts.total + ' checks run';
  }

  function msToTime(ms) {
    var p = C.wallParts(ms, 'UTC');
    var tz = C.localTimeZone();
    return {
      kind: 'datetime', hasTime: true, isUtc: true, isFloating: false, tzid: null,
      y: p.y, mo: p.mo, d: p.d, h: p.h, mi: p.mi, s: p.s,
      utcMs: ms, wallMs: ms, offset: 0
    };
  }

  function formatNumber(n) {
    return String(n);
  }

  function combinedReport() {
    var checks = [];
    state.reports.forEach(function (report, i) {
      var prefix = state.reports.length > 1 && state.files[i] ? state.files[i].name + ' — ' : '';
      report.checks.forEach(function (ch) {
        checks.push({
          id: ch.id, title: prefix + ch.title, severity: ch.severity,
          status: ch.status, message: ch.message
        });
      });
    });
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

  function hasErrors() {
    return combinedReport().status === 'error';
  }

  function renderValidation() {
    var report = combinedReport();
    var summary = $('validation-summary');
    summary.innerHTML = '';

    var box = document.createElement('div');
    box.className = 'val-summary ' + report.status;

    var icon = document.createElement('span');
    icon.className = 'val-icon';
    icon.innerHTML = report.status === 'pass' ? ICONS.check : report.status === 'warning' ? ICONS.warn : ICONS.error;
    box.appendChild(icon);

    var copy = document.createElement('div');
    copy.className = 'val-copy';
    var h = document.createElement('h3');
    h.textContent = report.status === 'pass' ? 'No problems found'
      : report.status === 'warning' ? 'The file is readable, with something to check'
      : 'This file has errors';
    var p = document.createElement('p');
    p.textContent = report.status === 'pass'
      ? 'Every required property is present and every date, time zone and recurrence rule could be read.'
      : report.status === 'warning'
        ? 'Events were read successfully. The warnings below may still cause duplicates or shifted times when the file is imported somewhere else.'
        : 'Events that could be read are shown below, but the errors listed here will break the file in a calendar app.';
    copy.appendChild(h);
    copy.appendChild(p);
    box.appendChild(copy);

    var counts = document.createElement('div');
    counts.className = 'val-counts';
    counts.appendChild(badge(report.counts.error + ' error' + (report.counts.error === 1 ? '' : 's'),
      report.counts.error ? 'badge-err' : 'badge-ok'));
    counts.appendChild(badge(report.counts.warning + ' warning' + (report.counts.warning === 1 ? '' : 's'),
      report.counts.warning ? 'badge-warn' : 'badge-ok'));
    counts.appendChild(badge(report.counts.pass + ' passed', 'badge-ok'));
    box.appendChild(counts);
    summary.appendChild(box);

    var list = $('validation-list');
    list.innerHTML = '';
    var errors = report.checks.filter(function (c) { return c.status === 'error'; });
    var warnings = report.checks.filter(function (c) { return c.status === 'warn'; });
    var passes = report.checks.filter(function (c) { return c.status === 'pass'; });

    if (errors.length) list.appendChild(groupTitle('Errors'));
    errors.forEach(function (c) { list.appendChild(validationItem(c, 'error')); });
    if (warnings.length) list.appendChild(groupTitle('Warnings'));
    warnings.forEach(function (c) { list.appendChild(validationItem(c, 'warn')); });
    if (passes.length) list.appendChild(groupTitle('Passed checks'));
    passes.forEach(function (c) { list.appendChild(validationItem(c, 'pass')); });

    var issues = report.counts.error + report.counts.warning;
    var countEl = $('tab-validation-count');
    countEl.textContent = String(issues);
    countEl.hidden = issues === 0;
    countEl.className = 'count' + (report.counts.error ? ' is-error' : report.counts.warning ? ' is-warn' : '');
  }

  function groupTitle(text) {
    var li = document.createElement('li');
    li.className = 'val-group-title';
    li.textContent = text;
    return li;
  }

  function validationItem(check, kind) {
    var li = document.createElement('li');
    li.className = 'val-item ' + kind;
    var icon = document.createElement('span');
    icon.className = 'vi-icon';
    icon.innerHTML = kind === 'error' ? ICONS.error : kind === 'warn' ? ICONS.warn : ICONS.check;
    li.appendChild(icon);

    var body = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'vi-title';
    title.textContent = check.title;
    var tag = document.createElement('span');
    tag.className = 'vi-tag';
    tag.textContent = kind === 'error' ? 'error' : kind === 'warn' ? 'warning' : 'passed';
    title.appendChild(tag);
    body.appendChild(title);

    if (check.message) {
      var msg = document.createElement('div');
      msg.className = 'vi-msg';
      msg.textContent = check.message;
      body.appendChild(msg);
    }
    li.appendChild(body);
    return li;
  }

  function badge(text, cls) {
    var span = document.createElement('span');
    span.className = 'badge ' + (cls || '');
    span.textContent = text;
    return span;
  }

  /* ------------------------------------------------------------------ */
  /* Table                                                               */
  /* ------------------------------------------------------------------ */

  function visibleEvents() {
    var filtered = C.filterEvents(state.events, { query: state.query, filter: state.filter });
    return C.sortEvents(filtered, state.sort);
  }

  function whenText(ev) {
    if (!ev.start) return { primary: 'No date', secondary: 'DTSTART missing' };
    var s = C.formatTime(ev.start, state.tzMode);
    var e = ev.end ? C.formatTime(ev.end, state.tzMode) : null;
    var zone = s.zone ? ' ' + s.zone : '';

    if (ev.allDay) {
      var secondary = e ? 'All-day · ends ' + e.date + ' (exclusive)' : 'All day';
      return { primary: s.weekday + ', ' + s.date, secondary: secondary };
    }

    var secondary;
    if (!e) {
      secondary = s.time + zone;
    } else if (s.date === e.date) {
      secondary = s.time + ' – ' + e.time + zone;
    } else {
      secondary = s.time + ' – ' + e.weekday + ', ' + e.date + ', ' + e.time + zone;
    }
    return { primary: s.weekday + ', ' + s.date, secondary: secondary };
  }

  function eventBadges(ev) {
    var out = [];
    if (ev.status === 'CANCELLED') out.push(badge('Cancelled', 'badge-cancelled'));
    if (ev.status === 'TENTATIVE') out.push(badge('Tentative', 'badge-tentative'));
    if (ev.recurring) out.push(badge('Recurring', 'badge-recurring'));
    if (ev.allDay) out.push(badge('All-day', 'badge-allday'));
    return out;
  }

  function renderTable() {
    var events = visibleEvents();
    var tbody = $('events-body');
    var cards = $('event-cards');
    tbody.innerHTML = '';
    cards.innerHTML = '';

    $('tab-events-count').textContent = String(events.length);
    document.querySelector('.table-wrap').classList.toggle('single-source', state.files.length <= 1);
    var total = state.events.length;
    $('export-scope').textContent = events.length === total
      ? (total === 1 ? 'this event' : 'all ' + total + ' events')
      : events.length + ' of ' + total + ' events';

    if (!events.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 5;
      td.style.padding = '26px 16px';
      td.style.color = 'var(--muted)';
      td.textContent = state.events.length
        ? 'No event matches this search or filter.'
        : 'No events in this file.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    events.forEach(function (ev) {
      tbody.appendChild(tableRow(ev));
      cards.appendChild(eventCard(ev));
    });

    $('table-note').hidden = !events.length;
  }

  function tableRow(ev) {
    var tr = document.createElement('tr');
    tr.dataset.id = ev.id;
    tr.tabIndex = 0;
    if (ev.status === 'CANCELLED') tr.classList.add('is-cancelled');
    if (state.selectedId === ev.id) tr.classList.add('is-selected');
    tr.setAttribute('aria-label', ev.summary + ', open details');

    var when = document.createElement('td');
    when.className = 'col-when';
    var w = whenText(ev);
    var p1 = document.createElement('div');
    p1.className = 'when-primary';
    p1.textContent = w.primary;
    var p2 = document.createElement('div');
    p2.className = 'when-secondary';
    p2.textContent = w.secondary;
    when.appendChild(p1);
    when.appendChild(p2);

    var info = document.createElement('td');
    info.className = 'col-event';
    var summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = ev.summary;
    info.appendChild(summary);
    if (ev.location) {
      var where = document.createElement('div');
      where.className = 'where';
      where.innerHTML = ICONS.pin;
      var span = document.createElement('span');
      span.textContent = ev.location;
      where.appendChild(span);
      info.appendChild(where);
    }
    var badges = eventBadges(ev);
    if (badges.length) {
      var wrap = document.createElement('div');
      wrap.className = 'badges';
      badges.forEach(function (b) { wrap.appendChild(b); });
      info.appendChild(wrap);
    }

    var duration = document.createElement('td');
    duration.className = 'col-duration';
    duration.textContent = ev.durationLabel || '—';

    var calendar = document.createElement('td');
    calendar.className = 'col-calendar';
    calendar.textContent = ev.source || '—';

    var end = document.createElement('td');
    end.className = 'row-end';
    var chev = document.createElement('span');
    chev.className = 'chev';
    chev.innerHTML = ICONS.chevron;
    end.appendChild(chev);

    tr.appendChild(when);
    tr.appendChild(info);
    tr.appendChild(duration);
    tr.appendChild(calendar);
    tr.appendChild(end);

    tr.addEventListener('click', function () { openDialog(ev); });
    tr.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDialog(ev);
      }
    });
    return tr;
  }

  function eventCard(ev) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'event-card';
    if (ev.status === 'CANCELLED') btn.style.opacity = '0.75';

    var when = document.createElement('span');
    when.className = 'ec-when';
    var w = whenText(ev);
    when.textContent = w.primary + ' · ' + w.secondary.replace(' (exclusive)', '');
    btn.appendChild(when);

    var summary = document.createElement('span');
    summary.className = 'ec-summary';
    summary.textContent = ev.summary;
    btn.appendChild(summary);

    var meta = document.createElement('span');
    meta.className = 'ec-meta';
    var bits = [ev.durationLabel];
    if (ev.location) bits.push(ev.location);
    meta.textContent = bits.filter(Boolean).join(' · ');
    if (meta.textContent) btn.appendChild(meta);

    var badges = eventBadges(ev);
    if (badges.length) {
      var wrap = document.createElement('span');
      wrap.className = 'badges';
      badges.forEach(function (b) { wrap.appendChild(b); });
      btn.appendChild(wrap);
    }

    btn.addEventListener('click', function () { openDialog(ev); });
    li.appendChild(btn);
    return li;
  }

  /* ------------------------------------------------------------------ */
  /* Detail dialog                                                       */
  /* ------------------------------------------------------------------ */

  function openDialog(ev) {
    state.selectedId = ev.id;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#events-body tr'));
    rows.forEach(function (tr) { tr.classList.toggle('is-selected', tr.dataset.id === ev.id); });

    $('dialog-title').textContent = ev.summary;

    var badges = $('dialog-badges');
    badges.innerHTML = '';
    eventBadges(ev).forEach(function (b) { badges.appendChild(b); });

    var body = $('dialog-body');
    body.innerHTML = '';

    var grid = document.createElement('dl');
    grid.className = 'detail-grid';
    function row(label, value) {
      if (!value) return;
      var dt = document.createElement('dt');
      dt.textContent = label;
      var dd = document.createElement('dd');
      dd.textContent = value;
      grid.appendChild(dt);
      grid.appendChild(dd);
    }

    row('When', whenText(ev).primary + ', ' + whenText(ev).secondary.replace(' (exclusive)', ''));
    if (ev.start && ev.start.hasTime) {
      row('Starts', C.formatISO(ev.start) + (ev.start.tzid ? ' (' + ev.start.tzid + ')' : ''));
    } else if (ev.start) {
      row('Starts', C.formatISO(ev.start) + ' (all-day)');
    }
    if (ev.end) {
      row('Ends', C.formatISO(ev.end) + (ev.allDay ? ' (exclusive)' : ''));
    }
    row('Duration', ev.durationLabel);
    row('Status', ev.status ? ev.status.charAt(0) + ev.status.slice(1).toLowerCase() : '');
    row('Location', ev.location);
    if (ev.categories.length) row('Categories', ev.categories.join(', '));
    if (ev.recurrenceLabel) row('Repeats', ev.recurrenceLabel);
    if (ev.rruleRaw) row('RRULE', ev.rruleRaw);
    if (ev.organizer) row('Organizer', personLabel(ev.organizer));
    row('UID', ev.uid);
    if (ev.url) row('URL', ev.url);
    row('Calendar', ev.source ? ev.source + ' · line ' + ev.line : '');
    body.appendChild(grid);

    if (ev.description) {
      body.appendChild(detailBlock('Description', ev.description, true));
    }

    if (ev.attendees.length) {
      var block = document.createElement('div');
      block.className = 'detail-block';
      var h = document.createElement('h4');
      h.textContent = 'Attendees (' + ev.attendees.length + ')';
      block.appendChild(h);
      var ul = document.createElement('ul');
      ul.className = 'people';
      ev.attendees.forEach(function (a) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.textContent = a.name || a.email || 'Unknown';
        li.appendChild(name);
        if (a.email && a.email !== a.name) {
          var mail = document.createElement('span');
          mail.className = 'email';
          mail.textContent = a.email;
          li.appendChild(mail);
        }
        if (a.role) {
          var role = document.createElement('span');
          role.className = 'role';
          role.textContent = a.role.toLowerCase().replace(/-/g, ' ');
          li.appendChild(role);
        }
        if (a.partstat) {
          var st = document.createElement('span');
          st.className = 'role';
          st.textContent = a.partstat.toLowerCase().replace(/-/g, ' ');
          li.appendChild(st);
        }
        ul.appendChild(li);
      });
      block.appendChild(ul);
      body.appendChild(block);
    }

    if (ev.issues.length) {
      var issues = document.createElement('div');
      issues.className = 'detail-block';
      var ih = document.createElement('h4');
      ih.textContent = 'Issues with this event';
      issues.appendChild(ih);
      var list = document.createElement('ul');
      list.className = 'dialog-issues';
      ev.issues.forEach(function (issue) {
        var li = document.createElement('li');
        li.className = issue.severity;
        li.textContent = issue.message;
        list.appendChild(li);
      });
      issues.appendChild(list);
      body.appendChild(issues);
    }

    var dialog = $('event-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function personLabel(person) {
    if (!person) return '';
    if (person.name && person.email && person.name !== person.email) return person.name + ' <' + person.email + '>';
    return person.name || person.email || '';
  }

  function detailBlock(title, text, preformatted) {
    var block = document.createElement('div');
    block.className = 'detail-block';
    var h = document.createElement('h4');
    h.textContent = title;
    block.appendChild(h);
    var p = document.createElement('div');
    p.className = preformatted ? 'body-text' : '';
    p.textContent = text;
    block.appendChild(p);
    return block;
  }

  function closeDialog() {
    var dialog = $('event-dialog');
    if (dialog.open) dialog.close();
    state.selectedId = null;
    Array.prototype.slice.call(document.querySelectorAll('#events-body tr.is-selected'))
      .forEach(function (tr) { tr.classList.remove('is-selected'); });
  }

  /* ------------------------------------------------------------------ */
  /* Tabs                                                                */
  /* ------------------------------------------------------------------ */

  function setTab(tab) {
    state.tab = tab;
    applyTab();
  }

  function applyTab() {
    var isEvents = state.tab === 'events';
    $('tab-events').setAttribute('aria-selected', isEvents ? 'true' : 'false');
    $('tab-events').tabIndex = isEvents ? 0 : -1;
    $('tab-validation').setAttribute('aria-selected', isEvents ? 'false' : 'true');
    $('tab-validation').tabIndex = isEvents ? -1 : 0;
    $('panel-events').hidden = !isEvents;
    $('panel-validation').hidden = isEvents;
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  function exportBase() {
    if (state.isSample) return 'sample-events';
    if (state.files.length === 1) {
      var name = (state.files[0].name || 'calendar').replace(/\.(ics|ical|txt)$/i, '');
      return (name || 'calendar').replace(/[^\w\-. ]+/g, '-') + '-events';
    }
    return 'calendar-events';
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportCSV() {
    var events = visibleEvents();
    if (!events.length) { toast('Nothing to export'); return; }
    var csv = C.toCSV(events, { bom: $('csv-bom').checked });
    download(exportBase() + '.csv', csv, 'text/csv;charset=utf-8');
    toast('CSV ready — ' + events.length + ' rows' + ($('csv-bom').checked ? ' with Excel BOM' : ''));
  }

  function exportJSON() {
    var events = visibleEvents();
    if (!events.length) { toast('Nothing to export'); return; }
    download(exportBase() + '.json', C.toJSON(events), 'application/json;charset=utf-8');
    toast('JSON ready — ' + events.length + ' events');
  }

  function copyTSV() {
    var events = visibleEvents();
    if (!events.length) { toast('Nothing to copy'); return; }
    var text = C.toTSV(events);
    var done = function () { toast(events.length + ' rows copied as tab-separated text'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) done();
    else toast('Copy failed — select the table and copy manually');
  }

  /* ------------------------------------------------------------------ */
  /* Toast, theme, wiring                                                */
  /* ------------------------------------------------------------------ */

  var toastTimer = null;
  function toast(message) {
    var el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('icsv-theme'); } catch (e) { stored = null; }
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
    updateThemeButton();
  }

  function updateThemeButton() {
    var current = document.documentElement.getAttribute('data-theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = current === 'dark' || (!current && prefersDark);
    $('theme-toggle').setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    $('theme-toggle').title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = current === 'dark' || (!current && prefersDark);
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('icsv-theme', next); } catch (e) { /* storage may be blocked */ }
    updateThemeButton();
  }

  function showPaste(show) {
    $('paste-panel').hidden = !show;
    if (show) {
      $('paste-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      $('paste-input').focus();
    }
  }

  function wire() {
    // "Choose files" starts a new set; "Add files" merges into the current one.
    var pendingAppend = false;
    function pickFiles(append) {
      pendingAppend = append;
      $('file-input').click();
    }
    $('browse-btn').addEventListener('click', function () { pickFiles(false); });
    $('add-files').addEventListener('click', function () { pickFiles(true); });
    $('file-input').addEventListener('change', function (e) {
      var files = e.target.files;
      if (!files || !files.length) return;
      var append = pendingAppend && state.files.length > 0 && !state.isSample;
      readFiles(files).then(function (items) {
        loadTexts(items, { append: append });
      });
      pendingAppend = false;
      e.target.value = '';
    });

    // Drag and drop
    var zone = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (e) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('is-over');
      });
    });
    ['dragleave', 'dragend'].forEach(function (type) {
      zone.addEventListener(type, function (e) {
        e.preventDefault();
        zone.classList.remove('is-over');
      });
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-over');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) {
        readFiles(files).then(function (items) {
          loadTexts(items, { append: state.files.length > 0 && !state.isSample });
        });
      }
    });
    // Keep the browser from opening a dropped file elsewhere on the page.
    ['dragover', 'drop'].forEach(function (type) {
      window.addEventListener(type, function (e) {
        if (!zone.contains(e.target)) e.preventDefault();
      });
    });
    zone.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      pickFiles(false);
    });
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickFiles(false);
      }
    });

    $('paste-btn').addEventListener('click', function () {
      var panel = $('paste-panel');
      showPaste(panel.hidden);
    });
    $('paste-cancel').addEventListener('click', function () {
      showPaste(false);
      $('paste-input').value = '';
    });
    $('paste-parse').addEventListener('click', function () {
      var text = $('paste-input').value;
      if (!text.trim()) { toast('Paste the text of an .ics file first'); $('paste-input').focus(); return; }
      showPaste(false);
      loadTexts([{ name: 'pasted-calendar.ics', text: text }], { append: false });
    });

    $('sample-btn').addEventListener('click', loadSample);
    $('empty-sample').addEventListener('click', loadSample);
    $('clear-all').addEventListener('click', clearAll);

    $('search').addEventListener('input', function (e) {
      state.query = e.target.value;
      renderTable();
    });
    $('filter').addEventListener('change', function (e) {
      state.filter = e.target.value;
      renderTable();
    });
    $('sort').addEventListener('change', function (e) {
      state.sort = e.target.value;
      renderTable();
    });
    $('tz-mode').addEventListener('change', function (e) {
      state.tzMode = e.target.value;
      renderStats();
      renderTable();
    });

    $('export-csv').addEventListener('click', exportCSV);
    $('export-json').addEventListener('click', exportJSON);
    $('copy-tsv').addEventListener('click', copyTSV);

    $('tab-events').addEventListener('click', function () { setTab('events'); });
    $('tab-validation').addEventListener('click', function () { setTab('validation'); });
    document.querySelector('.result-tabs').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = state.tab === 'events' ? 'validation' : 'events';
      setTab(next);
      $(next === 'events' ? 'tab-events' : 'tab-validation').focus();
    });

    $('dialog-close').addEventListener('click', closeDialog);
    $('event-dialog').addEventListener('click', function (e) {
      if (e.target === $('event-dialog')) closeDialog();
    });
    $('event-dialog').addEventListener('close', function () {
      state.selectedId = null;
      Array.prototype.slice.call(document.querySelectorAll('#events-body tr.is-selected'))
        .forEach(function (tr) { tr.classList.remove('is-selected'); });
    });

    $('theme-toggle').addEventListener('click', toggleTheme);
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', updateThemeButton);
    }
  }

  function init() {
    initTheme();
    wire();
    // Start with the sample calendar so the page is useful on first paint.
    loadTexts([{ name: 'sample.ics', text: C.SAMPLE_ICS }], { sample: true, append: false, quiet: true });
    setTab('events');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
