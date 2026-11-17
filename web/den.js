// den: the page. Files on the left, your code in the middle, the console under
// it, and Ember on the right explaining things.
(function () {
  'use strict';
  var C = window.DEN, HL = window.HL, HELP = window.HELP, MAC = window.Editor.MAC;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var MOD = MAC ? '⌘' : 'Ctrl+';
  var STORE = 'den:' + C.where;
  var mem = (function () { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } })();
  function remember() { try { localStorage.setItem(STORE, JSON.stringify(mem)); } catch (e) { /* private window */ } }
  var settings = Object.assign({ theme: 'dark', autosave: 'on', wrap: 'auto', tab: 'auto', size: 14 }, C.settings || {});

  // ── talking to den ──────────────────────────────────────────────────
  var alive = true;
  function get(name, params) {
    var q = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetch('api/' + name + q).then(function (r) { return r.json(); }).catch(function (e) { lost(); throw e; });
  }
  function post(name, body) {
    return fetch('api/' + name, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); }).catch(function (e) { lost(); throw e; });
  }
  function lost() {
    if (!alive) return;
    alive = false;
    var g = document.createElement('div');
    g.className = 'gone';
    g.innerHTML = '<div><canvas width="26" height="17"></canvas><h2 class="fox" style="margin:0">den was closed</h2><p>den runs from a terminal window, and it has stopped. Type <code>den</code> in a terminal (in your project folder) to open it again. Your saved work is safe.</p><button class="btn" type="button">Try again</button></div>';
    document.body.appendChild(g);
    ember.paint(g.querySelector('canvas'), 'blink');
    g.querySelector('button').onclick = function () { location.reload(); };
  }

  // ── Ember ───────────────────────────────────────────────────────────
  var ember = (function () {
    var E = C.ember, mood = null, moodUntil = 0, frame = 'idle';
    function paint(cv, name) {
      var g = E.frames[name] || E.frames.idle, c = cv.getContext('2d');
      c.clearRect(0, 0, 26, 17);
      for (var y = 0; y < g.length; y++) for (var x = 0; x < g[y].length; x++) { var ink = E.ink[g[y][x]]; if (ink) { c.fillStyle = ink; c.fillRect(x, y, 1, 1); } }
    }
    function draw(name) { frame = name; paint($('emberTop'), name); paint($('emberBig'), name); }
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    draw('idle');
    (function tick() {
      var now = Date.now();
      if (mood && now < moodUntil) draw(mood);
      else {
        mood = null;
        var r = Math.random();
        if (!still && r < 0.08) { draw('blink'); setTimeout(function () { if (!mood) draw('idle'); }, 160); }
        else if (!still && r < 0.13) { draw('tail'); setTimeout(function () { if (!mood) draw('idle'); }, 420); }
        else if (frame !== 'idle') draw('idle');
      }
      setTimeout(tick, 900);
    })();
    function feel(name, ms) { mood = name; moodUntil = Date.now() + (ms || 2400); draw(name); }
    function say(text, kind) {
      $('bubble').innerHTML = text;
      $('bubble').className = 'bubble' + (kind ? ' ' + kind : '');
    }
    // the tab icon is Ember too
    try {
      var cv = document.createElement('canvas'); cv.width = 26; cv.height = 17;
      paint(cv, 'idle');
      var big = document.createElement('canvas'); big.width = big.height = 52;
      var bc = big.getContext('2d'); bc.imageSmoothingEnabled = false; bc.drawImage(cv, 0, 0, 26, 17, 0, 9, 52, 34);
      $('icon').href = big.toDataURL();
    } catch (e) { /* no icon */ }
    return { draw: draw, feel: feel, say: say, paint: paint };
  })();

  // ── settings ────────────────────────────────────────────────────────
  function applySettings() {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.style.setProperty('--size', (settings.size || 14) + 'px');
    if (editor) { editor.metrics(); if (active() && active().doc) { editor.setWrap(wrapFor(active())); } }
  }
  function setSetting(k, v) {
    settings[k] = v;
    applySettings();
    post('settings', (function () { var o = {}; o[k] = v; return o; })());
    if (k === 'tab') tabs.forEach(function (t) { if (t.doc) { t.doc.unit = unitFor(t); } });
  }
  $('stTheme').onclick = function () { setSetting('theme', settings.theme === 'light' ? 'dark' : 'light'); };

  // ── layout: drag the edges, hide and show panels ────────────────────
  var main = $('main'), mid = $('mid');
  function layout() {
    var L = mem.layout || {};
    if (L.fw) main.style.setProperty('--fw', L.fw + 'px');
    if (L.hw) main.style.setProperty('--hw', L.hw + 'px');
    if (L.ch) mid.style.setProperty('--ch', L.ch + 'px');
    main.classList.toggle('no-files', !!L.noFiles);
    main.classList.toggle('no-help', !!L.noHelp);
    mid.classList.toggle('no-console', !!L.noConsole);
  }
  function toggle(part) {
    var L = mem.layout = mem.layout || {};
    var narrow = matchMedia('(max-width: 1100px)').matches, tiny = matchMedia('(max-width: 760px)').matches;
    if (part === 'files') { if (tiny) main.classList.toggle('show-files'); else L.noFiles = !L.noFiles; }
    if (part === 'help') { if (narrow) main.classList.toggle('show-help'); else L.noHelp = !L.noHelp; }
    if (part === 'console') L.noConsole = !L.noConsole;
    remember();
    layout();
    setTimeout(function () { if (editor.doc) editor.render(); }, 30);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.split'), function (sp) {
    sp.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      sp.setPointerCapture(e.pointerId);
      sp.classList.add('dragging');
      var which = sp.getAttribute('data-split'), L = mem.layout = mem.layout || {};
      var startX = e.clientX, startY = e.clientY;
      var fw = $('filesBox').offsetWidth, hw = $('helpBox').offsetWidth, ch = $('conBox').offsetHeight;
      function move(ev) {
        if (which === 'files') { L.fw = Math.max(160, Math.min(520, fw + ev.clientX - startX)); }
        if (which === 'helper') { L.hw = Math.max(240, Math.min(640, hw - (ev.clientX - startX))); }
        if (which === 'console') { L.ch = Math.max(90, Math.min(window.innerHeight * 0.7, ch - (ev.clientY - startY))); }
        layout();
      }
      function up() {
        sp.classList.remove('dragging');
        sp.removeEventListener('pointermove', move);
        sp.removeEventListener('pointerup', up);
        remember();
        if (editor.doc) editor.render();
      }
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
  });

  // ── toasts and little pop-ups ───────────────────────────────────────
  var toastTimer = null;
  function toast(html, action, ms) {
    var t = $('toast');
    t.innerHTML = '<span>' + html + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    t.hidden = false;
    if (action) t.querySelector('button').onclick = function () { t.hidden = true; action.run(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || (action ? 7000 : 3200));
  }
  function status(text) { $('stMsg').textContent = text || ''; }

  var modalClose = null;
  function modal(html, opts) {
    opts = opts || {};
    var m = $('modal');
    m.innerHTML = '<div class="dialog' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><h2>' + esc(opts.title || '') + '</h2>' + html + '</div>';
    m.hidden = false;
    var prev = document.activeElement;
    modalClose = function () { m.hidden = true; m.innerHTML = ''; modalClose = null; if (opts.onClose) opts.onClose(); if (prev && prev.focus) prev.focus({ preventScroll: true }); else editor.focus(); };
    m.onmousedown = function (e) { if (e.target === m) modalClose(); };
    return m.querySelector('.dialog');
  }
  function closeModal() { if (modalClose) modalClose(); }

  /** Ask for a name or line number. */
  function ask(title, label, value, done) {
    var d = modal('<form class="q"><span>›</span><input value="' + esc(value || '') + '" aria-label="' + esc(label) + '" placeholder="' + esc(label) + '" autocomplete="off" spellcheck="false"></form>', { title: title });
    var input = d.querySelector('input');
    input.focus();
    if (value) { var dot = value.lastIndexOf('.'), slash = value.lastIndexOf('/') + 1; input.setSelectionRange(slash, dot > slash ? dot : value.length); }
    d.querySelector('form').onsubmit = function (e) { e.preventDefault(); var v = input.value.trim(); closeModal(); if (v) done(v); };
  }
  function confirmBox(title, text, buttons) {
    var d = modal('<div class="in"><p style="margin:0">' + text + '</p><div class="row">' + buttons.map(function (b, i) { return '<button class="btn' + (b.go ? ' go' : '') + '" type="button" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div></div>', { title: title });
    Array.prototype.forEach.call(d.querySelectorAll('button'), function (el) {
      el.onclick = function () { closeModal(); var b = buttons[+el.getAttribute('data-i')]; if (b.run) b.run(); };
    });
    var go = d.querySelector('.go') || d.querySelector('button');
    if (go) go.focus();
  }

  // ── the editor and tabs ─────────────────────────────────────────────
  var tabs = [], current = -1;
  var editor = new window.Editor($('editor'), {
    change: function (doc) { var t = tabOf(doc); if (t) dirtied(t); },
    cursor: function () { cursorMoved(); },
  });
  function active() { return tabs[current] || null; }
  function tabOf(doc) { for (var i = 0; i < tabs.length; i++) if (tabs[i].doc === doc) return tabs[i]; return null; }
  function findTab(path) { for (var i = 0; i < tabs.length; i++) if (tabs[i].path === path) return i; return -1; }
  var name = function (p) { return String(p).split('/').pop(); };
  var extOf = function (p) { var n = name(p).toLowerCase(), i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i + 1); };

  function unitFor(t) {
    if (settings.tab && settings.tab !== 'auto') return +settings.tab;
    // look at how the file is already indented
    var m = (t.text || '').match(/^( +)\S/m);
    if (m && m[1].length <= 8) {
      var counts = {}, re = /^( +)\S/gm, x, n = 0;
      while ((x = re.exec(t.text)) && n++ < 400) { var l = x[1].length; if (l === 2 || l === 4 || l === 8) counts[l] = (counts[l] || 0) + 1; }
      if (counts[2] && (counts[2] >= (counts[4] || 0) / 2)) return 2;
      if (counts[4]) return 4;
    }
    return HL.INDENT[t.lang] || 2;
  }
  function wrapFor(t) {
    if (settings.wrap === 'on') return true;
    if (settings.wrap === 'off') return false;
    return t.lang === 'markdown' || t.lang === 'text';
  }
  function previewable(t) {
    var e = extOf(t.path);
    return t.kind === 'text' && (e === 'html' || e === 'htm' || e === 'md' || e === 'markdown' || e === 'svg' || e === 'csv');
  }

  /** Open a file (or switch to its tab). where: { line, col, len } */
  function open(path, where, quiet) {
    var i = findTab(path);
    if (i >= 0) { activate(i); if (where && tabs[i].doc) editor.go(where.line, where.col, where.len); return Promise.resolve(tabs[i]); }
    return get('read', { path: path }).then(function (r) {
      if (!r.ok) { if (!quiet) toast(esc(r.error)); return null; }
      var f = r.file;
      var t = { path: f.path, kind: f.kind, file: f, lang: HL.langOf(f.path), runnable: r.runnable, dirty: false, base: f.version || null, eol: f.eol, bom: f.bom, text: f.text };
      if (f.kind === 'text') {
        t.saved = f.text;
        t.doc = editor.make(f.text, { lang: t.lang, name: name(f.path), unit: 4, wrap: false });
        t.doc.unit = unitFor(t);
        t.doc.wrap = wrapFor(t);
        t.preview = !!(mem.previews || {})[f.path];
      }
      tabs.push(t);
      activate(tabs.length - 1);
      if (where && t.doc) editor.go(where.line, where.col, where.len);
      rememberTabs();
      recent(f.path);
      return t;
    });
  }

  function activate(i) {
    if (i < 0 || i >= tabs.length) { current = -1; showWelcome(); drawTabs(); return; }
    current = i;
    var t = tabs[i];
    closeFind();
    $('banner').hidden = !t.conflict;
    if (t.conflict) conflictBanner(t);
    if (t.doc) {
      $('editor').hidden = false;
      $('viewer').hidden = true;
      $('viewer').innerHTML = '';
      editor.show(t.doc);
      document.documentElement.style.setProperty('--tab', t.doc.unit);
      setTimeout(function () { editor.focus(); }, 0);
    } else {
      editor.show(null);
      $('editor').hidden = true;
      showViewer(t);
    }
    showPreview(t);
    drawTabs();
    $('edTitle').textContent = t.path;
    drawAside();
    drawRun();
    cursorMoved();
    drawSaved();
    rememberTabs();
    markTree();
    document.title = (t.dirty ? '● ' : '') + name(t.path) + ' · den';
    if (!running && !lastError) ember.say(greeting(t));
  }

  /** What Ember says when you open a file. */
  function greeting(t) {
    var e = extOf(t.path), n = '<b>' + esc(name(t.path)) + '</b>';
    if (t.kind === 'image') return 'A picture: ' + n + '.';
    if (t.kind !== 'text') return n + " isn't something den can edit, but it's here.";
    if (t.doc && !t.doc.ta.value.trim()) return n + ' is empty. Want a starting point? Look below.';
    if (/^html?$/.test(e)) return t.preview ? 'Your page is on the right. It updates as you type, and what it says shows in the console.' : n + ' is a web page. Press <b>Preview</b> to see it.';
    if (e === 'md') return n + ' is notes. <b>Preview</b> shows them formatted.';
    if (t.runnable && !t.runnable.missing) return n + ' is ' + esc(t.runnable.name) + '. Press <b>▶ Run</b> to try it.';
    if (t.runnable && t.runnable.missing) return n + ' is ' + esc(t.runnable.name) + ', which needs a helper program to run.';
    return 'Editing ' + n + '. Click a word and I\'ll explain it if I can.';
  }

  function drawTabs() {
    $('tabs').innerHTML = tabs.map(function (t, i) {
      return '<div class="tab' + (i === current ? ' on' : '') + (t.dirty ? ' dirty' : '') + '" role="tab" aria-selected="' + (i === current) + '" data-i="' + i + '" title="' + esc(t.path) + '"><span>' + esc(name(t.path)) + '</span><span class="x" data-x="' + i + '" title="Close (Alt+W)" role="button" aria-label="Close ' + esc(name(t.path)) + '"></span></div>';
    }).join('');
    var on = $('tabs').querySelector('.tab.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('tabs').addEventListener('mousedown', function (e) {
    var x = e.target.closest('[data-x]'), tab = e.target.closest('.tab');
    if (!tab) return;
    if (x || e.button === 1) { e.preventDefault(); close(+tab.getAttribute('data-i')); return; }
    if (e.button === 0) activate(+tab.getAttribute('data-i'));
  });

  function close(i, then) {
    var t = tabs[i];
    if (!t) return;
    var go = function () {
      tabs.splice(i, 1);
      if (t.doc && editor.doc === t.doc) editor.show(null);
      if (current >= tabs.length) current = tabs.length - 1;
      else if (i < current) current--;
      activate(current);
      rememberTabs();
      if (then) then();
    };
    if (t.dirty) {
      if (settings.autosave === 'on') return save(t).then(function (ok) { if (ok) go(); });
      return confirmBox('Save ' + name(t.path) + '?', 'You changed <b>' + esc(name(t.path)) + '</b> since it was last saved.', [
        { label: 'Save', go: true, run: function () { save(t).then(function (ok) { if (ok) go(); }); } },
        { label: "Don't save", run: go },
        { label: 'Cancel' },
      ]);
    }
    go();
  }

  function rememberTabs() {
    mem.tabs = tabs.map(function (t) { return t.path; });
    mem.active = active() ? active().path : null;
    remember();
  }
  function recent(path) {
    mem.recent = [path].concat((mem.recent || []).filter(function (p) { return p !== path; })).slice(0, 8);
    remember();
  }

  // ── saving ──────────────────────────────────────────────────────────
  var saveTimers = new Map();
  function dirtied(t) {
    var now = t.doc.ta.value !== t.saved;
    if (now !== t.dirty) { t.dirty = now; drawTabs(); document.title = (now ? '● ' : '') + name(t.path) + ' · den'; }
    drawSaved();
    if (settings.autosave === 'on' && t.dirty && !t.conflict) {
      clearTimeout(saveTimers.get(t));
      saveTimers.set(t, setTimeout(function () { save(t); }, 900));
    }
    if (t.preview && !t.previewHtml) { clearTimeout(t.pvTimer); t.pvTimer = setTimeout(function () { refreshPreview(t); }, 350); }
  }
  function save(t, force) {
    t = t || active();
    if (!t || !t.doc) return Promise.resolve(true);
    clearTimeout(saveTimers.get(t));
    var text = t.doc.ta.value;
    if (!t.dirty && !force) return Promise.resolve(true);
    if (t.saving) return t.saving;
    t.saving = post('save', { path: t.path, text: text, base: t.base, eol: t.eol, bom: t.bom, force: !!force }).then(function (r) {
      t.saving = null;
      if (!r.ok) {
        if (r.code === 'changed') { t.conflict = true; if (t === active()) conflictBanner(t); return false; }
        toast('Not saved: ' + esc(r.error));
        return false;
      }
      t.base = r.version;
      t.saved = text;
      t.conflict = false;
      if (t === active()) $('banner').hidden = true;
      dirtied(t);
      drawSaved();
      refreshPreview(t);
      if (t.doc.ta.value !== text && settings.autosave === 'on') dirtied(t); // typed more while saving
      return true;
    });
    return t.saving;
  }
  function saveAll() { return Promise.all(tabs.filter(function (t) { return t.dirty; }).map(function (t) { return save(t); })); }
  function drawSaved() {
    var t = active(), el = $('stSaved');
    if (!t || !t.doc) { el.textContent = ''; return; }
    el.className = t.dirty ? 'unsaved' : 'saved';
    el.textContent = t.dirty ? (settings.autosave === 'on' ? '● saving…' : '● not saved (' + MOD + 'S)') : '✓ saved';
  }
  function conflictBanner(t) {
    var b = $('banner');
    b.hidden = false;
    b.innerHTML = '<p><b>' + esc(name(t.path)) + '</b> was changed outside den (by another app, or a program you ran) while you were editing it.</p>' +
      '<button class="btn" type="button" id="cfMine">Keep mine</button><button class="btn" type="button" id="cfTheirs">Load the new one</button>';
    $('cfMine').onclick = function () { save(t, true); };
    $('cfTheirs').onclick = function () { reload(t, true); };
  }
  function reload(t, discard) {
    return get('read', { path: t.path }).then(function (r) {
      if (!r.ok) return;
      var f = r.file;
      if (f.version && f.version === t.base && !discard) return;
      if (!t.doc || f.kind !== 'text') { t.file = f; if (t === active()) showViewer(t); return; }
      if (t.dirty && !discard) { t.conflict = true; if (t === active()) conflictBanner(t); return; }
      var ta = t.doc.ta, s = ta.selectionStart, top = ta.scrollTop;
      ta.value = f.text;
      t.saved = f.text; t.text = f.text; t.base = f.version; t.dirty = false; t.conflict = false;
      ta.setSelectionRange(Math.min(s, f.text.length), Math.min(s, f.text.length));
      ta.scrollTop = top;
      if (t === active()) { $('banner').hidden = true; editor.render(true); }
      drawTabs(); drawSaved(); refreshPreview(t);
      if (!discard) status(name(t.path) + ' changed on disk, so den loaded the new version.');
    });
  }
  window.addEventListener('beforeunload', function (e) {
    var dirty = tabs.filter(function (t) { return t.dirty; });
    if (!dirty.length) return;
    if (settings.autosave === 'on') {
      dirty.forEach(function (t) {
        try { fetch('api/save', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: t.path, text: t.doc.ta.value, base: t.base, eol: t.eol, bom: t.bom }) }); } catch (x) { /* too big */ }
      });
      return;
    }
    e.preventDefault();
    e.returnValue = '';
  });

  // ── the status line and "What's this?" ──────────────────────────────
  var whatTimer = null;
  function cursorMoved() {
    var t = active();
    if (!t || !t.doc) { $('stPos').textContent = ''; $('stLang').textContent = t ? kindName(t) : ''; $('stIndent').textContent = ''; drawWhat(); return; }
    var p = editor.pos();
    $('stLang').textContent = HL.NAMES[t.lang] || 'Plain text';
    $('stPos').textContent = 'line ' + p.line + ', column ' + p.col + (p.sel ? ' (' + p.sel + ' selected)' : '');
    $('stIndent').textContent = t.doc.unit + ' spaces';
    clearTimeout(whatTimer);
    whatTimer = setTimeout(drawWhat, 120);
  }
  function kindName(t) {
    return { image: 'Picture', pdf: 'PDF', audio: 'Sound', video: 'Video', binary: 'Not text', big: 'Big file' }[t.kind] || '';
  }

  var lastError = null; // { output, info, path }
  function drawWhat() {
    var t = active(), cards = [];
    if (lastError && lastError.info) {
      var e = lastError.info;
      cards.push('<div class="card bad"><h4>' + esc(e.title) + '</h4><p>' + e.html + '</p>' +
        (e.where ? '<p class="dim">It happened on line ' + e.where.line + (e.where.path ? ' of ' + esc(name(e.where.path)) : '') + '.</p>' : '') +
        '<div class="row">' + (e.where ? '<button class="btn" type="button" data-act="goerr">Show me the line</button>' : '') +
        (e.fix && e.fix.command ? '<button class="btn go" type="button" data-act="fix">Install it</button>' : '') +
        '<button class="btn" type="button" data-act="whyerr">Ask Ember why</button></div>' +
        (e.fix && e.fix.command ? '<pre>' + esc(e.fix.command) + '</pre>' : '') + '</div>');
    } else if (lastError) {
      cards.push('<div class="card bad"><h4>It stopped with an error</h4><p>Read the last lines in the console: they usually say what went wrong, and which line.</p><div class="row"><button class="btn" type="button" data-act="whyerr">Ask Ember why</button></div></div>');
    }
    if (t && t.doc) {
      var word = editor.word(), g = (HELP.GLOSSARY[t.lang] || {})[word] || (t.lang === 'html' && extOf(t.path) !== 'svg' ? HELP.GLOSSARY.css[word] : null);
      if (g) cards.push('<div class="card"><h4>' + esc(word) + '</h4><p>' + esc(g[0]) + '</p><pre>' + esc(g[1]) + '</pre></div>');
      if (!t.doc.ta.value.trim() && HELP.STARTERS[t.lang]) {
        cards.push('<div class="card"><h4>An empty file</h4><p>Want a starting point? Ember can fill in a small ' + esc(HL.NAMES[t.lang]) + ' example you can change.</p><div class="row"><button class="btn go" type="button" data-act="starter">Start me off</button></div></div>');
      }
      cards.push(tipsFor(t));
    } else if (t) {
      cards.push('<div class="card"><h4>' + esc(name(t.path)) + '</h4><p>' + ({ image: 'A picture. den shows it; to change it you need a drawing app.', pdf: 'A PDF document.', audio: 'A sound file.', video: 'A video file.', binary: "This file isn't text, so den can't show what's inside. It's probably made by another app.", big: 'This file is too big to edit comfortably in den.' }[t.kind] || '') + '</p></div>');
    } else {
      cards.push('<div class="card"><h4>Hi! I\'m Ember.</h4><p>Click any file on the left to open it. As you type, I\'ll explain the words under your cursor here.</p><p>Stuck? The <b>Ask</b> tab lets you ask me anything about your code.</p></div>');
    }
    $('whatPane').innerHTML = cards.join('');
  }
  function tipsFor(t) {
    var e = extOf(t.path), tips = [];
    var run = t.runnable && !t.runnable.missing;
    if (e === 'html' || e === 'htm') tips.push(t.preview ? '<code>console.log()</code> in your page\'s JavaScript shows in den\'s console, and so do its errors.' : 'Press <b>Preview</b> (top right of the editor) to see your page. It updates as you type.', 'Type <code>!</code> and press <kbd>Tab</kbd> on an empty line for a whole page to start from.');
    else if (e === 'md') tips.push('Press <b>Preview</b> to see how this looks formatted.');
    else if (run) tips.push('Press <b>▶ Run</b> or <kbd>' + MOD + 'Enter</kbd> to run this file. What it prints shows in the console.');
    if (t.lang === 'python') tips.push('Python cares about the spaces at the start of lines. <kbd>Tab</kbd> pushes lines in, <kbd>Shift+Tab</kbd> pulls them out.');
    if (t.lang === 'javascript' && /html?$/.test(e) === false) tips.push('<code>console.log(x)</code> prints <code>x</code> in the console: the quickest way to see what your code is doing.');
    tips.push('<kbd>' + MOD + '/</kbd> turns lines into comments (notes the computer skips), and back.', 'Put your cursor on a word to see what it means here.');
    return '<div class="card"><h4>Tips</h4><ul class="tips">' + tips.slice(0, 4).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
  }
  $('whatPane').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), t = active();
    if (act === 'starter' && t && t.doc) { editor.put(0, t.doc.ta.value.length, HELP.STARTERS[t.lang], 0); toast('Here you go. Change anything you like.'); }
    if (act === 'goerr' && lastError && lastError.info.where) goTo(lastError.info.where);
    if (act === 'fix' && lastError && lastError.info.fix) runCommand(lastError.info.fix.command);
    if (act === 'whyerr') { showAskTab(); askEmber('Why did my program stop with this error, and how do I fix it?', { error: true }); }
  });
  function goTo(w) {
    var p = w.path || '';
    var t = active();
    var rel = p;
    // the error names a full path: find the open file it means
    if (/^(\/|[A-Za-z]:)/.test(p)) {
      var root = C.where.replace(/^~/, '');
      var i = p.replace(/\\/g, '/').indexOf(root.replace(/\\/g, '/'));
      rel = i >= 0 ? p.replace(/\\/g, '/').slice(i + root.length).replace(/^\/+/, '') : name(p);
    }
    if (!rel && t) rel = t.path;
    var match = tabs.filter(function (x) { return x.path === rel || name(x.path) === name(rel); })[0];
    open(match ? match.path : rel, { line: w.line, col: w.col || 1 });
  }

  // ── pictures, PDFs and other things den shows ───────────────────────
  var raw = function (p) { return 'raw/' + p.split('/').map(encodeURIComponent).join('/'); };
  function showViewer(t) {
    var v = $('viewer'), f = t.file;
    v.hidden = false;
    v.className = 'viewer center';
    var size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : f.size > 1024 ? Math.round(f.size / 1024) + ' KB' : f.size + ' bytes';
    if (t.kind === 'image') v.innerHTML = '<img class="pic" alt="' + esc(f.name) + '" src="' + raw(f.path) + '?v=' + f.mtime + '"><p class="dim">' + esc(f.name) + ' · ' + size + ' · <span id="picSize"></span></p>';
    else if (t.kind === 'pdf') { v.className = 'viewer full'; v.innerHTML = '<iframe class="pdf" title="' + esc(f.name) + '" src="' + raw(f.path) + '"></iframe>'; }
    else if (t.kind === 'audio') v.innerHTML = '<audio controls src="' + raw(f.path) + '"></audio><p class="dim">' + esc(f.name) + ' · ' + size + '</p>';
    else if (t.kind === 'video') v.innerHTML = '<video controls style="max-width:100%;max-height:65vh" src="' + raw(f.path) + '"></video><p class="dim">' + esc(f.name) + ' · ' + size + '</p>';
    else v.innerHTML = '<p>' + (t.kind === 'big' ? '<b>' + esc(f.name) + '</b> is ' + size + ', too big to edit comfortably here.' : '<b>' + esc(f.name) + "</b> isn't text, so den can't show what's inside (" + size + ').') + '</p><div><button class="btn" type="button" id="revealBtn">Show it in ' + (C.platform === 'darwin' ? 'Finder' : C.platform === 'win32' ? 'File Explorer' : 'your files') + '</button></div>';
    var img = v.querySelector('img.pic');
    if (img) img.onload = function () { var s = $('picSize'); if (s) s.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' pixels'; };
    var rb = $('revealBtn');
    if (rb) rb.onclick = function () { post('reveal', { path: f.path }); };
  }
  function showWelcome() {
    editor.show(null);
    $('editor').hidden = true;
    $('preview').hidden = true; $('pvsplit').hidden = true; $('panes').classList.remove('with-preview');
    var v = $('viewer');
    v.hidden = false; v.className = 'viewer';
    var rec = (mem.recent || []).slice(0, 5);
    v.innerHTML = '<div class="welcome"><div class="hello"><canvas id="emberHello" width="26" height="17"></canvas><div><h3>Welcome to your den</h3><p>This is <b>' + esc(C.name) + '</b>. Pick a file on the left, or start a new one.</p></div></div>' +
      '<div class="acts"><button class="btn go" type="button" id="wNew">New file <kbd>Alt+N</kbd></button><button class="btn" type="button" id="wFind">Find a file <kbd>' + MOD + 'P</kbd></button><button class="btn" type="button" id="wSearch">Search everything <kbd>' + MOD + '⇧F</kbd></button></div>' +
      (rec.length ? '<div class="recent"><p class="dim" style="margin-bottom:.3em">Open again:</p>' + rec.map(function (p) { return '<div><button type="button" data-p="' + esc(p) + '">' + esc(p) + '</button></div>'; }).join('') + '</div>' : '') +
      '<ul><li>Name a file <code>something.py</code> for Python, <code>index.html</code> for a web page, <code>notes.md</code> for notes.</li><li>Press <b>▶ Run</b> to run your code. What it prints shows in the console below.</li><li>den saves as you type, and keeps earlier versions (☰ → Earlier versions).</li><li>Deleting moves things to den\'s bin, so you can always get them back.</li></ul></div>';
    ember.paint($('emberHello'), 'happy');
    $('wNew').onclick = function () { newFile(false); };
    $('wFind').onclick = quickOpen;
    $('wSearch').onclick = searchAll;
    Array.prototype.forEach.call(v.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { open(b.getAttribute('data-p')); }; });
    $('edTitle').textContent = 'Welcome';
    $('edAside').innerHTML = '';
    document.title = C.name + ' · den';
    drawRun(); cursorMoved(); drawSaved();
  }

  // ── previews: web pages, Markdown, SVG pictures, CSV tables ─────────
  function showPreview(t) {
    var on = !!(t && t.preview && previewable(t));
    var pv = $('preview');
    $('panes').classList.toggle('with-preview', on);
    pv.hidden = !on; $('pvsplit').hidden = !on;
    t && (t.previewHtml = on && /^html?$/.test(extOf(t.path)));
    if (!on) { pv.innerHTML = ''; return; }
    refreshPreview(t, true);
    setTimeout(function () { if (editor.doc) editor.render(); }, 20);
  }
  function refreshPreview(t, fresh) {
    if (!t || !t.preview || t !== active() || !previewable(t)) return;
    var pv = $('preview'), e = extOf(t.path);
    if (/^html?$/.test(e)) {
      // the page comes from den's separate preview address, so it can't touch den itself
      if (t.dirty) return; // it refreshes once the file is saved (den saves as you type)
      var src = C.preview + t.path.split('/').map(encodeURIComponent).join('/') + '?v=' + Date.now();
      var f = pv.querySelector('iframe');
      if (!f || fresh) { pv.innerHTML = '<iframe title="Preview of ' + esc(name(t.path)) + '" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>'; f = pv.querySelector('iframe'); }
      f.src = src;
    } else if (e === 'svg') {
      pv.innerHTML = '<div class="md" style="display:grid;place-items:center"><img alt="" style="max-width:100%;max-height:100%" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t.doc.ta.value) + '"></div>';
    } else if (e === 'csv') {
      pv.innerHTML = '<div class="md">' + csvTable(t.doc.ta.value) + '</div>';
    } else {
      var top = pv.firstChild ? pv.firstChild.scrollTop : 0;
      pv.innerHTML = '<div class="md">' + markdown(t.doc.ta.value, t.path) + '</div>';
      pv.firstChild.scrollTop = top;
    }
  }
  function togglePreview() {
    var t = active();
    if (!t || !previewable(t)) return;
    t.preview = !t.preview;
    mem.previews = mem.previews || {};
    if (t.preview) mem.previews[t.path] = 1; else delete mem.previews[t.path];
    remember();
    showPreview(t);
    drawAside();
  }
  function safeUrl(u, base) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
    if (/^[a-z][\w+.-]*:/i.test(u)) return '#';
    var dir = base.split('/').slice(0, -1).join('/');
    return raw((dir ? dir + '/' : '') + u.replace(/^\.\//, ''));
  }
  function inline(s, base) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, function (m, alt, u) { return '<img alt="' + alt + '" src="' + esc(safeUrl(u.replace(/&amp;/g, '&'), base)) + '">'; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (m, txt, u) { return '<a href="' + esc(safeUrl(u.replace(/&amp;/g, '&'), base)) + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>'; })
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '<b>$1$2</b>')
      .replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  }
  /** Markdown to HTML, with everything escaped first (a Markdown file can't run scripts in den). */
  function markdown(text, base) {
    var lines = text.split('\n'), out = [], i = 0, para = [];
    var flush = function () { if (para.length) { out.push('<p>' + inline(para.join(' '), base) + '</p>'); para = []; } };
    while (i < lines.length) {
      var l = lines[i], m;
      if ((m = l.match(/^\s*(```|~~~)/))) {
        flush();
        var code = []; i++;
        while (i < lines.length && !/^\s*(```|~~~)/.test(lines[i])) code.push(lines[i++]);
        out.push('<pre>' + esc(code.join('\n')) + '</pre>'); i++; continue;
      }
      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push('<h' + m[1].length + '>' + inline(m[2], base) + '</h' + m[1].length + '>'); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) { flush(); var q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); out.push('<blockquote>' + inline(q.join(' '), base) + '</blockquote>'); continue; }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        flush();
        var ordered = /^\s*\d/.test(l), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '').replace(/^\[([ xX])\]\s*/, function (x, c) { return c === ' ' ? '☐ ' : '☑ '; }));
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.map(function (x) { return '<li>' + inline(x, base) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        flush();
        var row = function (s) { return s.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var head = row(l); i += 2;
        var body = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
        out.push('<table><tr>' + head.map(function (h) { return '<th>' + inline(h, base) + '</th>'; }).join('') + '</tr>' + body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c, base) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>');
        continue;
      }
      if (!l.trim()) { flush(); i++; continue; }
      para.push(l.trim()); i++;
    }
    flush();
    return out.join('\n');
  }
  function csvTable(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length && rows.length < 2000; i++) {
      var c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === ',' || c === ';' && false) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return '<p class="dim">Nothing here yet.</p>';
    return '<table class="csv"><tr>' + rows[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>' + rows.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }

  function drawAside() {
    var t = active(), a = $('edAside'), html = '';
    if (t && previewable(t)) html += '<button class="icon" type="button" id="pvBtn" aria-pressed="' + !!t.preview + '" title="' + MOD + '⇧V">' + (extOf(t.path) === 'csv' ? 'table' : 'preview') + '</button>';
    if (t && t.doc) html += '<button class="icon" type="button" id="histBtn" title="Earlier versions of this file">versions</button><button class="icon" type="button" id="findBtn" title="Find in this file (' + MOD + 'F)">find</button>';
    a.innerHTML = html;
    if ($('pvBtn')) $('pvBtn').onclick = togglePreview;
    if ($('histBtn')) $('histBtn').onclick = history;
    if ($('findBtn')) $('findBtn').onclick = openFind;
  }

  // ── running ─────────────────────────────────────────────────────────
  var running = null;
  function drawRun() {
    var t = active(), b = $('runBtn');
    if (running) { b.disabled = false; b.className = 'btn stop'; b.textContent = '■ Stop'; return; }
    b.className = 'btn go';
    if (t && previewable(t) && /^(html?|md|markdown|svg)$/.test(extOf(t.path))) { b.disabled = false; b.textContent = t.preview ? '▶ Hide preview' : '▶ Preview'; return; }
    if (t && t.runnable) { b.disabled = false; b.textContent = '▶ Run ' + name(t.path); return; }
    b.disabled = true;
    b.textContent = '▶ Run';
  }
  function run() {
    if (running) return post('stop');
    var t = active();
    if (!t) return;
    if (previewable(t) && /^(html?|md|markdown|svg)$/.test(extOf(t.path))) { togglePreview(); drawRun(); return; }
    if (!t.runnable) { toast("den doesn't know how to run this kind of file."); return; }
    if (t.runnable.missing) {
      lastError = { info: { title: (t.runnable.name || 'That language') + ' is not installed', html: esc(t.runnable.missing).replace(/(https:\/\/\S+)/, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>') } };
      showWhatTab(); drawWhat(); ember.feel('oops', 3500); ember.say('I need a helper program to run this. See below!');
      return;
    }
    saveAll().then(function () {
      if (mid.classList.contains('no-console')) toggle('console');
      post('run', { path: t.path }).then(function (r) { if (!r.ok) { conLine(esc(r.error) + '\n', 'e'); } });
    });
  }
  function runCommand(line) {
    if (running) { toast('Something is still running. Stop it first.'); return; }
    if (mid.classList.contains('no-console')) toggle('console');
    post('run', { command: line }).then(function (r) { if (!r.ok) conLine(esc(r.error) + '\n', 'e'); });
  }
  $('runBtn').onclick = run;
  $('stopBtn').onclick = function () { post('stop'); };
  $('clearBtn').onclick = function () { $('out').innerHTML = ''; };

  var out = $('out'), outBuf = '';
  function conLine(html, cls) {
    var stick = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
    var s = document.createElement('span');
    if (cls) s.className = cls;
    s.innerHTML = html;
    out.appendChild(s);
    while (out.childNodes.length > 4000) out.removeChild(out.firstChild);
    if (stick) out.scrollTop = out.scrollHeight;
  }
  /** Make "File "x.py", line 3" and "app.js:3:5" clickable. */
  function linkify(text) {
    return esc(text)
      .replace(/File &quot;([^&]+?)&quot;, line (\d+)/g, function (m, p, l) { return '<a class="loc" data-p="' + p + '" data-l="' + l + '">' + m + '</a>'; })
      .replace(/((?:[A-Za-z]:)?[\w./\\-]+\.(?:js|mjs|cjs|ts|rb|go|java|php|lua|c|cpp|rs|swift)):(\d+)(?::(\d+))?/g, function (m, p, l, c) { return '<a class="loc" data-p="' + p + '" data-l="' + l + '" data-c="' + (c || 1) + '">' + m + '</a>'; });
  }
  out.addEventListener('click', function (e) {
    var a = e.target.closest('a.loc');
    if (a) goTo({ path: a.getAttribute('data-p'), line: +a.getAttribute('data-l'), col: +(a.getAttribute('data-c') || 1) });
  });
  function onRun(ev) {
    if (ev.t === 'start') {
      running = ev;
      outBuf = '';
      lastError = null;
      conLine((out.childNodes.length ? '\n' : '') + (ev.file ? '▶ running ' : '› ') + esc(ev.label) + '\n', 'cmdline');
      $('stopBtn').hidden = false;
      $('cmdForm').classList.add('waiting');
      $('cmd').placeholder = 'type here to answer the program, then press Enter';
      ember.say(ev.file ? 'Running <b>' + esc(ev.label) + '</b>…' : 'Running your command…');
      drawRun(); drawWhat();
    } else if (ev.t === 'out') {
      if (outBuf.length < 200000) outBuf += ev.text;
      conLine(linkify(ev.text), ev.err ? 'e' : '');
    } else if (ev.t === 'end') {
      running = null;
      $('stopBtn').hidden = true;
      $('cmdForm').classList.remove('waiting');
      $('cmd').placeholder = 'type a command, like: python3 --version';
      var secs = ev.ms < 1000 ? ev.ms + ' ms' : (ev.ms / 1000).toFixed(1) + ' s';
      if (ev.code === 0) {
        conLine('✓ finished in ' + secs + '\n', 'end good');
        ember.feel('happy', 2600);
        ember.say(['That worked!', 'Nice one!', 'All done, no errors.', 'It ran. Good work!'][Math.floor(Math.random() * 4)], 'ok');
      } else if (ev.stopped) {
        conLine('■ stopped\n', 'end');
        ember.say('Stopped.');
      } else {
        conLine((ev.error ? esc(ev.error) + '\n' : '') + '✗ it stopped with an error' + (ev.code != null ? ' (exit code ' + ev.code + ')' : '') + (ev.stage === 'compile' ? ' while getting the program ready' : '') + '\n', 'end bad');
        lastError = { output: outBuf, info: HELP.explain(outBuf, C.platform) };
        ember.feel('oops', 4000);
        ember.say(lastError.info ? '<b>' + esc(lastError.info.title) + '.</b> I wrote what it means below.' : 'Something went wrong. The last lines in the console usually say what.', 'bad');
        showWhatTab();
      }
      drawRun(); drawWhat();
    }
  }
  // what a previewed web page says (console.log, errors) shows here too
  var pageSaid = 0;
  window.addEventListener('message', function (e) {
    var f = $('preview').querySelector('iframe');
    if (!f || e.source !== f.contentWindow || !e.data || e.data.den !== 1) return;
    if (++pageSaid > 500) return;
    var bad = e.data.k === 'error';
    if (mid.classList.contains('no-console') && bad) toggle('console');
    conLine('<span class="sys">page › </span>' + linkify(String(e.data.t).slice(0, 4000)) + '\n', bad ? 'e' : e.data.k === 'warn' ? 'warn' : '');
    if (bad) {
      var info = HELP.explain(String(e.data.t), C.platform);
      lastError = { output: String(e.data.t), info: info || { title: 'Your page has an error', html: 'The message is in the console. It says which file and line (click it to jump there).' } };
      ember.feel('oops', 3000);
      ember.say('Your page hit an error. I explained it below.', 'bad');
      showWhatTab(); drawWhat();
    }
  });
  setInterval(function () { pageSaid = 0; }, 5000);

  var cmdHist = mem.cmds || [], cmdAt = -1;
  $('cmdForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('cmd').value;
    if (running) { post('input', { text: v }); conLine(esc(v) + '\n', 'sys'); $('cmd').value = ''; return; }
    if (!v.trim()) return;
    $('cmd').value = '';
    cmdHist = [v].concat(cmdHist.filter(function (x) { return x !== v; })).slice(0, 50);
    mem.cmds = cmdHist; remember(); cmdAt = -1;
    runCommand(v);
  });
  $('cmd').addEventListener('keydown', function (e) {
    if (running) return;
    if (e.key === 'ArrowUp' && cmdHist.length) { e.preventDefault(); cmdAt = Math.min(cmdHist.length - 1, cmdAt + 1); $('cmd').value = cmdHist[cmdAt]; }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdAt = Math.max(-1, cmdAt - 1); $('cmd').value = cmdAt < 0 ? '' : cmdHist[cmdAt]; }
  });
  $('cmd').placeholder = 'type a command, like: ' + (C.platform === 'win32' ? 'py --version' : 'python3 --version');

  // ── the file tree ───────────────────────────────────────────────────
  var kids = {}, open_ = new Set(mem.open || []), sel = null;
  var ICON = { py: '🐍', js: '◆', ts: '◆', html: '◇', css: '#', md: '¶', json: '{}', png: '▣', jpg: '▣', jpeg: '▣', gif: '▣', svg: '▣', webp: '▣', txt: '≡', csv: '▦' };
  function load(dir) {
    return get('list', { path: dir }).then(function (r) { kids[dir] = r.ok ? r.items : []; return kids[dir]; });
  }
  function drawTree() {
    var html = '';
    var walk = function (dir, depth) {
      (kids[dir] || []).forEach(function (it) {
        var isOpen = it.dir && open_.has(it.path);
        var t = active();
        var on = t && t.path === it.path;
        var cls = 'node' + (it.dir ? ' dir' : '') + (on ? ' on' : '') + (sel === it.path ? ' focus' : '') + (it.name[0] === '.' ? ' dot' : '') + (it.heavy ? ' heavy' : '');
        var badge = tabs.some(function (x) { return x.path === it.path && x.dirty; }) ? '<span class="badge">●</span>' : '';
        html += '<div class="' + cls + '" role="treeitem" aria-expanded="' + (it.dir ? isOpen : '') + '" data-p="' + esc(it.path) + '" data-d="' + (it.dir ? 1 : 0) + '" style="--d:' + depth + '" draggable="false">' +
          '<span class="tw">' + (it.dir ? (isOpen ? '▾' : '▸') : '') + '</span><span class="ic">' + (it.dir ? (isOpen ? '📂' : '📁') : (ICON[extOf(it.name)] || '·')) + '</span><span class="nm">' + esc(it.name) + '</span>' + badge + '</div>';
        if (isOpen) {
          if (kids[it.path]) walk(it.path, depth + 1);
          else html += '<div class="hint" style="padding-left:' + (2 + depth * 1.6) + 'ch">…</div>';
        }
      });
    };
    walk('', 0);
    if (!(kids[''] || []).length) html = '<div class="hint">This folder is empty. Make your first file with <b>+ file</b> above.</div>';
    $('tree').innerHTML = html;
  }
  function markTree() { drawTree(); }
  function refreshTree() {
    var dirs = [''].concat(Array.from(open_));
    return Promise.all(dirs.map(function (d) { return load(d).catch(function () { open_.delete(d); }); })).then(drawTree);
  }
  function toggleDir(p, force) {
    var willOpen = force === undefined ? !open_.has(p) : force;
    if (willOpen) open_.add(p); else open_.delete(p);
    mem.open = Array.from(open_); remember();
    if (willOpen && !kids[p]) load(p).then(drawTree);
    drawTree();
  }
  $('tree').addEventListener('click', function (e) {
    var n = e.target.closest('.node');
    if (!n) return;
    var p = n.getAttribute('data-p');
    sel = p;
    if (n.getAttribute('data-d') === '1') toggleDir(p);
    else open(p);
    if (matchMedia('(max-width: 760px)').matches) main.classList.remove('show-files');
  });
  $('tree').addEventListener('contextmenu', function (e) {
    var n = e.target.closest('.node');
    e.preventDefault();
    var p = n ? n.getAttribute('data-p') : '', isDir = n ? n.getAttribute('data-d') === '1' : true;
    sel = p || null; drawTree();
    var where = isDir ? p : p.split('/').slice(0, -1).join('/');
    menu(e.clientX, e.clientY, [
      { label: 'New file here', run: function () { newFile(false, where); } },
      { label: 'New folder here', run: function () { newFile(true, where); } },
      n && { sep: true },
      n && { label: 'Rename', k: 'F2', run: function () { rename(p); } },
      n && { label: 'Move to den\'s bin', k: 'Del', run: function () { trash(p); } },
      { sep: true },
      { label: 'Copy the path', run: function () { copy(p || '.'); } },
      { label: 'Show in ' + (C.platform === 'darwin' ? 'Finder' : C.platform === 'win32' ? 'File Explorer' : 'your files'), run: function () { post('reveal', { path: p }); } },
      n && !isDir && HL.langOf(p) !== 'text' && { label: 'Run it', run: function () { open(p).then(function () { run(); }); } },
    ].filter(Boolean));
  });
  $('tree').addEventListener('keydown', function (e) {
    var nodes = Array.prototype.slice.call($('tree').querySelectorAll('.node'));
    if (!nodes.length) return;
    var i = nodes.findIndex(function (n) { return n.getAttribute('data-p') === sel; });
    var cur = nodes[i];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(0, Math.min(nodes.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); sel = nodes[i].getAttribute('data-p'); drawTree(); var f = $('tree').querySelector('.focus'); if (f) f.scrollIntoView({ block: 'nearest' }); }
    else if (cur && e.key === 'ArrowRight' && cur.getAttribute('data-d') === '1') toggleDir(sel, true);
    else if (cur && e.key === 'ArrowLeft') { if (cur.getAttribute('data-d') === '1' && open_.has(sel)) toggleDir(sel, false); else { var up = sel.split('/').slice(0, -1).join('/'); if (up) { sel = up; drawTree(); } } }
    else if (cur && e.key === 'Enter') { if (cur.getAttribute('data-d') === '1') toggleDir(sel); else open(sel); }
    else if (cur && e.key === 'F2') rename(sel);
    else if (cur && (e.key === 'Delete' || (MAC && e.metaKey && e.key === 'Backspace'))) trash(sel);
  });

  function newFile(dir, where) {
    if (where === undefined) {
      var t = active();
      where = sel ? (kids[sel] !== undefined || open_.has(sel) ? sel : sel.split('/').slice(0, -1).join('/')) : t ? t.path.split('/').slice(0, -1).join('/') : '';
    }
    var prefix = where ? where + '/' : '';
    ask(dir ? 'New folder' : 'New file', dir ? 'folder name' : 'file name, like main.py or index.html', prefix, function (v) {
      post('create', { path: v, dir: dir }).then(function (r) {
        if (!r.ok) { toast(esc(r.error)); return; }
        var parts = r.path.split('/');
        for (var i = 1; i < parts.length; i++) open_.add(parts.slice(0, i).join('/'));
        if (dir) open_.add(r.path);
        mem.open = Array.from(open_); remember();
        refreshTree().then(function () { sel = r.path; drawTree(); if (!dir) open(r.path); });
        files = null;
      });
    });
  }
  function rename(p) {
    ask('Rename', 'new name', p, function (v) {
      if (v === p) return;
      post('rename', { from: p, to: v }).then(function (r) {
        if (!r.ok) { toast(esc(r.error)); return; }
        tabs.forEach(function (t) {
          if (t.path === r.from || t.path.indexOf(r.from + '/') === 0) { t.path = r.to + t.path.slice(r.from.length); t.lang = HL.langOf(t.path); if (t.doc) { t.doc.lang = t.lang; t.doc._text = null; } }
        });
        sel = r.to; files = null;
        if (active()) activate(current);
        refreshTree();
      });
    });
  }
  function trash(p) {
    post('trash', { path: p }).then(function (r) {
      if (!r.ok) { toast(esc(r.error)); return; }
      var gone = tabs.map(function (t, i) { return t.path === p || t.path.indexOf(p + '/') === 0 ? i : -1; }).filter(function (i) { return i >= 0; }).reverse();
      gone.forEach(function (i) { tabs[i].dirty = false; close(i); });
      files = null;
      refreshTree();
      toast('Moved <b>' + esc(name(p)) + "</b> to den's bin.", { label: 'Undo', run: function () { post('restore', { id: r.id }).then(function () { refreshTree(); }); } });
    });
  }
  function copy(text) {
    try { navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }); } catch (e) { toast('Your browser wouldn\'t let den copy that.'); }
  }
  $('newFileBtn').onclick = function () { newFile(false); };
  $('newDirBtn').onclick = function () { newFile(true); };
  $('binBtn').onclick = bin;

  function menu(x, y, items) {
    var old = document.querySelector('.menu');
    if (old) old.remove();
    var m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it, i) { return it.sep ? '<hr>' : '<button type="button" role="menuitem" data-i="' + i + '"><span>' + esc(it.label) + '</span>' + (it.k ? '<span class="k">' + esc(it.k) + '</span>' : '') + '</button>'; }).join('');
    document.body.appendChild(m);
    m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 8) + 'px';
    m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 8) + 'px';
    var first = m.querySelector('button'); if (first) first.focus();
    var done = function () { m.remove(); document.removeEventListener('mousedown', outside, true); };
    var outside = function (e) { if (!m.contains(e.target)) done(); };
    setTimeout(function () { document.addEventListener('mousedown', outside, true); }, 0);
    m.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; done(); items[+b.getAttribute('data-i')].run(); });
    m.addEventListener('keydown', function (e) {
      var bs = Array.prototype.slice.call(m.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); done(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); }
    });
  }

  // ── find in this file ───────────────────────────────────────────────
  var findCase = false;
  function openFind() {
    var t = active();
    if (!t || !t.doc) return;
    $('findbar').hidden = false;
    var s = editor.selection();
    if (s && s.indexOf('\n') < 0) $('findQ').value = s;
    $('findQ').focus(); $('findQ').select();
    doFind();
  }
  function closeFind() { $('findbar').hidden = true; if (editor.doc) { editor.search('', {}); } }
  function doFind(keep) {
    var r = editor.search($('findQ').value, { caseSensitive: findCase, keep: keep });
    $('findN').textContent = !$('findQ').value ? '' : r.n ? (r.i + 1) + ' of ' + r.n : 'no matches';
    if (r.n && !keep) editor.findStep(0);
  }
  function findStep(d) { var r = editor.findStep(d); $('findN').textContent = r.n ? (r.i + 1) + ' of ' + r.n : 'no matches'; }
  $('findQ').addEventListener('input', function () { doFind(); });
  $('findQ').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); $('findQ').focus(); }
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); editor.focus(); }
  });
  $('findR').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('findOne').click(); } if (e.key === 'Escape') { closeFind(); editor.focus(); } });
  $('findNext').onclick = function () { findStep(1); };
  $('findPrev').onclick = function () { findStep(-1); };
  $('findCase').onclick = function () { findCase = !findCase; $('findCase').setAttribute('aria-pressed', findCase); doFind(); };
  $('findOne').onclick = function () { editor.replaceOne($('findR').value); doFind(true); findStep(0); $('findR').focus(); };
  $('findAll').onclick = function () { var n = editor.replaceAll($('findQ').value, $('findR').value, { caseSensitive: findCase }); toast(n ? 'Replaced ' + n + '. Undo with ' + MOD + 'Z.' : 'Nothing to replace.'); doFind(); };
  $('findX').onclick = function () { closeFind(); editor.focus(); };

  // ── quick open, search everything, go to line, the command list ─────
  var files = null;
  function fuzzy(q, s) {
    if (!q) return { score: 0, html: esc(s) };
    var lq = q.toLowerCase(), ls = s.toLowerCase(), i = 0, j = 0, score = 0, html = '', last = -2;
    var base = ls.lastIndexOf('/') + 1;
    if (ls.indexOf(lq, base) >= base) { var k = ls.indexOf(lq, base); return { score: 1000 - k - s.length, html: esc(s.slice(0, k)) + '<b>' + esc(s.slice(k, k + q.length)) + '</b>' + esc(s.slice(k + q.length)) }; }
    for (; j < s.length; j++) {
      if (i < lq.length && ls[j] === lq[i]) { score += (j === last + 1 ? 6 : 1) + (j >= base ? 3 : 0); last = j; i++; html += '<b>' + esc(s[j]) + '</b>'; }
      else html += esc(s[j]);
    }
    return i === lq.length ? { score: score - s.length / 20, html: html } : null;
  }
  function picker(opts) {
    var d = modal('<form class="q"><span>›</span><input placeholder="' + esc(opts.placeholder) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(opts.placeholder) + '"></form><div class="list" role="listbox"></div>', { title: opts.title, wide: opts.wide });
    var input = d.querySelector('input'), list = d.querySelector('.list'), items = [], at = 0;
    function draw() {
      list.innerHTML = items.length ? items.map(function (it, i) {
        return it.group ? '<div class="group">' + esc(it.group) + '</div>' : '<div class="it' + (i === at ? ' on' : '') + '" data-i="' + i + '" role="option"><span class="lbl">' + it.html + '</span>' + (it.sub ? '<span class="sub">' + it.sub + '</span>' : '') + (it.k ? '<span class="k">' + esc(it.k) + '</span>' : '') + '</div>';
      }).join('') : '<div class="empty">' + esc(opts.empty || 'Nothing matches.') + '</div>';
      var on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function update() {
      Promise.resolve(opts.items(input.value)).then(function (x) { items = x || []; at = items.findIndex(function (it) { return !it.group; }); draw(); });
    }
    function pick(i) { var it = items[i]; if (it && !it.group) { closeModal(); it.run(); } }
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      var step = function (dir) { var n = items.length; for (var k = 0; k < n; k++) { at = (at + dir + n) % n; if (!items[at].group) break; } draw(); };
      if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    });
    d.querySelector('form').onsubmit = function (e) { e.preventDefault(); pick(at); };
    list.addEventListener('click', function (e) { var it = e.target.closest('.it'); if (it) pick(+it.getAttribute('data-i')); });
    if (opts.value) input.value = opts.value;
    input.focus();
    update();
    return { input: input, update: update };
  }
  function quickOpen() {
    var got = files ? Promise.resolve(files) : get('files').then(function (r) { files = r.files || []; return files; });
    picker({
      title: 'Find a file', placeholder: 'type part of a file name', empty: 'No file has that in its name.',
      items: function (q) {
        return got.then(function (all) {
          var res = [];
          for (var i = 0; i < all.length; i++) { var f = fuzzy(q, all[i]); if (f) res.push({ s: f.score, html: f.html, p: all[i] }); }
          res.sort(function (a, b) { return b.s - a.s; });
          return res.slice(0, 60).map(function (r) { return { html: r.html, run: function () { open(r.p); } }; });
        });
      },
    });
  }
  var searchTimer = null;
  function searchAll() {
    var p = picker({
      title: 'Search everything', placeholder: 'words to find in every file', wide: true, empty: 'Type to search every file in ' + C.name + '.',
      value: editor.doc && editor.selection().indexOf('\n') < 0 ? editor.selection() : '',
      items: function (q) {
        clearTimeout(searchTimer);
        if (!q.trim()) return [];
        return new Promise(function (resolve) {
          searchTimer = setTimeout(function () {
            get('search', { q: q }).then(function (r) {
              var out2 = [], lastP = null;
              (r.hits || []).forEach(function (h) {
                if (h.path !== lastP) { out2.push({ group: h.path }); lastP = h.path; }
                var t = h.text, a = h.at;
                out2.push({ html: '<span class="dim">' + h.line + '</span> ' + esc(t.slice(0, a)) + '<b>' + esc(t.slice(a, a + q.length)) + '</b>' + esc(t.slice(a + q.length)), run: function () { open(h.path, { line: h.line, col: h.col, len: q.length }); } });
              });
              if (r.more) out2.push({ group: 'There are more. Type more words to narrow it down.' });
              resolve(out2);
            });
          }, 220);
        });
      },
    });
    p.input.select();
  }
  function goLine() {
    if (!editor.doc) return;
    ask('Go to line', 'line number', '', function (v) { var n = parseInt(v, 10); if (n > 0) editor.go(n, 1); });
  }

  var ACTIONS = [
    { label: 'Find a file', k: MOD + 'P', run: function () { quickOpen(); } },
    { label: 'Search every file', k: MOD + '⇧F', run: function () { searchAll(); } },
    { label: 'Find in this file', k: MOD + 'F', run: function () { openFind(); }, needs: 'text' },
    { label: 'Go to line…', k: MOD + 'G', run: function () { goLine(); }, needs: 'text' },
    { label: 'Run this file', k: MOD + 'Enter', run: function () { run(); } },
    { label: 'Stop the program', run: function () { post('stop'); } },
    { label: 'Save', k: MOD + 'S', run: function () { save(active(), false); }, needs: 'text' },
    { label: 'New file', k: 'Alt+N', run: function () { newFile(false); } },
    { label: 'New folder', run: function () { newFile(true); } },
    { label: 'Close this tab', k: 'Alt+W', run: function () { close(current); } },
    { label: 'Rename this file', run: function () { if (active()) rename(active().path); } },
    { label: "Move this file to den's bin", run: function () { if (active()) trash(active().path); } },
    { label: 'Earlier versions of this file', run: function () { history(); }, needs: 'text' },
    { label: "den's bin (things you deleted)", run: function () { bin(); } },
    { label: 'Preview (web pages, Markdown, pictures, tables)', k: MOD + '⇧V', run: function () { togglePreview(); } },
    { label: 'Turn lines into comments (and back)', k: MOD + '/', run: function () { editor.toggleComment(); }, needs: 'text' },
    { label: 'Ask Ember about what I selected', run: function () { showAskTab(); askEmber('Explain what this part does, step by step.', { selection: true }); }, needs: 'text' },
    { label: 'Ask Ember to explain this file', run: function () { showAskTab(); askEmber('Explain what this file does, in simple words.'); }, needs: 'text' },
    { label: 'Show or hide the files', k: MOD + 'B', run: function () { toggle('files'); } },
    { label: 'Show or hide the console', k: MOD + 'J', run: function () { toggle('console'); } },
    { label: 'Show or hide Ember', k: MOD + 'I', run: function () { toggle('help'); } },
    { label: 'Light or dark', run: function () { setSetting('theme', settings.theme === 'light' ? 'dark' : 'light'); } },
    { label: 'Bigger text', k: MOD + '=', run: function () { setSetting('size', Math.min(24, (settings.size || 14) + 1)); } },
    { label: 'Smaller text', k: MOD + '-', run: function () { setSetting('size', Math.max(11, (settings.size || 14) - 1)); } },
    { label: 'Settings', run: function () { settingsBox(); } },
    { label: 'Keys', k: '?', run: function () { keysBox(); } },
    { label: 'Show this folder in ' + (C.platform === 'darwin' ? 'Finder' : C.platform === 'win32' ? 'File Explorer' : 'your files'), run: function () { post('reveal', { path: '' }); } },
  ];
  function palette() {
    picker({
      title: 'What do you want to do?', placeholder: 'type what you want, like "rename" or "run"',
      items: function (q) {
        var t = active();
        return ACTIONS.filter(function (a) { return !a.needs || (t && t.doc); }).map(function (a) { var f = fuzzy(q, a.label); return f && { s: f.score, html: f.html, k: a.k, run: a.run }; })
          .filter(Boolean).sort(function (a, b) { return q ? b.s - a.s : 0; });
      },
    });
  }
  $('menuBtn').onclick = palette;
  $('filesToggle').onclick = function () { main.classList.toggle('show-files'); main.classList.remove('show-help'); };
  $('helpToggle').onclick = function () { main.classList.toggle('show-help'); main.classList.remove('show-files'); };
  $('quickBtn').onclick = quickOpen;

  // ── the bin, earlier versions, settings, keys ───────────────────────
  function bin() {
    get('bin').then(function (r) {
      var items = r.items || [];
      var d = modal('<div class="list">' + (items.length ? items.map(function (it, i) {
        return '<div class="it" data-i="' + i + '"><span>' + (it.dir ? '📁 ' : '') + esc(it.path) + '</span><span class="k">' + new Date(it.at).toLocaleString() + '</span><button class="btn" type="button" data-r="' + i + '">Put back</button></div>';
      }).join('') : '<div class="empty">The bin is empty. When you delete something in den, it waits here in case you want it back.</div>') + '</div>', { title: "den's bin", wide: true });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-r]');
        if (!b) return;
        var it = items[+b.getAttribute('data-r')];
        post('restore', { id: it.id }).then(function (x) {
          if (!x.ok) { toast(esc(x.error)); return; }
          closeModal(); refreshTree(); files = null;
          toast('Put <b>' + esc(x.path) + '</b> back.');
        });
      });
    });
  }
  function history() {
    var t = active();
    if (!t || !t.doc) return;
    get('history', { path: t.path }).then(function (r) {
      var items = r.items || [];
      if (!items.length) { toast('No earlier versions yet. den keeps one each time you save (at most one a minute).'); return; }
      var d = modal('<div class="in"><div class="hist"><div class="list" id="hList">' + items.map(function (it, i) {
        return '<div class="it' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"><span>' + new Date(it.at).toLocaleString() + '</span></div>';
      }).join('') + '</div><pre id="hText" class="hl"></pre></div><div class="row"><span class="dim" style="margin-right:auto">Bringing one back puts it in the editor. ' + MOD + 'Z undoes it.</span><button class="btn go" type="button" id="hUse">Bring this version back</button></div></div>', { title: 'Earlier versions of ' + name(t.path), wide: true });
      var pick = 0, text = '';
      var show = function (i) {
        pick = i;
        Array.prototype.forEach.call(d.querySelectorAll('#hList .it'), function (el) { el.classList.toggle('on', +el.getAttribute('data-i') === i); });
        get('version', { path: t.path, id: items[i].id }).then(function (v) { text = v.text || ''; $('hText').innerHTML = HL.highlight(text, t.lang).join('\n'); });
      };
      d.querySelector('#hList').onclick = function (e) { var it = e.target.closest('.it'); if (it) show(+it.getAttribute('data-i')); };
      $('hUse').onclick = function () { closeModal(); activate(findTab(t.path)); editor.put(0, t.doc.ta.value.length, text, 0); toast('Brought back the version from ' + new Date(items[pick].at).toLocaleString() + '.'); };
      show(0);
    });
  }
  function seg(key, choices) {
    return '<span class="seg" data-k="' + key + '">' + choices.map(function (c) { return '<button type="button" data-v="' + c[0] + '" aria-pressed="' + (String(settings[key]) === String(c[0])) + '">' + esc(c[1]) + '</button>'; }).join('') + '</span>';
  }
  function settingsBox() {
    get('ai').then(function (ai) {
      var models = (ai.models || []);
      var d = modal('<div class="in"><div class="set">' +
        '<label>Look</label>' + seg('theme', [['dark', 'Dark'], ['light', 'Light']]) +
        '<label>Text size</label>' + seg('size', [[12, 'Small'], [14, 'Medium'], [16, 'Large'], [19, 'Huge']]) +
        '<label>Save</label>' + seg('autosave', [['on', 'As I type'], ['off', 'Only when I press ' + MOD + 'S']]) +
        '<label>Long lines</label>' + seg('wrap', [['auto', 'Wrap notes, not code'], ['on', 'Always wrap'], ['off', 'Never wrap']]) +
        '<label>Indent with</label>' + seg('tab', [['auto', 'Whatever the file uses'], ['2', '2 spaces'], ['4', '4 spaces']]) +
        '<label>Ember\'s AI</label>' + (models.length ? '<select id="aiPick"><option value="">Best free one (automatic)</option>' + models.map(function (m) { return '<option value="' + esc(m.key) + '"' + (settings.ai === m.key ? ' selected' : '') + '>' + esc(m.name) + (m.free ? ' (free)' : m.local ? ' (this computer)' : '') + '</option>'; }).join('') + '</select>' : '<span class="dim">Not set up yet: see the Ask tab.</span>') +
        '</div></div>', { title: 'Settings' });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('.seg button');
        if (!b) return;
        var k = b.parentNode.getAttribute('data-k'), v = b.getAttribute('data-v');
        setSetting(k, k === 'size' ? +v : v);
        Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', x === b); });
        drawSaved();
      });
      var sel2 = d.querySelector('#aiPick');
      if (sel2) sel2.onchange = function () { setSetting('ai', sel2.value); aiInfo = null; checkAi(); };
    });
  }
  function keysBox() {
    var K = [
      [MOD + 'S', 'save (den also saves as you type)'], [MOD + 'Enter', 'run this file'], [MOD + 'P', 'find a file by name'], [MOD + '⇧F', 'search every file'],
      [MOD + 'F', 'find (and replace) in this file'], [MOD + 'G', 'go to a line'], [MOD + 'K', 'everything den can do'], [MOD + '/', 'comment lines in or out'],
      ['Tab / Shift+Tab', 'push lines in / pull them out'], ['Alt+↑ / Alt+↓', 'move lines up or down'], [MOD + '⇧K', 'delete lines'], [MOD + 'Z', 'undo'],
      ['Alt+N', 'new file'], ['Alt+W', 'close tab'], ['Alt+1 … 9', 'jump to a tab'], [MOD + 'B / J / I', 'show or hide files / console / Ember'], [MOD + '⇧V', 'preview'],
    ];
    modal('<div class="in"><dl class="keys">' + K.map(function (k) { return '<dt><kbd>' + esc(k[0]) + '</kbd></dt><dd>' + esc(k[1]) + '</dd>'; }).join('') + '</dl></div>', { title: 'Keys' });
  }
  $('stKeys').onclick = keysBox;

  // ── Ask Ember ───────────────────────────────────────────────────────
  var chat = [], aiInfo = null, asking = null;
  function showWhatTab() { $('tabWhat').setAttribute('aria-selected', 'true'); $('tabAsk').setAttribute('aria-selected', 'false'); $('whatPane').hidden = false; $('askPane').hidden = true; $('askForm').hidden = true; if (main.classList.contains('no-help')) toggle('help'); }
  function showAskTab() { $('tabWhat').setAttribute('aria-selected', 'false'); $('tabAsk').setAttribute('aria-selected', 'true'); $('whatPane').hidden = true; $('askPane').hidden = false; $('askForm').hidden = false; if (main.classList.contains('no-help')) toggle('help'); checkAi(); drawChips(); }
  $('tabWhat').onclick = showWhatTab;
  $('tabAsk').onclick = function () { showAskTab(); $('askQ').focus(); };
  function checkAi() {
    if (aiInfo) return Promise.resolve(aiInfo);
    return get('ai').then(function (r) {
      aiInfo = r;
      $('askModel').textContent = r.ready ? 'Ember is using ' + r.model.name + (r.model.free ? ' (free)' : r.model.local ? ' (on this computer)' : '') : '';
      if (!r.ready) drawChat();
      return r;
    });
  }
  function drawChips() {
    var t = active(), has = !!(t && t.doc), selText = has && editor.selection();
    var chips = [
      ['Explain this file', 'Explain what this file does, in simple words.', {}, has],
      ['Explain what I selected', 'Explain what this part does, step by step.', { selection: true }, !!selText],
      ['Why did it break?', 'Why did my program stop with this error, and how do I fix it?', { error: true }, !!lastError],
      ['Give me an idea', 'Suggest one small thing I could add or improve next, and show me how.', {}, has],
    ];
    $('chips').innerHTML = chips.map(function (c, i) { return '<button class="chip" type="button" data-i="' + i + '"' + (c[3] ? '' : ' disabled') + '>' + esc(c[0]) + '</button>'; }).join('');
    $('chips').onclick = function (e) { var b = e.target.closest('.chip'); if (b && !b.disabled) { var c = chips[+b.getAttribute('data-i')]; askEmber(c[1], c[2]); } };
  }
  function drawChat() {
    var c = $('chat');
    if (aiInfo && !aiInfo.ready) {
      c.innerHTML = '<div class="card"><h4>Set up Ember\'s AI (free, about a minute)</h4><p>Ember uses the free AI you set up in <b>Tree of Thought</b>, so it runs in the cloud and costs nothing.</p><ol class="tips"><li>' + (aiInfo.tot ? 'You have Tree of Thought.' : 'Install Tree of Thought: open a terminal and type <code>pca</code>, then pick it.') + '</li><li>In a terminal, type <code>tot free</code> and follow the steps (copy and paste a key).</li><li>Come back here and press <b>Check again</b>.</li></ol><div class="row"><button class="btn go" type="button" id="aiAgain">Check again</button></div></div>' +
        '<div class="card"><h4>Until then</h4><p>The <b>What\'s this?</b> tab explains common words and errors without any AI.</p></div>';
      $('aiAgain').onclick = function () { aiInfo = null; checkAi().then(function (r) { if (r.ready) { drawChat(); toast('Ember\'s AI is ready.'); } else toast('Not yet. Did <code>tot free</code> finish?'); }); };
      return;
    }
    if (!chat.length) { c.innerHTML = '<div class="card"><h4>Ask me anything</h4><p>I can see the file you have open (and what you select), so you can just ask "what does this do?" or "why doesn\'t this work?".</p><p class="dim">I only suggest. Nothing changes unless you press <b>Put in file</b>.</p></div>'; return; }
    c.innerHTML = chat.map(function (m, i) {
      return '<div class="msg ' + (m.role === 'user' ? 'me' : 'bot') + '"><span class="who">' + (m.role === 'user' ? 'you' : 'Ember') + '</span><div class="body">' + (m.role === 'user' ? '<p>' + esc(m.content) + '</p>' : rich(m.content, i)) + (m.error ? '<p class="err">' + esc(m.error) + '</p>' : '') + '</div></div>';
    }).join('');
    var pane = $('askPane'); pane.scrollTop = pane.scrollHeight;
  }
  /** Ember's answer, lightly formatted. Code blocks get Copy and Put in file. */
  function rich(text, n) {
    var parts = String(text).split(/```([\w+#.-]*)\n?([\s\S]*?)(?:```|$)/), html = '';
    for (var i = 0; i < parts.length; i += 3) {
      var prose = parts[i];
      if (prose) {
        var lines = prose.split('\n'), list = null;
        lines.forEach(function (l) {
          var li = l.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/);
          if (li) { if (!list) { html += '<ul>'; list = 1; } html += '<li>' + mini(li[1]) + '</li>'; return; }
          if (list) { html += '</ul>'; list = null; }
          if (l.trim()) html += '<p>' + mini(l) + '</p>';
        });
        if (list) html += '</ul>';
      }
      if (i + 2 < parts.length) {
        var lang = parts[i + 1] || '', code = parts[i + 2].replace(/\n$/, '');
        var l2 = HL.langOf('x.' + ({ python: 'py', javascript: 'js', js: 'js', py: 'py', html: 'html', css: 'css', bash: 'sh', shell: 'sh', sh: 'sh', json: 'json', typescript: 'ts' }[lang.toLowerCase()] || lang));
        html += '<div class="code"><div class="bar"><span>' + esc(lang || 'code') + '</span><button type="button" data-copy="' + n + ':' + i + '">Copy</button>' + (active() && active().doc ? '<button type="button" data-put="' + n + ':' + i + '">Put in file</button>' : '') + '</div><pre class="hl">' + HL.highlight(code, l2).join('\n') + '</pre></div>';
      }
    }
    return html;
  }
  function mini(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
  function codeAt(ref) {
    var a = ref.split(':'), m = chat[+a[0]], parts = String(m.content).split(/```([\w+#.-]*)\n?([\s\S]*?)(?:```|$)/);
    return (parts[+a[1] + 2] || '').replace(/\n$/, '');
  }
  $('chat').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'), p = e.target.closest('[data-put]');
    if (c) copy(codeAt(c.getAttribute('data-copy')));
    if (p) {
      var t = active();
      if (!t || !t.doc) return;
      var code = codeAt(p.getAttribute('data-put')), ta = t.doc.ta;
      editor.put(ta.selectionStart, ta.selectionEnd, code);
      toast('Put it in <b>' + esc(name(t.path)) + '</b>. ' + MOD + 'Z undoes it.');
    }
  });
  function askEmber(question, opts) {
    opts = opts || {};
    if (asking) asking.abort();
    return checkAi().then(function (ai) {
      if (!ai.ready) { showAskTab(); drawChat(); return; }
      var t = active();
      var ctx = {};
      if (t && t.doc) { ctx.file = t.path; ctx.lang = HL.NAMES[t.lang] || ''; ctx.text = t.doc.ta.value; if (opts.selection || editor.selection()) ctx.selection = editor.selection(); }
      if ((opts.error || /error|broke|wrong|crash|stop/i.test(question)) && lastError) ctx.error = lastError.output || '';
      var history2 = chat.filter(function (m) { return !m.error; }).map(function (m) { return { role: m.role, content: m.content }; });
      chat.push({ role: 'user', content: question });
      var answer = { role: 'assistant', content: '' };
      chat.push(answer);
      drawChat();
      ember.say('Thinking…');
      $('askGo').textContent = 'Stop';
      var ac = new AbortController();
      asking = ac;
      return fetch('api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: question, context: ctx, history: history2 }), signal: ac.signal }).then(function (res) {
        var ct = res.headers.get('content-type') || '';
        if (/json/.test(ct)) return res.json().then(function (j) { answer.error = j.error || 'Something went wrong.'; });
        var reader = res.body.getReader(), dec = new TextDecoder(), last = 0;
        var pump = function () {
          return reader.read().then(function (x) {
            if (x.done) return;
            answer.content += dec.decode(x.value, { stream: true });
            var cut = answer.content.indexOf('\u0000');
            if (cut >= 0) { answer.error = answer.content.slice(cut + 1).trim(); answer.content = answer.content.slice(0, cut).trim(); }
            if (Date.now() - last > 80) { last = Date.now(); drawChat(); }
            return pump();
          });
        };
        return pump();
      }).catch(function (e) { if (e.name !== 'AbortError') answer.error = "Couldn't reach Ember: " + e.message; else answer.content += answer.content ? '' : '(stopped)'; })
        .then(function () {
          asking = null;
          $('askGo').textContent = 'Ask';
          if (!answer.content && !answer.error) answer.error = 'No answer came back. Try again in a moment.';
          drawChat();
          ember.say(answer.error ? 'Hmm, that didn\'t work. See below.' : 'There you go!', answer.error ? 'bad' : 'ok');
          if (!answer.error) ember.feel('happy', 1500);
        });
    });
  }
  $('askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (asking) { asking.abort(); return; }
    var q = $('askQ').value.trim();
    if (!q) return;
    $('askQ').value = '';
    askEmber(q);
  });
  $('askQ').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('askForm').requestSubmit(); } });

  // ── keys ────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    var mod = MAC ? e.metaKey : e.ctrlKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var inField = /^(INPUT|SELECT)$/.test(e.target.tagName) || (e.target.tagName === 'TEXTAREA' && !e.target.classList.contains('ta'));
    if (e.key === 'Escape') {
      if (!$('modal').hidden) { e.preventDefault(); closeModal(); return; }
      if (!$('findbar').hidden) { closeFind(); editor.focus(); return; }
      main.classList.remove('show-files', 'show-help');
    }
    if (!$('modal').hidden) return;
    if (mod && !e.altKey) {
      if (k === 's') { e.preventDefault(); var st = active(); if (st && st.doc && !st.dirty) status('Already saved.'); save(st); return; }
      if (k === 'p' && !e.shiftKey) { e.preventDefault(); quickOpen(); return; }
      if ((k === 'p' && e.shiftKey) || (k === 'k' && !e.shiftKey)) { e.preventDefault(); palette(); return; }
      if (k === 'f' && e.shiftKey) { e.preventDefault(); searchAll(); return; }
      if (k === 'f') { e.preventDefault(); openFind(); return; }
      if (k === 'g') { e.preventDefault(); goLine(); return; }
      if (k === 'Enter') { e.preventDefault(); run(); return; }
      if (k === 'b') { e.preventDefault(); toggle('files'); return; }
      if (k === 'j') { e.preventDefault(); toggle('console'); return; }
      if (k === 'i') { e.preventDefault(); toggle('help'); return; }
      if (k === 'v' && e.shiftKey) { e.preventDefault(); togglePreview(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); setSetting('size', Math.min(24, (settings.size || 14) + 1)); return; }
      if (k === '-') { e.preventDefault(); setSetting('size', Math.max(11, (settings.size || 14) - 1)); return; }
    }
    if (e.key === 'F5') { e.preventDefault(); run(); return; }
    if (e.key === 'F1') { e.preventDefault(); palette(); return; }
    if (e.altKey && !mod && (e.code === 'KeyN')) { e.preventDefault(); newFile(false); return; }
    if (e.altKey && !mod && (e.code === 'KeyW')) { e.preventDefault(); close(current); return; }
    if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) { e.preventDefault(); var n = +e.code.slice(5) - 1; if (tabs[n]) activate(n); return; }
    if (!inField && e.target.tagName !== 'TEXTAREA' && e.key === '?') { e.preventDefault(); keysBox(); }
  }, true);

  // ── news from den: files changing, programs running ─────────────────
  var fsTimer = null, changed = new Set();
  function connect() {
    var es = new EventSource('api/events'), fails = 0;
    es.onmessage = function (m) {
      fails = 0;
      var ev; try { ev = JSON.parse(m.data); } catch (e) { return; }
      if (ev.t === 'hello') { if (ev.running) onRun({ t: 'start', id: ev.running.id, label: ev.running.label, file: false }); }
      else if (ev.t === 'fs') {
        ev.paths.forEach(function (p) { changed.add(p); });
        clearTimeout(fsTimer);
        fsTimer = setTimeout(function () {
          var ps = Array.from(changed); changed.clear();
          files = null;
          refreshTree();
          tabs.forEach(function (t) { if (ps.indexOf(t.path) >= 0 && !t.saving) reload(t); });
        }, 250);
      } else onRun(ev);
    };
    es.onerror = function () {
      fails++;
      if (fails > 3) { es.close(); fetch('api/state').then(function (r) { if (r.ok) { setTimeout(connect, 1000); } else lost(); }).catch(lost); }
    };
  }
  window.addEventListener('focus', function () { if (alive) { refreshTree(); tabs.forEach(function (t) { if (!t.saving) reload(t); }); } });

  // ── off we go ───────────────────────────────────────────────────────
  Array.prototype.forEach.call(document.querySelectorAll('kbd.mod'), function (k) { k.textContent = MOD + 'P'; });
  $('folderName').textContent = C.name;
  $('folderName').title = C.where;
  $('branch').textContent = C.branch ? '⎇ ' + C.branch : '';
  applySettings();
  layout();
  ember.say('Hi! Pick a file on the left, or make a new one.');
  drawWhat();
  connect();
  refreshTree().then(function () {
    var want = (location.hash.match(/open=([^&]+)/) || [])[1];
    var list = (mem.tabs || []).slice(0, 12);
    var chain = Promise.resolve();
    list.forEach(function (p) { chain = chain.then(function () { return open(p, null, true).catch(function () {}); }); });
    chain.then(function () {
      if (want) return open(decodeURIComponent(want));
      var i = findTab(mem.active);
      if (i >= 0) activate(i); else if (!tabs.length) showWelcome();
    }).then(function () { if (!tabs.length) showWelcome(); });
  });
  window.addEventListener('resize', function () { if (editor.doc) editor.render(); });
})();
