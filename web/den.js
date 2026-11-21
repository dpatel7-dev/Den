// den: the page. Views on the left (files, search, changes, outline), your
// code in the middle (in one or two side-by-side groups), the console,
// terminals and problems under it, and Ember on the right explaining things.
// views.js adds the side views and the terminals to what's here.
(function () {
  'use strict';
  var C = window.DEN, HL = window.HL, HELP = window.HELP, ICONS = window.ICONS, DIFF = window.DIFF, MAC = window.Editor.MAC;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var MOD = MAC ? '⌘' : 'Ctrl+';
  var STORE = 'den:' + C.where;
  var mem = (function () { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } })();
  function remember() { try { localStorage.setItem(STORE, JSON.stringify(mem)); } catch (e) { /* private window */ } }
  var settings = Object.assign({ theme: 'ember', autosave: 'on', wrap: 'auto', tab: 'auto', size: 14, minimap: 'on', guides: 'on', check: 'on', glass: 'on' }, C.settings || {});
  if (settings.theme === 'dark') settings.theme = 'ember';
  if (settings.theme === 'light') settings.theme = 'daylight';
  var THEMES = [['ember', 'Ember', 'Warm, after dark'], ['dusk', 'Dusk', 'Indigo night'], ['moss', 'Moss', 'Forest green'], ['daylight', 'Daylight', 'Light, lilac'], ['frost', 'Frost', 'Light, cool blue']];
  var name = function (p) { return String(p).split('/').pop(); };
  var dirOf = function (p) { return String(p).split('/').slice(0, -1).join('/'); };
  var extOf = function (p) { var n = name(p).toLowerCase(), i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i + 1); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var app = window.DENAPP = { C: C, esc: esc, name: name, dirOf: dirOf, extOf: extOf, MOD: MOD, mem: mem, remember: remember, settings: settings, views: {} };

  function icons(root) {
    each((root || document).querySelectorAll('[data-icon]'), function (el) {
      if (el.querySelector('svg')) return;
      el.insertAdjacentHTML('afterbegin', ICONS.ui(el.getAttribute('data-icon')));
    });
  }
  app.icons = icons;
  app.icon = ICONS.ui;

  // ── talking to den ──────────────────────────────────────────────────
  var alive = true;
  function get(nm, params) {
    var q = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetch('api/' + nm + q).then(function (r) { return r.json(); }).catch(function (e) { lost(); throw e; });
  }
  function post(nm, body) {
    return fetch('api/' + nm, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); }).catch(function (e) { lost(); throw e; });
  }
  app.get = get; app.post = post;
  function lost() {
    if (!alive) return;
    alive = false;
    var g = document.createElement('div');
    g.className = 'gone';
    g.innerHTML = '<div><canvas width="26" height="17"></canvas><h2 style="margin:0">den was closed</h2><p>den runs from a terminal window, and it has stopped. Type <code>den</code> in a terminal (in your project folder) to open it again. Your saved work is safe.</p><button class="btn go" type="button">Try again</button></div>';
    document.body.appendChild(g);
    ember.paint(g.querySelector('canvas'), 'blink');
    g.querySelector('button').onclick = function () { location.reload(); };
  }

  // ── Ember ───────────────────────────────────────────────────────────
  var ember = (function () {
    var E = C.ember, mood = null, moodUntil = 0, frame = 'idle';
    function paint(cv, nm) {
      var g = E.frames[nm] || E.frames.idle, c = cv.getContext('2d');
      c.clearRect(0, 0, 26, 17);
      for (var y = 0; y < g.length; y++) for (var x = 0; x < g[y].length; x++) { var ink = E.ink[g[y][x]]; if (ink) { c.fillStyle = ink; c.fillRect(x, y, 1, 1); } }
    }
    function draw(nm) { frame = nm; paint($('emberTop'), nm); paint($('emberBig'), nm); }
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
    function feel(nm, ms) { mood = nm; moodUntil = Date.now() + (ms || 2400); draw(nm); }
    function say(text, kind) {
      $('bubble').innerHTML = text;
      $('bubble').className = 'bubble' + (kind ? ' ' + kind : '');
    }
    try {
      var cv = document.createElement('canvas'); cv.width = 26; cv.height = 17;
      paint(cv, 'idle');
      var big = document.createElement('canvas'); big.width = big.height = 52;
      var bc = big.getContext('2d'); bc.imageSmoothingEnabled = false; bc.drawImage(cv, 0, 0, 26, 17, 0, 9, 52, 34);
      $('icon').href = big.toDataURL();
    } catch (e) { /* no icon */ }
    return { draw: draw, feel: feel, say: say, paint: paint };
  })();
  app.ember = ember;

  // ── settings ────────────────────────────────────────────────────────
  // the forest behind everything: night for the dark colours, day for the light ones
  var forest = null;
  var NIGHT = { ember: 1, dusk: 1, moss: 1 };
  function scene() {
    if (!window.Forest) return;
    if (!forest) {
      forest = Forest.start($('forest'), { night: function () { return !!NIGHT[settings.theme]; }, clear: [0.22, 0.78], share: 0.5, fps: 15, mascot: 'fox', scene: 'closeup' });
      document.addEventListener('keydown', function () { forest.hush(900); }, true); // typing comes first
    } else forest.redraw();
  }
  function applySettings() {
    var root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.classList.toggle('flat', settings.glass === 'off');
    scene();
    root.style.setProperty('--size', (settings.size || 14) + 'px');
    groups.forEach(function (g) {
      g.editor.metrics();
      g.editor.setOptions({ minimap: settings.minimap !== 'off', guides: settings.guides !== 'off' });
      var m = shown(g);
      if (m && m.docs[g.i]) g.editor.setWrap(wrapFor(m));
    });
    drawStatus();
  }
  function setSetting(k, v) {
    settings[k] = v;
    applySettings();
    post('settings', (function () { var o = {}; o[k] = v; return o; })());
    if (k === 'tab') eachModel(function (m) { forDocs(m, function (d) { d.unit = unitFor(m); }); });
    if (k === 'check' && v !== 'off') eachModel(function (m) { scheduleCheck(m, 0); });
    if (k === 'check' && v === 'off') eachModel(function (m) { setProblems(m, 'check', []); });
  }
  app.setSetting = setSetting;

  // ── layout: hide and show parts, drag the edges ─────────────────────
  var appEl = $('app'), work = $('work');
  function layout() {
    var L = mem.layout || {};
    if (L.sw) appEl.style.setProperty('--sw', L.sw + 'px');
    if (L.hw) appEl.style.setProperty('--hw', L.hw + 'px');
    if (L.ph) work.style.setProperty('--ph', L.ph + 'px');
    appEl.classList.toggle('no-side', !!L.noSide);
    appEl.classList.toggle('no-help', !!L.noHelp);
    work.classList.toggle('no-panel', !!L.noPanel);
    $('tSide').setAttribute('aria-pressed', String(!L.noSide));
    $('tPanel').setAttribute('aria-pressed', String(!L.noPanel));
    $('tHelp').setAttribute('aria-pressed', String(!L.noHelp));
    $('emberRail').setAttribute('aria-pressed', String(!L.noHelp));
  }
  function toggle(part, force) {
    var L = mem.layout = mem.layout || {};
    var narrowHelp = matchMedia('(max-width: 1180px)').matches, narrowSide = matchMedia('(max-width: 820px)').matches;
    if (part === 'side') { if (narrowSide) appEl.classList.toggle('show-side', force); else L.noSide = force === undefined ? !L.noSide : !force; }
    if (part === 'help') { if (narrowHelp) appEl.classList.toggle('show-help', force); else L.noHelp = force === undefined ? !L.noHelp : !force; }
    if (part === 'panel') L.noPanel = force === undefined ? !L.noPanel : !force;
    remember();
    layout();
    setTimeout(function () { groups.forEach(function (g) { if (g.editor.doc) g.editor.render(); }); app.fire('layout'); }, 30);
  }
  app.toggle = toggle;
  function isOpen(part) {
    var L = mem.layout || {};
    if (part === 'side') return matchMedia('(max-width: 820px)').matches ? appEl.classList.contains('show-side') : !L.noSide;
    if (part === 'help') return matchMedia('(max-width: 1180px)').matches ? appEl.classList.contains('show-help') : !L.noHelp;
    if (part === 'panel') return !L.noPanel;
    return false;
  }
  app.isOpen = isOpen;
  $('tSide').onclick = function () { toggle('side'); };
  $('tPanel').onclick = function () { toggle('panel'); };
  $('tHelp').onclick = function () { toggle('help'); };
  $('emberRail').onclick = function () { toggle('help'); };

  function dragSplit(sp, which) {
    sp.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      sp.setPointerCapture(e.pointerId);
      sp.classList.add('dragging');
      var L = mem.layout = mem.layout || {};
      var sx = e.clientX, sy = e.clientY;
      var sw = $('side').offsetWidth, hw = $('helpBox').offsetWidth, ph = $('panel').offsetHeight;
      var pv = which.pv ? which.pv.offsetWidth : 0, total = which.pv ? which.pv.parentNode.offsetWidth : 0;
      function move(ev) {
        if (which === 'side') L.sw = Math.max(180, Math.min(560, sw + ev.clientX - sx));
        else if (which === 'helper') L.hw = Math.max(260, Math.min(680, hw - (ev.clientX - sx)));
        else if (which === 'panel') L.ph = Math.max(110, Math.min(window.innerHeight * 0.75, ph - (ev.clientY - sy)));
        else if (which.pv) { var w = Math.max(200, Math.min(total - 240, pv - (ev.clientX - sx))); which.pv.parentNode.style.setProperty('--pw', w + 'px'); }
        layout();
      }
      function up() {
        sp.classList.remove('dragging');
        sp.removeEventListener('pointermove', move);
        sp.removeEventListener('pointerup', up);
        remember();
        groups.forEach(function (g) { if (g.editor.doc) g.editor.render(); });
        app.fire('layout');
      }
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
  }
  each(document.querySelectorAll('.app > .split, .work > .split'), function (sp) { dragSplit(sp, sp.getAttribute('data-split')); });

  // little event bus between den.js and views.js
  var bus = {};
  app.on = function (ev, fn) { (bus[ev] = bus[ev] || []).push(fn); };
  app.fire = function (ev, a, b) { (bus[ev] || []).forEach(function (fn) { try { fn(a, b); } catch (e) { console.error(e); } }); };

  // ── toasts, pop-ups, menus ──────────────────────────────────────────
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
  app.toast = toast; app.status = status;

  var modalClose = null;
  function modal(html, opts) {
    opts = opts || {};
    var m = $('modal');
    m.innerHTML = '<div class="dialog' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'den') + '">' + (opts.title ? '<h2>' + esc(opts.title) + '</h2>' : '') + html + '</div>';
    m.hidden = false;
    icons(m);
    var prev = document.activeElement;
    modalClose = function () { m.hidden = true; m.innerHTML = ''; modalClose = null; if (opts.onClose) opts.onClose(); if (prev && prev.focus && document.body.contains(prev)) prev.focus({ preventScroll: true }); else focusEditor(); };
    m.onmousedown = function (e) { if (e.target === m) modalClose(); };
    return m.querySelector('.dialog');
  }
  function closeModal() { if (modalClose) modalClose(); }
  app.modal = modal; app.closeModal = closeModal;

  /** Ask for a name or line number. */
  function ask(title, label, value, done, opts) {
    opts = opts || {};
    var d = modal('<form class="q"><span class="pfx">›</span><input value="' + esc(value || '') + '" aria-label="' + esc(label) + '" placeholder="' + esc(label) + '" autocomplete="off" spellcheck="false"></form>' + (opts.note ? '<div class="in"><p class="dim" style="margin:0">' + opts.note + '</p></div>' : ''), { title: title });
    var input = d.querySelector('input');
    input.focus();
    if (value && !opts.keep) { var dot = value.lastIndexOf('.'), slash = value.lastIndexOf('/') + 1; input.setSelectionRange(slash, dot > slash ? dot : value.length); }
    d.querySelector('form').onsubmit = function (e) { e.preventDefault(); var v = input.value.trim(); closeModal(); if (v || opts.empty) done(v); };
  }
  function confirmBox(title, text, buttons) {
    var d = modal('<div class="in"><p style="margin:0">' + text + '</p><div class="row">' + buttons.map(function (b, i) { return '<button class="btn' + (b.go ? ' go' : '') + '" type="button" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div></div>', { title: title });
    each(d.querySelectorAll('button'), function (el) {
      el.onclick = function () { closeModal(); var b = buttons[+el.getAttribute('data-i')]; if (b.run) b.run(); };
    });
    var go = d.querySelector('.go') || d.querySelector('button');
    if (go) go.focus();
  }
  app.ask = ask; app.confirmBox = confirmBox;

  function menu(x, y, items) {
    var old = document.querySelector('.menu');
    if (old) old.remove();
    items = items.filter(Boolean);
    var m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it, i) { return it.sep ? '<hr>' : '<button type="button" role="menuitem" data-i="' + i + '"><span>' + esc(it.label) + '</span>' + (it.k ? '<span class="k">' + esc(it.k) + '</span>' : '') + '</button>'; }).join('');
    document.body.appendChild(m);
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + 'px';
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
  app.menu = menu;
  function menuAt(el, items) { var r = el.getBoundingClientRect(); menu(r.left, r.bottom + 4, items); }
  app.menuAt = menuAt;

  function copy(text) {
    try { navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }, function () { toast('Your browser wouldn\'t let den copy that.'); }); } catch (e) { toast('Your browser wouldn\'t let den copy that.'); }
  }
  app.copy = copy;
  var placeName = C.platform === 'darwin' ? 'Finder' : C.platform === 'win32' ? 'File Explorer' : 'your files';
  app.placeName = placeName;

  // ── open files (models) and editor groups ───────────────────────────
  var models = {};      // path -> { path, kind, file, lang, saved, base, dirty, docs: { group: doc }, problems: {…} … }
  var groups = [];      // one or two side by side
  var focusG = 0;
  app.models = models; app.groups = groups;
  function eachModel(fn) { Object.keys(models).forEach(function (p) { fn(models[p]); }); }
  function forDocs(m, fn) { Object.keys(m.docs).forEach(function (g) { fn(m.docs[g], groups[g]); }); }
  function G() { return groups[focusG] || groups[0]; }
  function shown(g) { return g && g.active ? models[g.active] : null; }
  function active() { return shown(G()); }
  function editor() { return G().editor; }
  app.active = active; app.G = G; app.forDocs = forDocs; app.eachModel = eachModel;

  function makeGroup(i) {
    var el = document.createElement('section');
    el.className = 'group glass';
    el.setAttribute('data-g', i);
    el.innerHTML = '<div class="tabs" role="tablist"></div><div class="crumbs"></div>' +
      '<div class="findbar" hidden><div class="field"><input class="fq" placeholder="Find" aria-label="Find in this file" autocomplete="off" spellcheck="false"><button type="button" class="flag fcase" title="Match capital letters" aria-pressed="false">Aa</button><button type="button" class="flag fword" title="Whole words only" aria-pressed="false">ab</button><button type="button" class="flag fre" title="Use a pattern (regular expression)" aria-pressed="false">.*</button></div>' +
      '<span class="n"></span><button class="mini-btn fprev" type="button" title="Previous (Shift+Enter)" data-icon="up"></button><button class="mini-btn fnext" type="button" title="Next (Enter)" data-icon="downarrow"></button>' +
      '<div class="field"><input class="fr" placeholder="Replace with" aria-label="Replace with" autocomplete="off" spellcheck="false"></div><button class="btn fone" type="button">Replace</button><button class="btn fall" type="button">All</button><button class="mini-btn fx" type="button" title="Close (Esc)" data-icon="close"></button></div>' +
      '<div class="banner" hidden></div>' +
      '<div class="panes"><div class="ed" hidden></div><div class="viewer"></div><div class="pvsplit" hidden></div><div class="preview" hidden></div></div>';
    $('groups').appendChild(el);
    var g = { i: i, el: el, tabs: [], active: null, tabsEl: el.querySelector('.tabs'), crumbs: el.querySelector('.crumbs'), find: el.querySelector('.findbar'), banner: el.querySelector('.banner'), panes: el.querySelector('.panes'), edHost: el.querySelector('.ed'), viewer: el.querySelector('.viewer'), pvsplit: el.querySelector('.pvsplit'), preview: el.querySelector('.preview') };
    g.editor = new window.Editor(g.edHost, {
      change: function (doc) { var m = modelOfDoc(doc); if (m) docChanged(m, doc, g); },
      cursor: function () { if (g.i === focusG) cursorMoved(); else drawCrumbs(g); },
      focus: function () { setFocus(g.i); },
      hover: function (e, pos) { hoverTip(g, e, pos); },
    });
    g.editor.setOptions({ minimap: settings.minimap !== 'off', guides: settings.guides !== 'off' });
    el.addEventListener('mousedown', function () { setFocus(g.i); }, true);
    dragSplit(g.pvsplit, { pv: g.preview });
    tabEvents(g);
    findEvents(g);
    icons(el);
    groups[i] = g;
    return g;
  }
  function setFocus(i) {
    if (focusG === i || !groups[i]) return;
    focusG = i;
    groups.forEach(function (g) { g.el.classList.toggle('focused', g.i === i && groups.length > 1); });
    afterSwitch();
  }
  function modelOfDoc(doc) {
    for (var p in models) { var m = models[p]; for (var g in m.docs) if (m.docs[g] === doc) return m; }
    return null;
  }

  function unitFor(m) {
    if (settings.tab && settings.tab !== 'auto') return +settings.tab;
    var t = m.text || '', mm = t.match(/^( +)\S/m);
    if (mm && mm[1].length <= 8) {
      var counts = {}, re = /^( +)\S/gm, x, n = 0;
      while ((x = re.exec(t)) && n++ < 400) { var l = x[1].length; if (l === 2 || l === 4 || l === 8) counts[l] = (counts[l] || 0) + 1; }
      if (counts[2] && (counts[2] >= (counts[4] || 0) / 2)) return 2;
      if (counts[4]) return 4;
    }
    return HL.INDENT[m.lang] || 2;
  }
  function wrapFor(m) {
    if (settings.wrap === 'on') return true;
    if (settings.wrap === 'off') return false;
    return m.lang === 'markdown' || m.lang === 'text';
  }
  function previewable(m) {
    var e = extOf(m.path);
    return m.kind === 'text' && (e === 'html' || e === 'htm' || e === 'md' || e === 'markdown' || e === 'svg' || e === 'csv');
  }
  app.previewable = previewable;

  function docFor(m, g) {
    if (!m.docs[g.i]) {
      var d = g.editor.make(m.text, { lang: m.lang, name: name(m.path), unit: unitFor(m), wrap: wrapFor(m) });
      d.unit = unitFor(m);
      var other = m.docs[g.i ? 0 : 1];
      if (other) { d.ta.value = other.ta.value; d.problems = other.problems; d.changes = other.changes; }
      m.docs[g.i] = d;
    }
    return m.docs[g.i];
  }

  function load(path) {
    if (models[path]) return Promise.resolve(models[path]);
    return get('read', { path: path }).then(function (r) {
      if (!r.ok) return { error: r.error };
      var f = r.file;
      var m = models[f.path] || { path: f.path, kind: f.kind, file: f, lang: HL.langOf(f.path), runnable: r.runnable, dirty: false, base: f.version || null, eol: f.eol, bom: f.bom, text: f.text, saved: f.text, docs: {}, probs: {}, preview: !!(mem.previews || {})[f.path] };
      models[m.path] = m;
      if (m.kind === 'text') { scheduleCheck(m, 50); app.fire('opened', m); }
      return m;
    });
  }

  /** Open a file in a group (the focused one unless said). where: { line, col, len } */
  function open(path, where, opts) {
    opts = opts || {};
    var g = groups[opts.group !== undefined ? opts.group : focusG] || G();
    return load(path).then(function (m) {
      if (!m || m.error) { if (!opts.quiet) toast(esc((m && m.error) || 'Couldn\'t open that.')); return null; }
      if (g.tabs.indexOf(m.path) < 0) {
        var at = g.active ? g.tabs.indexOf(g.active) + 1 : g.tabs.length;
        g.tabs.splice(at, 0, m.path);
      }
      setFocus(g.i);
      activate(g, m.path);
      if (where && m.docs[g.i]) g.editor.go(where.line, where.col, where.len);
      rememberTabs();
      recent(m.path);
      return m;
    });
  }
  app.open = open;

  function activate(g, path) {
    var m = path ? models[path] : null;
    g.active = m ? m.path : null;
    closeFind(g);
    g.banner.hidden = !(m && m.conflict);
    if (m && m.conflict) conflictBanner(g, m);
    if (!m) { showWelcome(g); drawTabs(g); afterSwitch(); return; }
    if (m.kind === 'text') {
      var d = docFor(m, g);
      g.edHost.hidden = false;
      g.viewer.hidden = true;
      g.viewer.innerHTML = '';
      g.editor.show(d);
      g.edHost.style.setProperty('--tab', d.unit);
      if (g.i === focusG) setTimeout(function () { g.editor.focus(); }, 0);
    } else {
      g.editor.show(null);
      g.edHost.hidden = true;
      showViewer(g, m);
    }
    showPreview(g, m);
    drawTabs(g);
    if (g.i === focusG) afterSwitch();
    else drawCrumbs(g);
    rememberTabs();
  }

  /** Something different is in front of you: update everything that depends on it. */
  function afterSwitch() {
    var m = active();
    drawRun();
    cursorMoved();
    drawStatus();
    drawTabs(G());
    document.title = (m ? (m.dirty ? '● ' : '') + name(m.path) + ' · ' : '') + C.name + ' · den';
    if (!running && !lastError && m) ember.say(greeting(m));
    app.fire('active', m);
  }

  function greeting(m) {
    var e = extOf(m.path), n = '<b>' + esc(name(m.path)) + '</b>';
    if (m.kind === 'image') return 'A picture: ' + n + '.';
    if (m.kind !== 'text') return n + " isn't something den can edit, but it's here.";
    var d = m.docs[focusG];
    if (d && !d.ta.value.trim()) return n + ' is empty. Want a starting point? Look below.';
    if (/^html?$/.test(e)) return m.preview ? 'Your page is beside your code. It updates as you type.' : n + ' is a web page. Press <b>Preview</b> to see it.';
    if (e === 'md') return n + ' is notes. <b>Preview</b> shows them formatted.';
    if (m.runnable && !m.runnable.missing) return n + ' is ' + esc(m.runnable.name) + '. Press <b>Run</b> to try it.';
    if (m.runnable && m.runnable.missing) return n + ' is ' + esc(m.runnable.name) + ', which needs a helper program to run.';
    return 'Editing ' + n + '. Click a word and I\'ll explain it if I can.';
  }

  // ── tabs ────────────────────────────────────────────────────────────
  function drawTabs(g) {
    var html = g.tabs.map(function (p) {
      var m = models[p], on = p === g.active, bad = m && problemCount(m).e;
      return '<div class="tab' + (on ? ' on' : '') + (m && m.dirty ? ' dirty' : '') + '" role="tab" aria-selected="' + on + '" data-p="' + esc(p) + '" title="' + esc(p) + '" draggable="true" style="--c:' + ICONS.color(p) + '">' + ICONS.file(p) + '<span class="nm">' + esc(name(p)) + '</span>' + (bad ? '<span class="bad" title="Has mistakes"></span>' : '') + '<span class="x" data-x="1" role="button" aria-label="Close ' + esc(name(p)) + '">' + ICONS.ui('close') + '</span></div>';
    }).join('');
    var m = shown(g), acts = '';
    if (m && previewable(m)) acts += '<button type="button" data-a="preview" title="Preview (' + MOD + '⇧V)" aria-pressed="' + !!m.preview + '">' + ICONS.ui('eye') + '</button>' +
      (m.preview ? '<button type="button" data-a="only" title="' + (g.only ? 'Show the code again' : 'Show only the preview') + '" aria-pressed="' + !!g.only + '">' + ICONS.ui('maximize') + '</button>' : '');
    acts += '<button type="button" data-a="split" title="' + (groups.length > 1 ? 'Close this side' : 'Split: show two files side by side (' + MOD + '\\)') + '">' + ICONS.ui(groups.length > 1 && g.i === 1 ? 'close' : 'split') + '</button>';
    if (m) acts += '<button type="button" data-a="more" title="More">' + ICONS.ui('more') + '</button>';
    g.tabsEl.innerHTML = html + '<span class="tacts">' + acts + '</span>';
    var on = g.tabsEl.querySelector('.tab.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    drawCrumbs(g);
  }
  app.drawTabs = function () { groups.forEach(drawTabs); };
  function tabEvents(g) {
    g.tabsEl.addEventListener('mousedown', function (e) {
      var tab = e.target.closest('.tab'), a = e.target.closest('[data-a]');
      if (a) {
        e.preventDefault();
        var act = a.getAttribute('data-a'), m = shown(g);
        if (act === 'preview') togglePreview(g);
        if (act === 'only') { g.only = !g.only; g.panes.classList.toggle('only-preview', g.only); drawTabs(g); if (!g.only) setTimeout(function () { g.editor.render(); }, 20); }
        if (act === 'split') { if (groups.length > 1) unsplit(g.i); else split(); }
        if (act === 'more' && m) menuAt(a, fileMenu(m, g));
        return;
      }
      if (!tab) return;
      var p = tab.getAttribute('data-p');
      if (e.target.closest('[data-x]') || e.button === 1) { e.preventDefault(); close(g, p); return; }
      if (e.button === 0) { setFocus(g.i); activate(g, p); }
    });
    g.tabsEl.addEventListener('contextmenu', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      e.preventDefault();
      var p = tab.getAttribute('data-p');
      menu(e.clientX, e.clientY, [
        { label: 'Close', k: 'Alt+W', run: function () { close(g, p); } },
        { label: 'Close the others', run: function () { g.tabs.slice().forEach(function (q) { if (q !== p) close(g, q); }); } },
        { label: groups.length > 1 ? 'Move to the other side' : 'Open on the other side', k: MOD + '\\', run: function () { toOther(g, p); } },
        { sep: true },
        { label: 'Copy the path', run: function () { copy(p); } },
        { label: 'Show in files', run: function () { app.fire('reveal', p); } },
      ]);
    });
    // drag a tab to reorder, or onto the other side
    g.tabsEl.addEventListener('dragstart', function (e) { var t = e.target.closest('.tab'); if (!t) return; e.dataTransfer.setData('text/den-tab', JSON.stringify({ g: g.i, p: t.getAttribute('data-p') })); t.classList.add('dragging'); });
    g.tabsEl.addEventListener('dragend', function (e) { var t = e.target.closest('.tab'); if (t) t.classList.remove('dragging'); });
    g.el.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/den-tab') >= 0) e.preventDefault(); });
    g.el.addEventListener('drop', function (e) {
      var raw = e.dataTransfer.getData('text/den-tab');
      if (!raw) return;
      e.preventDefault();
      var it = JSON.parse(raw), over = e.target.closest('.tab');
      if (it.g !== g.i) { toOther(groups[it.g], it.p, g.i); return; }
      if (over && over.getAttribute('data-p') !== it.p) {
        var from = g.tabs.indexOf(it.p), to = g.tabs.indexOf(over.getAttribute('data-p'));
        g.tabs.splice(from, 1); g.tabs.splice(to, 0, it.p);
        drawTabs(g); rememberTabs();
      }
    });
  }

  function fileMenu(m, g) {
    return [
      m.kind === 'text' && { label: 'Find in this file', k: MOD + 'F', run: function () { openFind(g); } },
      m.kind === 'text' && { label: 'Earlier versions', run: function () { history(m); } },
      m.kind === 'text' && app.gitBase && { label: 'What changed since the last commit', run: function () { app.fire('diff', m.path); } },
      { label: groups.length > 1 ? 'Move to the other side' : 'Open on the other side', k: MOD + '\\', run: function () { toOther(g, m.path); } },
      { sep: true },
      { label: 'Rename', run: function () { rename(m.path); } },
      { label: 'Copy the path', run: function () { copy(m.path); } },
      { label: 'Show in files', run: function () { app.fire('reveal', m.path); } },
      { label: 'Show in ' + placeName, run: function () { post('reveal', { path: m.path }); } },
      { sep: true },
      { label: "Move to den's bin", run: function () { trash(m.path); } },
    ];
  }

  function close(g, path, then) {
    var m = models[path];
    var go = function () {
      var i = g.tabs.indexOf(path);
      if (i < 0) return;
      g.tabs.splice(i, 1);
      if (m && m.docs[g.i]) { if (g.editor.doc === m.docs[g.i]) g.editor.show(null); delete m.docs[g.i]; }
      if (m && !Object.keys(m.docs).length && groups.every(function (x) { return x.tabs.indexOf(path) < 0; })) { delete models[path]; app.fire('closed', m); }
      if (g.active === path) activate(g, g.tabs[Math.min(i, g.tabs.length - 1)] || null);
      else drawTabs(g);
      if (!g.tabs.length && g.i === 1) unsplit(1);
      rememberTabs();
      drawProblems();
      if (then) then();
    };
    var last = m && groups.filter(function (x) { return x.tabs.indexOf(path) >= 0; }).length === 1;
    if (m && m.dirty && last) {
      if (settings.autosave === 'on') return save(m).then(function (ok) { if (ok) go(); });
      return confirmBox('Save ' + name(path) + '?', 'You changed <b>' + esc(name(path)) + '</b> since it was last saved.', [
        { label: 'Save', go: true, run: function () { save(m).then(function (ok) { if (ok) go(); }); } },
        { label: "Don't save", run: function () { m.dirty = false; go(); } },
        { label: 'Cancel' },
      ]);
    }
    go();
  }
  app.closeTab = close;

  // ── two files side by side ──────────────────────────────────────────
  function split(path) {
    if (groups.length < 2) makeGroup(1);
    var p = path || G().active, done;
    if (p) done = open(p, null, { group: 1 });
    else { setFocus(1); activate(groups[1], null); done = Promise.resolve(null); }
    drawTabs(groups[0]);
    groups.forEach(function (g) { g.el.classList.toggle('focused', g.i === focusG); });
    return done;
  }
  function unsplit(i) {
    if (groups.length < 2) return;
    var gone = groups[i], keep = groups[1 - i];
    // the files on the side that closes stay open on the other side
    gone.tabs.forEach(function (p) { if (keep.tabs.indexOf(p) < 0) keep.tabs.push(p); });
    if (!keep.active) keep.active = gone.active;
    gone.editor.show(null);
    eachModel(function (m) { delete m.docs[gone.i]; });
    gone.el.remove();
    if (keep.i === 1) { // the right side becomes the only side
      eachModel(function (m) { if (m.docs[1]) { m.docs[0] = m.docs[1]; delete m.docs[1]; } });
      keep.i = 0;
      keep.el.setAttribute('data-g', 0);
    }
    groups.length = 0;
    groups.push(keep);
    focusG = 0;
    keep.el.classList.remove('focused');
    activate(keep, keep.active && keep.tabs.indexOf(keep.active) >= 0 ? keep.active : keep.tabs[0] || null);
    rememberTabs();
  }
  /** Show a file on the other side: a new split shows it on both; with two sides it moves over. */
  function toOther(g, path, to) {
    var other = to !== undefined ? to : g.i === 0 ? 1 : 0;
    if (!groups[other]) { split(path); return; }
    open(path, null, { group: other }).then(function () { if (groups[g.i] === g && g.i !== other && g.tabs.indexOf(path) >= 0) close(g, path); });
  }

  function rememberTabs() {
    mem.groups = groups.map(function (g) { return { tabs: g.tabs.slice(), active: g.active }; });
    remember();
  }
  function recent(path) {
    mem.recent = [path].concat((mem.recent || []).filter(function (p) { return p !== path; })).slice(0, 8);
    remember();
  }

  // ── typing, saving, keeping both sides the same ─────────────────────
  var saveTimers = new Map();
  function docChanged(m, doc, g) {
    var v = doc.ta.value;
    m.text = v;
    // the same file open on the other side follows along
    forDocs(m, function (d, gg) {
      if (d === doc || d.ta.value === v) return;
      var s = d.ta.selectionStart, e = d.ta.selectionEnd, top = d.ta.scrollTop;
      d.ta.value = v;
      d.ta.setSelectionRange(Math.min(s, v.length), Math.min(e, v.length));
      d.ta.scrollTop = top;
      if (gg && gg.editor.doc === d) gg.editor.render();
    });
    var now = v !== m.saved;
    if (now !== m.dirty) { m.dirty = now; groups.forEach(drawTabs); document.title = (now ? '● ' : '') + name(m.path) + ' · ' + C.name + ' · den'; app.fire('dirty', m); }
    drawSaved();
    if (settings.autosave === 'on' && m.dirty && !m.conflict) {
      clearTimeout(saveTimers.get(m));
      saveTimers.set(m, setTimeout(function () { save(m); }, 900));
    }
    if (m.preview && !/^html?$/.test(extOf(m.path))) { clearTimeout(m.pvTimer); m.pvTimer = setTimeout(function () { groups.forEach(function (x) { if (x.active === m.path) refreshPreview(x, m); }); }, 300); }
    scheduleCheck(m);
    app.fire('edit', m);
    void g;
  }
  function textOf(m) { var d = m.docs[0] || m.docs[1]; return d ? d.ta.value : m.text; }
  app.textOf = textOf;

  function save(m, force) {
    m = m || active();
    if (!m || m.kind !== 'text') return Promise.resolve(true);
    clearTimeout(saveTimers.get(m));
    var text = textOf(m);
    if (!m.dirty && !force) return Promise.resolve(true);
    if (m.saving) return m.saving;
    m.saving = post('save', { path: m.path, text: text, base: m.base, eol: m.eol, bom: m.bom, force: !!force }).then(function (r) {
      m.saving = null;
      if (!r.ok) {
        if (r.code === 'changed') { m.conflict = true; groups.forEach(function (g) { if (g.active === m.path) conflictBanner(g, m); }); return false; }
        toast('Not saved: ' + esc(r.error));
        return false;
      }
      m.base = r.version;
      m.saved = text;
      m.conflict = false;
      groups.forEach(function (g) { if (g.active === m.path) g.banner.hidden = true; });
      var still = textOf(m) !== text;
      m.dirty = still;
      groups.forEach(drawTabs);
      drawSaved();
      groups.forEach(function (g) { if (g.active === m.path) refreshPreview(g, m); });
      app.fire('saved', m);
      if (still && settings.autosave === 'on') { saveTimers.set(m, setTimeout(function () { save(m); }, 900)); }
      return true;
    });
    return m.saving;
  }
  function saveAll() { var all = []; eachModel(function (m) { if (m.dirty) all.push(save(m)); }); return Promise.all(all); }
  app.save = save; app.saveAll = saveAll;
  function drawSaved() {
    var m = active(), el = $('stSaved');
    if (!m || m.kind !== 'text') { el.textContent = ''; el.className = 'pill quiet'; return; }
    el.className = 'pill ' + (m.dirty ? 'unsaved' : 'saved');
    el.innerHTML = m.dirty ? (settings.autosave === 'on' ? 'Saving…' : 'Not saved (' + MOD + 'S)') : ICONS.ui('check') + 'Saved';
  }
  function conflictBanner(g, m) {
    var b = g.banner;
    b.hidden = false;
    b.innerHTML = '<p><b>' + esc(name(m.path)) + '</b> was changed outside den (by another app, or a program you ran) while you were editing it.</p>' +
      '<button class="btn" type="button" data-c="mine">Keep mine</button><button class="btn" type="button" data-c="theirs">Load the new one</button><button class="btn" type="button" data-c="diff">Compare</button>';
    b.onclick = function (e) {
      var c = e.target.closest('[data-c]');
      if (!c) return;
      var k = c.getAttribute('data-c');
      if (k === 'mine') save(m, true);
      if (k === 'theirs') reload(m, true);
      if (k === 'diff') get('read', { path: m.path }).then(function (r) { if (r.ok) showDiff('The file on disk compared with yours', r.file.text || '', textOf(m), { aName: 'on disk', bName: 'yours' }); });
    };
  }
  function reload(m, discard) {
    return get('read', { path: m.path }).then(function (r) {
      if (!r.ok) return;
      var f = r.file;
      if (f.version && f.version === m.base && !discard) return;
      if (m.kind !== 'text' || f.kind !== 'text') { m.file = f; groups.forEach(function (g) { if (g.active === m.path) showViewer(g, m); }); return; }
      if (m.dirty && !discard) { m.conflict = true; groups.forEach(function (g) { if (g.active === m.path) conflictBanner(g, m); }); return; }
      m.saved = f.text; m.text = f.text; m.base = f.version; m.dirty = false; m.conflict = false;
      forDocs(m, function (d, g) {
        var s = d.ta.selectionStart, top = d.ta.scrollTop;
        d.ta.value = f.text;
        d.ta.setSelectionRange(Math.min(s, f.text.length), Math.min(s, f.text.length));
        d.ta.scrollTop = top;
        if (g && g.editor.doc === d) { g.banner.hidden = true; g.editor.render(true); }
      });
      groups.forEach(drawTabs); drawSaved();
      groups.forEach(function (g) { if (g.active === m.path) refreshPreview(g, m); });
      scheduleCheck(m);
      app.fire('edit', m);
      if (!discard) status(name(m.path) + ' changed on disk, so den loaded the new version.');
    });
  }
  app.reload = reload;
  window.addEventListener('beforeunload', function (e) {
    var dirty = [];
    eachModel(function (m) { if (m.dirty) dirty.push(m); });
    if (!dirty.length) return;
    if (settings.autosave === 'on') {
      dirty.forEach(function (m) {
        try { fetch('api/save', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: m.path, text: textOf(m), base: m.base, eol: m.eol, bom: m.bom }) }); } catch (x) { /* too big */ }
      });
      return;
    }
    e.preventDefault();
    e.returnValue = '';
  });

  // ── mistakes as you type ────────────────────────────────────────────
  // problems by file and by where they came from: { check: […], run: […] }
  var CHECKED = { python: 1, javascript: 1, json: 1, css: 1 };
  function scheduleCheck(m, ms) {
    if (settings.check === 'off' || !CHECKED[m.lang]) return;
    clearTimeout(m.checkTimer);
    m.checkTimer = setTimeout(function () {
      var text = textOf(m);
      post('check', { path: m.path, text: text, lang: m.lang }).then(function (r) {
        if (!r.ok || r.problems === null || !models[m.path]) return;
        if (textOf(m) !== text) return; // typed since: the next check is on its way
        setProblems(m, 'check', r.problems);
      }).catch(function () {});
    }, ms === undefined ? 700 : ms);
  }
  function setProblems(m, from, list) {
    m.probs = m.probs || {};
    m.probs[from] = list || [];
    var all = [].concat(m.probs.check || [], m.probs.run || []);
    forDocs(m, function (d, g) { g.editor.setProblems(d, all); });
    groups.forEach(drawTabs);
    drawProblems();
    app.fire('problems', m);
  }
  app.setProblems = setProblems;
  function problemsOf(m) { return m && m.probs ? [].concat(m.probs.check || [], m.probs.run || []) : []; }
  function problemCount(m) { var l = problemsOf(m); return { e: l.filter(function (p) { return !p.warn; }).length, w: l.filter(function (p) { return p.warn; }).length }; }
  app.problemsOf = problemsOf;
  function drawProblems() {
    var e = 0, w = 0;
    eachModel(function (m) { var c = problemCount(m); e += c.e; w += c.w; });
    $('stProblems').innerHTML = ICONS.ui('error') + '<span class="' + (e ? 'e' : '') + '">' + e + '</span>' + ICONS.ui('problem') + '<span class="' + (w ? 'w' : '') + '">' + w + '</span>';
    $('stProblems').title = e + w ? 'Mistakes den spotted: click to see them' : 'No mistakes spotted';
    $('probCount').hidden = !e;
    $('probCount').textContent = e;
    app.fire('problems-all');
  }
  function hoverTip(g, e, pos) {
    var tip = $('tip');
    if (!e || !pos) { tip.hidden = true; return; }
    var m = shown(g);
    var here = problemsOf(m).filter(function (p) { return p.line === pos.line; });
    if (!here.length) { tip.hidden = true; return; }
    tip.innerHTML = here.map(function (p) { return '<div><b>' + (p.warn ? 'Careful' : 'Mistake') + ':</b> ' + esc(p.msg) + '</div>'; }).join('');
    tip.hidden = false;
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 12) + 'px';
    tip.style.top = (e.clientY + 18) + 'px';
  }
  $('stProblems').onclick = function () { showPanel('problems'); };

  // ── the status line and "What's this?" ──────────────────────────────
  var whatTimer = null, cursorTimer = null;
  /** The caret moved: update what depends on where it is (a moment later, so typing stays quick). */
  function cursorMoved() {
    if (cursorTimer) return;
    cursorTimer = setTimeout(function () { cursorTimer = null; cursorNow(); }, 40);
  }
  function cursorNow() {
    var m = active(), ed = editor();
    drawCrumbs(G());
    if (!m || m.kind !== 'text' || !ed.doc) { $('stPos').textContent = ''; $('stLang').textContent = m ? kindName(m) : ''; $('stIndent').textContent = ''; drawSaved(); clearTimeout(whatTimer); whatTimer = setTimeout(drawWhat, 60); return; }
    var p = ed.pos();
    $('stLang').textContent = HL.NAMES[m.lang] || 'Plain text';
    $('stPos').textContent = 'Ln ' + p.line + ', Col ' + p.col + (p.sel ? ' (' + p.sel + ' selected)' : '');
    $('stIndent').textContent = ed.doc.unit + ' spaces';
    drawSaved();
    var here = problemsOf(m).filter(function (x) { return x.line === p.line; })[0];
    status(here ? (here.warn ? 'Careful: ' : 'Mistake: ') + here.msg : '');
    clearTimeout(whatTimer);
    whatTimer = setTimeout(drawWhat, 120);
    app.fire('cursor', m, p);
  }
  function kindName(m) { return { image: 'Picture', pdf: 'PDF', audio: 'Sound', video: 'Video', binary: 'Not text', big: 'Big file' }[m.kind] || ''; }
  function drawStatus() {
    drawSaved();
    drawProblems();
    var t = THEMES.filter(function (x) { return x[0] === settings.theme; })[0] || THEMES[0];
    $('stTheme').innerHTML = ICONS.ui('palette') + esc(t[1]);
  }
  $('stPos').onclick = function () { goLine(); };
  $('stIndent').onclick = function (e) {
    var m = active();
    if (!m || !m.docs[focusG]) return;
    menuAt(e.currentTarget, [2, 4, 8].map(function (n) { return { label: 'Indent with ' + n + ' spaces', run: function () { forDocs(m, function (d) { d.unit = n; }); editor().render(); cursorMoved(); } }; }).concat([{ sep: true }, { label: 'Always use what the file uses', run: function () { setSetting('tab', 'auto'); } }]));
  };
  $('stLang').onclick = function () { pickLanguage(); };
  $('stTheme').onclick = function (e) { menuAt(e.currentTarget, THEMES.map(function (t) { return { label: t[1] + (settings.theme === t[0] ? '  (now)' : ''), k: t[2], run: function () { setSetting('theme', t[0]); } }; })); };
  $('stKeys').onclick = function () { keysBox(); };
  $('stAi').onclick = function () { settingsBox(); };

  function pickLanguage() {
    var m = active();
    if (!m || m.kind !== 'text') return;
    picker({
      title: 'Colour this file as', placeholder: 'a language, like Python',
      items: function (q) {
        return Object.keys(HL.NAMES).map(function (k) { var f = fuzzy(q, HL.NAMES[k]); return f && { s: f.score, html: f.html, run: function () { m.lang = k; forDocs(m, function (d, g) { d.lang = k; d._text = null; if (g.editor.doc === d) g.editor.render(true); }); cursorMoved(); scheduleCheck(m, 0); } }; })
          .filter(Boolean).sort(function (a, b) { return q ? b.s - a.s : 0; });
      },
    });
  }

  var lastError = null; // { output, info, path }
  app.lastError = function () { return lastError; };
  function drawWhat() {
    var m = active(), cards = [], ed = editor();
    if (lastError && lastError.info) {
      var e = lastError.info;
      cards.push('<div class="card bad"><h4>' + esc(e.title) + '</h4><p>' + e.html + '</p>' +
        (e.where ? '<p class="dim">It happened on line ' + e.where.line + (e.where.path ? ' of ' + esc(name(e.where.path)) : '') + '.</p>' : '') +
        '<div class="row">' + (e.where ? '<button class="btn" type="button" data-act="goerr">Show me the line</button>' : '') +
        (e.fix && e.fix.command ? '<button class="btn go" type="button" data-act="fix">Install it</button>' : '') +
        '<button class="btn" type="button" data-act="whyerr">Ask Ember why</button><button class="btn" type="button" data-act="fixerr">' + ICONS.ui('wand') + 'Fix it with Ember</button></div>' +
        (e.fix && e.fix.command ? '<pre>' + esc(e.fix.command) + '</pre>' : '') + '</div>');
    } else if (lastError) {
      cards.push('<div class="card bad"><h4>It stopped with an error</h4><p>Read the last lines in the console: they usually say what went wrong, and which line.</p><div class="row"><button class="btn" type="button" data-act="whyerr">Ask Ember why</button></div></div>');
    }
    if (m && m.kind === 'text' && ed.doc) {
      var here = problemsOf(m).filter(function (p) { return p.line === ed.pos().line; })[0];
      if (here) cards.push('<div class="card bad"><h4>A mistake on this line</h4><p>' + esc(here.msg) + '</p>' + (HELP.explain ? explainLine(here.msg) : '') + '<div class="row"><button class="btn" type="button" data-act="askline">Ask Ember about it</button></div></div>');
      var word = ed.word(), gl = (HELP.GLOSSARY[m.lang] || {})[word] || (m.lang === 'html' && extOf(m.path) !== 'svg' ? HELP.GLOSSARY.css[word] : null);
      if (gl) cards.push('<div class="card"><h4>' + esc(word) + '</h4><p>' + esc(gl[0]) + '</p><pre>' + esc(gl[1]) + '</pre></div>');
      if (!ed.doc.ta.value.trim() && HELP.STARTERS[m.lang]) {
        cards.push('<div class="card"><h4>An empty file</h4><p>Want a starting point? Ember can fill in a small ' + esc(HL.NAMES[m.lang]) + ' example you can change.</p><div class="row"><button class="btn go" type="button" data-act="starter">Start me off</button></div></div>');
      }
      cards.push(tipsFor(m));
    } else if (m) {
      cards.push('<div class="card"><h4>' + esc(name(m.path)) + '</h4><p>' + ({ image: 'A picture. den shows it; to change it you need a drawing app.', pdf: 'A PDF document.', audio: 'A sound file.', video: 'A video file.', binary: "This file isn't text, so den can't show what's inside. It's probably made by another app.", big: 'This file is too big to edit comfortably in den.' }[m.kind] || '') + '</p></div>');
    } else {
      cards.push('<div class="card"><h4>Hi! I\'m Ember.</h4><p>Open a file from the list on the left, or start from one of the examples. As you type, I\'ll explain the words under your cursor here.</p><p>Stuck? The <b>Ask</b> tab lets you ask me anything about your code.</p></div>');
    }
    $('whatPane').innerHTML = cards.join('');
  }
  function explainLine(msg) {
    var info = HELP.explain(msg, C.platform);
    return info && info.html ? '<p class="dim">' + info.html + '</p>' : '';
  }
  function tipsFor(m) {
    var e = extOf(m.path), tips = [];
    var run = m.runnable && !m.runnable.missing;
    if (e === 'html' || e === 'htm') tips.push(m.preview ? '<code>console.log()</code> in your page\'s JavaScript shows in den\'s console, and so do its errors.' : 'Press <b>Preview</b> to see your page. It updates as you type.', 'Type <code>!</code> and press <kbd>Tab</kbd> on an empty line for a whole page to start from.');
    else if (e === 'md') tips.push('Press <b>Preview</b> to see how this looks formatted.');
    else if (run) tips.push('Press <b>Run</b> or <kbd>' + MOD + 'Enter</kbd> to run this file. What it prints shows in the console.');
    if (m.lang === 'python') tips.push('Python cares about the spaces at the start of lines. <kbd>Tab</kbd> pushes lines in, <kbd>Shift+Tab</kbd> pulls them out.');
    if (m.lang === 'javascript' && !/html?$/.test(e)) tips.push('<code>console.log(x)</code> prints <code>x</code> in the console: the quickest way to see what your code is doing.');
    tips.push('<kbd>' + MOD + 'E</kbd> asks Ember to change your code for you, and shows you exactly what would change first.', '<kbd>' + MOD + '/</kbd> turns lines into comments (notes the computer skips), and back.');
    return '<div class="card"><h4>Tips</h4><ul class="tips">' + tips.slice(0, 4).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
  }
  $('whatPane').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), m = active(), ed = editor();
    if (act === 'starter' && m && ed.doc) { ed.put(0, ed.doc.ta.value.length, HELP.STARTERS[m.lang], 0); toast('Here you go. Change anything you like.'); }
    if (act === 'goerr' && lastError && lastError.info.where) goTo(lastError.info.where);
    if (act === 'fix' && lastError && lastError.info.fix) runCommand(lastError.info.fix.command);
    if (act === 'whyerr') { showAskTab(); askEmber('Why did my program stop with this error, and how do I fix it?', { error: true }); }
    if (act === 'fixerr') editWithEmber('Fix the error it stopped with.', { error: true, whole: true });
    if (act === 'askline' && m) { var here = problemsOf(m).filter(function (p) { return p.line === ed.pos().line; })[0]; showAskTab(); askEmber('Line ' + ed.pos().line + ' has a mistake: "' + (here ? here.msg : '') + '". What does that mean, and how do I fix it?'); }
  });
  function goTo(w) {
    var p = w.path || '';
    var m = active();
    var rel = p;
    if (/^(\/|[A-Za-z]:)/.test(p)) {
      var root = String(C.root || '').replace(/\\/g, '/');
      var pp = p.replace(/\\/g, '/');
      rel = root && pp.indexOf(root + '/') === 0 ? pp.slice(root.length + 1) : name(p);
    }
    if (!rel && m) rel = m.path;
    var match = models[rel] ? rel : Object.keys(models).filter(function (x) { return name(x) === name(rel); })[0];
    open(match || rel, { line: w.line, col: w.col || 1 });
  }
  app.goTo = goTo;

  // ── breadcrumbs ─────────────────────────────────────────────────────
  function drawCrumbs(g) {
    var m = shown(g);
    if (!m) { g.crumbs.innerHTML = ''; g.crumbs.hidden = true; return; }
    g.crumbs.hidden = false;
    var parts = m.path.split('/'), html = '', acc = '';
    parts.forEach(function (p, i) {
      acc = acc ? acc + '/' + p : p;
      if (i) html += ICONS.ui('chevron');
      html += '<button type="button" data-c="' + esc(acc) + '"' + (i === parts.length - 1 ? '' : ' data-dir="1"') + '>' + (i === parts.length - 1 ? ICONS.file(p) : '') + esc(p) + '</button>';
    });
    var d = m.docs[g.i];
    if (d && g.editor.doc === d) {
      var line = g.editor.caretLine() + 1, chain = symbolChain(symbols(d.ta.value, m.lang), line);
      chain.forEach(function (s) { html += ICONS.ui('chevron') + '<button type="button" class="sym-c" data-line="' + s.line + '">' + esc(s.name) + '</button>'; });
    }
    g.crumbs.innerHTML = html;
    g.crumbs.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-line')) { g.editor.go(+b.getAttribute('data-line'), 1); return; }
      if (b.hasAttribute('data-dir')) { app.fire('reveal', b.getAttribute('data-c') + '/'); return; }
      gotoSymbol();
    };
  }

  // ── symbols: the functions, classes and headings in a file ──────────
  function symbols(text, lang) {
    var out = [], lines = String(text || '').split('\n'), unit = 4;
    var add = function (nm, kind, i, ind) { out.push({ name: nm, kind: kind, line: i + 1, ind: ind }); };
    var KW = /^(if|for|while|switch|catch|return|function|else|do|try|with|new|typeof|await)$/;
    for (var i = 0; i < lines.length && out.length < 2000; i++) {
      var l = lines[i], m, ind = (l.match(/^\s*/) || [''])[0].replace(/\t/g, '    ').length;
      if (lang === 'python') {
        if ((m = l.match(/^\s*(async\s+def|def|class)\s+([A-Za-z_]\w*)/))) add(m[2], m[1] === 'class' ? 'cl' : 'fn', i, ind);
        else if (ind === 0 && (m = l.match(/^([A-Z][A-Z0-9_]+)\s*=/))) add(m[1], 'v', i, ind);
      } else if (lang === 'javascript' || lang === 'typescript') {
        if ((m = l.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/))) add(m[1], 'fn', i, ind);
        else if ((m = l.match(/^\s*(?:export\s+)?(?:default\s+)?class\s+([\w$]+)/))) add(m[1], 'cl', i, ind);
        else if ((m = l.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/))) add(m[1], 'fn', i, ind);
        else if ((m = l.match(/^\s+(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([\w$]+)\s*\([^)]*\)\s*\{\s*$/)) && !KW.test(m[1])) add(m[1], 'fn', i, ind);
        else if ((m = l.match(/^\s*([\w$.]+)\.prototype\.([\w$]+)\s*=\s*function/))) add(m[2], 'fn', i, ind);
      } else if (lang === 'markdown') {
        if ((m = l.match(/^(#{1,6})\s+(.*)$/))) add(m[2].replace(/[#*`]/g, '').trim(), 'h', i, (m[1].length - 1) * unit);
      } else if (lang === 'css') {
        if ((m = l.match(/^\s*([^{}@/][^{}]*?)\s*\{\s*(\}\s*)?$/))) add(m[1].trim().slice(0, 60), 'css', i, ind);
        else if ((m = l.match(/^\s*(@media[^{]*)\{/))) add(m[1].trim(), 'css', i, ind);
      } else if (lang === 'html') {
        if ((m = l.match(/<h([1-6])[^>]*>([^<]+)/i))) add(m[2].trim(), 'h', i, (+m[1] - 1) * unit);
        else if ((m = l.match(/<(\w+)[^>]*\sid=["']([^"']+)["']/i))) add('#' + m[2], 'v', i, ind);
        else if ((m = l.match(/^\s*function\s+([\w$]+)/))) add(m[1], 'fn', i, ind);
      } else if (lang === 'go') {
        if ((m = l.match(/^func\s+(?:\([^)]*\)\s*)?([\w]+)/))) add(m[1], 'fn', i, 0);
        else if ((m = l.match(/^type\s+(\w+)/))) add(m[1], 'cl', i, 0);
      } else if (lang === 'rust') {
        if ((m = l.match(/^\s*(?:pub\s+)?fn\s+(\w+)/))) add(m[1], 'fn', i, ind);
        else if ((m = l.match(/^\s*(?:pub\s+)?(struct|enum|trait|impl)\s+([\w<>]+)/))) add(m[2], 'cl', i, ind);
      } else if (lang === 'shell') {
        if ((m = l.match(/^\s*(?:function\s+)?([\w-]+)\s*\(\)\s*\{?/))) add(m[1], 'fn', i, ind);
      } else if (lang === 'ruby' || lang === 'lua') {
        if ((m = l.match(/^\s*(?:local\s+)?(def|class|module|function)\s+([\w.:?!]+)/))) add(m[2], m[1] === 'def' || m[1] === 'function' ? 'fn' : 'cl', i, ind);
      } else if (/^(java|csharp|kotlin|swift|c|cpp|dart|php)$/.test(lang)) {
        if ((m = l.match(/^\s*(?:public|private|protected|internal|static|final|abstract|open|override|\s)*(class|interface|struct|enum|object)\s+(\w+)/))) add(m[2], 'cl', i, ind);
        else if ((m = l.match(/^\s*(?:(?:public|private|protected|internal|static|final|override|virtual|async|func|fun|def|function|inline|const)\s+)*[\w<>\[\]*&:,\s]*?\b(\w+)\s*\([^;{]*\)\s*(?:->\s*[\w<>]+\s*)?(?:throws\s+\w+\s*)?\{?\s*$/)) && !KW.test(m[1]) && !/^(else|return)$/.test(m[1])) add(m[1], 'fn', i, ind);
      }
    }
    // how deep each one is, from its indentation
    var stack = [];
    out.forEach(function (s) {
      while (stack.length && stack[stack.length - 1].ind >= s.ind) stack.pop();
      s.depth = stack.length;
      stack.push(s);
    });
    return out;
  }
  function symbolChain(list, line) {
    var chain = [];
    list.forEach(function (s) {
      if (s.line > line) return;
      while (chain.length && chain[chain.length - 1].depth >= s.depth) chain.pop();
      chain.push(s);
    });
    return chain.slice(-3);
  }
  app.symbols = symbols; app.symbolChain = symbolChain;

  // ── pictures, PDFs and other things den shows ───────────────────────
  var raw = function (p) { return 'raw/' + p.split('/').map(encodeURIComponent).join('/'); };
  app.raw = raw;
  function sizeText(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' bytes'; }
  function showViewer(g, m) {
    var v = g.viewer, f = m.file;
    v.hidden = false;
    v.className = 'viewer center';
    var size = sizeText(f.size);
    if (m.kind === 'image') v.innerHTML = '<img class="pic" alt="' + esc(f.name) + '" src="' + raw(f.path) + '?v=' + f.mtime + '"><p class="dim">' + esc(f.name) + ' · ' + size + ' · <span class="psize"></span></p>';
    else if (m.kind === 'pdf') { v.className = 'viewer full'; v.innerHTML = '<iframe class="pdf" title="' + esc(f.name) + '" src="' + raw(f.path) + '"></iframe>'; }
    else if (m.kind === 'audio') v.innerHTML = '<audio controls src="' + raw(f.path) + '"></audio><p class="dim">' + esc(f.name) + ' · ' + size + '</p>';
    else if (m.kind === 'video') v.innerHTML = '<video controls style="max-width:100%;max-height:65vh" src="' + raw(f.path) + '"></video><p class="dim">' + esc(f.name) + ' · ' + size + '</p>';
    else v.innerHTML = '<p>' + (m.kind === 'big' ? '<b>' + esc(f.name) + '</b> is ' + size + ', too big to edit comfortably here.' : '<b>' + esc(f.name) + "</b> isn't text, so den can't show what's inside (" + size + ').') + '</p><div><button class="btn" type="button" data-reveal="1">Show it in ' + placeName + '</button></div>';
    var img = v.querySelector('img.pic');
    if (img) img.onload = function () { var s = v.querySelector('.psize'); if (s) s.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' pixels'; };
    var rb = v.querySelector('[data-reveal]');
    if (rb) rb.onclick = function () { post('reveal', { path: f.path }); };
  }

  // a whole other kind of thing in the editor area: what changed in a file
  function showDiff(title, oldText, newText, opts) {
    opts = opts || {};
    var d = DIFF.rows(oldText, newText, 3);
    var html = '<div class="diffview"><div class="dh"><b>' + esc(title) + '</b><span class="add">+' + d.adds + '</span><span class="del">−' + d.dels + '</span><span class="grow"></span>' + (opts.actions || '') + '</div>';
    if (!d.adds && !d.dels) html += '<div class="same">No differences: they\'re the same.</div>';
    html += diffRows(d.rows, opts.lang);
    return html + '</div>';
  }
  function diffRows(rows, lang) {
    return rows.map(function (r) {
      if (r.k === 'gap') return '<div class="r gap">' + r.n + ' unchanged line' + (r.n === 1 ? '' : 's') + '</div>';
      var code = lang ? HL.highlight(r.text || '', lang)[0] || '' : esc(r.text || '');
      return '<div class="r ' + r.k + '"><span>' + (r.a !== undefined ? r.a + 1 : '') + '</span><span>' + (r.b !== undefined ? r.b + 1 : '') + '</span><span class="s">' + (r.k === 'add' ? '+' : r.k === 'del' ? '−' : '') + '</span><code class="hl">' + (code || ' ') + '</code></div>';
    }).join('');
  }
  app.diffHtml = showDiff;
  /** Show a comparison in the focused group, in place of the editor (closing it goes back). */
  function diffTab(title, oldText, newText, lang, actions) {
    var g = G();
    g.editor.show(null);
    g.edHost.hidden = true;
    g.viewer.hidden = false;
    g.viewer.className = 'viewer full';
    g.viewer.innerHTML = showDiff(title, oldText, newText, { lang: lang, actions: (actions || '') + '<button class="btn" type="button" data-back="1">' + ICONS.ui('close') + 'Close</button>' });
    g.preview.hidden = true; g.pvsplit.hidden = true; g.panes.classList.remove('with-preview');
    g.viewer.querySelector('[data-back]').onclick = function () { activate(g, g.active); };
    return g.viewer;
  }
  app.diffTab = diffTab;

  // ── the welcome page ────────────────────────────────────────────────
  var TEMPLATES = [
    { id: 'web', title: 'A web page', sub: 'HTML, CSS and JavaScript, with a live preview', icon: 'globe', hue: 'var(--sky)', dir: 'my-website', main: 'index.html', preview: true },
    { id: 'py', title: 'A Python program', sub: 'Asks your name and does a little maths', icon: 'snake', hue: 'var(--amber)', dir: 'my-python', main: 'main.py' },
    { id: 'quiz', title: 'A quiz game', sub: 'Python: questions, answers and a score', icon: 'quiz', hue: 'var(--violet)', dir: 'quiz', main: 'quiz.py' },
    { id: 'game', title: 'An arcade game', sub: 'Move with the arrow keys, catch the stars', icon: 'game', hue: 'var(--coral)', dir: 'star-catcher', main: 'game.js', also: 'index.html', preview: true },
    { id: 'notes', title: 'Notes', sub: 'A Markdown page with headings and a to-do list', icon: 'note', hue: 'var(--moss)', dir: '', main: 'notes.md', preview: true },
  ];
  function showWelcome(g) {
    g.editor.show(null);
    g.edHost.hidden = true;
    g.preview.hidden = true; g.pvsplit.hidden = true; g.panes.classList.remove('with-preview');
    var v = g.viewer;
    v.hidden = false; v.className = 'viewer';
    if (g.i === 1) { v.innerHTML = '<div class="welcome"><p class="dim" style="grid-column:1/-1">Drag a tab here, or pick a file to open on this side.</p></div>'; g.crumbs.hidden = true; return; }
    var rec = (mem.recent || []).slice(0, 6);
    v.innerHTML = '<div class="welcome"><div class="hello"><canvas width="26" height="17"></canvas><div><h3>Welcome to your den</h3><p>This is <b>' + esc(C.name) + '</b>. Open a file on the left, or start something new.</p></div></div>' +
      '<div><h4>Start</h4><div class="start">' +
      '<button class="act" type="button" data-w="new">' + ICONS.ui('fileplus') + 'New file<kbd>Alt+N</kbd></button>' +
      '<button class="act" type="button" data-w="find">' + ICONS.ui('search') + 'Find a file<kbd>' + MOD + 'P</kbd></button>' +
      '<button class="act" type="button" data-w="terminal">' + ICONS.ui('terminal') + 'Open a terminal<kbd>Ctrl+`</kbd></button>' +
      '<button class="act" type="button" data-w="keys">' + ICONS.ui('keyboard') + 'Keys to know<kbd>?</kbd></button></div>' +
      (rec.length ? '<h4 style="margin-top:22px">Open again</h4><div class="recent">' + rec.map(function (p) { return '<button type="button" data-p="' + esc(p) + '">' + ICONS.file(p) + esc(name(p)) + '<span class="p">' + esc(dirOf(p)) + '</span></button>'; }).join('') + '</div>' : '') +
      '</div><div><h4>Start from an example</h4><div class="tpl">' + TEMPLATES.map(function (t) {
        return '<button type="button" data-t="' + t.id + '" style="--h:' + t.hue + '"><span class="ti">' + ICONS.ui(t.icon) + '</span><b>' + esc(t.title) + '</b><span>' + esc(t.sub) + '</span></button>';
      }).join('') + '</div></div></div>';
    ember.paint(v.querySelector('canvas'), 'happy');
    v.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var w = b.getAttribute('data-w');
      if (w === 'new') newFile(false);
      if (w === 'find') quickOpen();
      if (w === 'terminal') app.fire('terminal-new');
      if (w === 'keys') keysBox();
      if (b.hasAttribute('data-p')) open(b.getAttribute('data-p'));
      if (b.hasAttribute('data-t')) fromTemplate(b.getAttribute('data-t'));
    };
    g.crumbs.hidden = true;
  }
  function fromTemplate(id) {
    var t = TEMPLATES.filter(function (x) { return x.id === id; })[0], files = HELP.TEMPLATES && HELP.TEMPLATES[id];
    if (!t || !files) return;
    var go = function (dir) {
      dir = String(dir || '').trim().replace(/^\/+|\/+$/g, '');
      var paths = Object.keys(files), base = dir ? dir + '/' : '';
      // never write over something that's there
      var clash = paths.filter(function (p) { return (kidsOf(dirOf(base + p)) || []).some(function (k) { return k.path === base + p; }); });
      if (clash.length) { toast('There\'s already a <b>' + esc(clash[0]) + '</b>. Pick another folder name.'); return; }
      var chain = Promise.resolve();
      paths.forEach(function (p) { chain = chain.then(function () { return post('save', { path: base + p, text: files[p] }); }); });
      chain.then(function () {
        app.fire('created', base + t.main, false);
        return open(base + t.main, null, { group: 0 });
      }).then(function (m) {
        // a game: its code on the left, the page itself on the right
        if (m && t.also) split(base + t.also).then(function () { groups[1].only = true; togglePreview(groups[1], true); setFocus(0); groups[0].editor.focus(); });
        else if (m && t.preview && previewable(m)) togglePreview(G(), true);
        ember.feel('happy', 2600);
        ember.say('Here\'s your ' + esc(t.title.replace(/^An? /, '')) + '. ' + (t.preview ? 'The preview updates as you change things.' : 'Press <b>Run</b> to try it.'), 'ok');
      });
    };
    if (!t.dir) return go('');
    ask('Start ' + t.title.toLowerCase().replace(/^an? /, 'a new '), 'folder name', t.dir, go, { keep: true, empty: true, note: 'den puts the files in a new folder with this name (inside ' + esc(C.name) + '). Leave it empty to put them right here.' });
  }
  var kidsOf = function (dir) { return app.treeKids ? app.treeKids(dir) : null; };

  // ── previews: web pages, Markdown, SVG pictures, CSV tables ─────────
  function showPreview(g, m) {
    var on = !!(m && m.preview && previewable(m));
    g.panes.classList.toggle('with-preview', on);
    g.panes.classList.toggle('only-preview', on && !!g.only);
    g.preview.hidden = !on; g.pvsplit.hidden = !on;
    if (!on) { g.preview.innerHTML = ''; return; }
    refreshPreview(g, m, true);
    setTimeout(function () { if (g.editor.doc) g.editor.render(); }, 20);
  }
  function refreshPreview(g, m, fresh) {
    if (!m || !m.preview || g.active !== m.path || !previewable(m)) return;
    var pv = g.preview, e = extOf(m.path), text = textOf(m);
    if (/^html?$/.test(e)) {
      if (m.dirty) return; // it refreshes once the file is saved (den saves as you type)
      var src = C.preview + m.path.split('/').map(encodeURIComponent).join('/') + '?v=' + Date.now();
      var f = pv.querySelector('iframe');
      if (!f || fresh) { pv.innerHTML = '<iframe title="Preview of ' + esc(name(m.path)) + '" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>'; f = pv.querySelector('iframe'); }
      f.src = src;
    } else if (e === 'svg') {
      pv.innerHTML = '<div class="md" style="display:grid;place-items:center"><img alt="" style="max-width:100%;max-height:100%" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text) + '"></div>';
    } else if (e === 'csv') {
      pv.innerHTML = '<div class="md">' + csvTable(text) + '</div>';
    } else {
      var top = pv.firstChild ? pv.firstChild.scrollTop : 0;
      pv.innerHTML = '<div class="md">' + markdown(text, m.path) + '</div>';
      pv.firstChild.scrollTop = top;
    }
  }
  // a page that uses other files (style.css, game.js) refreshes when they're saved too
  app.on('saved', function (m) {
    groups.forEach(function (g) { var s = shown(g); if (s && s !== m && s.preview && /^html?$/.test(extOf(s.path)) && dirOf(s.path) === dirOf(m.path)) refreshPreview(g, s); });
  });
  function togglePreview(g, force) {
    g = g || G();
    var m = shown(g);
    if (!m || !previewable(m)) return;
    m.preview = force === undefined ? !m.preview : force;
    mem.previews = mem.previews || {};
    if (m.preview) mem.previews[m.path] = 1; else delete mem.previews[m.path];
    remember();
    showPreview(g, m);
    drawTabs(g);
    drawRun();
  }
  function safeUrl(u, base) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
    if (/^[a-z][\w+.-]*:/i.test(u)) return '#';
    var dir = dirOf(base);
    return raw((dir ? dir + '/' : '') + u.replace(/^\.\//, ''));
  }
  function inline(s, base) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, function (mm, alt, u) { return '<img alt="' + alt + '" src="' + esc(safeUrl(u.replace(/&amp;/g, '&'), base)) + '">'; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (mm, txt, u) { return '<a href="' + esc(safeUrl(u.replace(/&amp;/g, '&'), base)) + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>'; })
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
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.map(function (x) {
          var box = x.match(/^\[([ xX])\]\s*/);
          return '<li>' + (box ? '<input type="checkbox" disabled' + (box[1] === ' ' ? '' : ' checked') + '> ' + inline(x.slice(box[0].length), base) : inline(x, base)) + '</li>';
        }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
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
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return '<p class="dim">Nothing here yet.</p>';
    return '<table class="csv"><tr>' + rows[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>' + rows.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }

  // ── running ─────────────────────────────────────────────────────────
  var running = null;
  function drawRun() {
    var m = active(), b = $('runBtn'), t = $('runText');
    b.querySelector('svg') && b.querySelector('svg').remove();
    if (running) { b.disabled = false; b.className = 'run stop'; b.insertAdjacentHTML('afterbegin', ICONS.ui('stop')); t.textContent = 'Stop'; b.title = 'Stop the program'; return; }
    b.className = 'run';
    b.insertAdjacentHTML('afterbegin', ICONS.ui('play'));
    if (m && previewable(m) && /^(html?|md|markdown|svg)$/.test(extOf(m.path))) { b.disabled = false; t.textContent = m.preview ? 'Hide preview' : 'Preview'; b.title = MOD + '⇧V'; return; }
    if (m && m.runnable) { b.disabled = false; t.textContent = 'Run ' + name(m.path); b.title = 'Run it (' + MOD + 'Enter)'; return; }
    b.disabled = true;
    t.textContent = 'Run';
    b.title = 'Open a program to run it';
  }
  function run() {
    if (running) return post('stop');
    var m = active();
    if (!m) return;
    if (previewable(m) && /^(html?|md|markdown|svg)$/.test(extOf(m.path))) { togglePreview(G()); drawRun(); return; }
    if (!m.runnable) { toast("den doesn't know how to run this kind of file."); return; }
    if (m.runnable.missing) {
      lastError = { info: { title: (m.runnable.name || 'That language') + ' is not installed', html: esc(m.runnable.missing).replace(/(https:\/\/\S+)/, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>') } };
      showWhatTab(); drawWhat(); ember.feel('oops', 3500); ember.say('I need a helper program to run this. See below!');
      return;
    }
    saveAll().then(function () {
      showPanel('console');
      lastRunPath = m.path;
      post('run', { path: m.path }).then(function (r) { if (!r.ok) { conLine(esc(r.error) + '\n', 'e'); } });
    });
  }
  var lastRunPath = null;
  function runCommand(line) {
    if (running) { toast('Something is still running. Stop it first.'); return; }
    showPanel('console');
    lastRunPath = null;
    post('run', { command: line }).then(function (r) { if (!r.ok) conLine(esc(r.error) + '\n', 'e'); });
  }
  app.run = run; app.runCommand = runCommand;
  $('runBtn').onclick = run;

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
  app.conLine = conLine;
  /** Make "File "x.py", line 3" and "app.js:3:5" clickable. */
  function linkify(text) {
    return esc(text)
      .replace(/File &quot;([^&]+?)&quot;, line (\d+)/g, function (m, p, l) { return '<a class="loc" data-p="' + p + '" data-l="' + l + '">' + m + '</a>'; })
      .replace(/((?:[A-Za-z]:)?[\w./\\-]+\.(?:js|mjs|cjs|ts|rb|go|java|php|lua|c|cpp|rs|swift|py)):(\d+)(?::(\d+))?/g, function (m, p, l, c) { return '<a class="loc" data-p="' + p + '" data-l="' + l + '" data-c="' + (c || 1) + '">' + m + '</a>'; });
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
      eachModel(function (m) { if (m.probs && m.probs.run && m.probs.run.length) setProblems(m, 'run', []); });
      conLine((out.childNodes.length ? '\n' : '') + (ev.file ? '▸ running ' : '› ') + esc(ev.label) + '\n', 'cmdline');
      $('cmdForm').classList.add('waiting');
      $('cmd').placeholder = 'type here to answer the program, then press Enter';
      ember.say(ev.file ? 'Running <b>' + esc(ev.label) + '</b>…' : 'Running your command…');
      drawRun(); drawWhat(); drawPanelActs();
    } else if (ev.t === 'out') {
      if (outBuf.length < 200000) outBuf += ev.text;
      conLine(linkify(ev.text), ev.err ? 'e' : '');
    } else if (ev.t === 'end') {
      running = null;
      $('cmdForm').classList.remove('waiting');
      $('cmd').placeholder = 'type a command, like: ' + (C.platform === 'win32' ? 'py --version' : 'python3 --version');
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
        markRunError(lastError);
        ember.feel('oops', 4000);
        ember.say(lastError.info ? '<b>' + esc(lastError.info.title) + '.</b> I wrote what it means below.' : 'Something went wrong. The last lines in the console usually say what.', 'bad');
        showWhatTab();
        if (!isOpen('help')) toggle('help', true);
      }
      drawRun(); drawWhat(); drawPanelActs();
    }
  }
  /** The line a program stopped on gets a squiggle too. */
  function markRunError(err) {
    var w = err.info && err.info.where;
    if (!w) return;
    var rel = w.path || lastRunPath;
    if (rel && /^(\/|[A-Za-z]:)/.test(rel)) { var root = String(C.root || '').replace(/\\/g, '/'), pp = rel.replace(/\\/g, '/'); rel = root && pp.indexOf(root + '/') === 0 ? pp.slice(root.length + 1) : null; }
    var m = rel && models[rel];
    if (m) setProblems(m, 'run', [{ line: w.line, col: w.col || 1, msg: err.info.title + (err.info.text ? ': ' + err.info.text : '') }]);
  }
  // what a previewed web page says (console.log, errors) shows here too
  var pageSaid = 0;
  window.addEventListener('message', function (e) {
    var from = groups.map(function (g) { return g.preview.querySelector('iframe'); }).filter(function (f) { return f && e.source === f.contentWindow; })[0];
    if (!from || !e.data || e.data.den !== 1) return;
    if (++pageSaid > 500) return;
    var bad = e.data.k === 'error';
    if (bad && !isOpen('panel')) toggle('panel', true);
    conLine('<span class="sys">page › </span>' + linkify(String(e.data.t).slice(0, 4000)) + '\n', bad ? 'e' : e.data.k === 'warn' ? 'warn' : '');
    if (bad) {
      showPanel('console');
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

  // ── the panel: console, terminals, problems ─────────────────────────
  var panelNow = mem.panel || 'console';
  function showPanel(which, focus) {
    panelNow = which;
    mem.panel = which; remember();
    if (!isOpen('panel')) toggle('panel', true);
    each($('ptabs').querySelectorAll('[data-p]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-p') === which)); });
    each(document.querySelectorAll('.pbody'), function (p) { p.hidden = p.getAttribute('data-pb') !== which; });
    drawPanelActs();
    app.fire('panel', which, focus);
  }
  app.showPanel = showPanel;
  function drawPanelActs() {
    var a = $('pacts'), html = '';
    if (panelNow === 'console') html = (running ? '<button type="button" data-pa="stop" title="Stop the program">' + ICONS.ui('stop') + '</button>' : '') + '<button type="button" data-pa="clear" title="Clear the console">' + ICONS.ui('trash') + '</button>';
    if (panelNow === 'terminal') html = '<button type="button" data-pa="newterm" title="New terminal (Ctrl+Shift+`)">' + ICONS.ui('plus') + '</button><button type="button" data-pa="clearterm" title="Clear (' + (MAC ? '⌘K' : 'type clear') + ')">' + ICONS.ui('trash') + '</button>';
    html += '<button type="button" data-pa="max" title="Make this bigger or smaller">' + ICONS.ui('maximize') + '</button><button type="button" data-pa="hide" title="Hide (' + MOD + 'J)">' + ICONS.ui('down') + '</button>';
    a.innerHTML = html;
  }
  $('pacts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pa]');
    if (!b) return;
    var k = b.getAttribute('data-pa');
    if (k === 'stop') post('stop');
    if (k === 'clear') out.innerHTML = '';
    if (k === 'newterm') app.fire('terminal-new');
    if (k === 'clearterm') app.fire('terminal-clear');
    if (k === 'max') { work.classList.toggle('max-panel'); app.fire('layout'); }
    if (k === 'hide') { work.classList.remove('max-panel'); toggle('panel', false); }
  });
  $('ptabs').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) showPanel(b.getAttribute('data-p'), true); });

  // ── making, renaming, deleting files ────────────────────────────────
  function newFile(dir, where, done) {
    if (where === undefined) {
      var m = active();
      where = app.treeSelectedDir ? app.treeSelectedDir() : m ? dirOf(m.path) : '';
    }
    var prefix = where ? where + '/' : '';
    ask(dir ? 'New folder' : 'New file', dir ? 'folder name' : 'file name, like main.py or index.html', prefix, function (v) {
      post('create', { path: v, dir: dir }).then(function (r) {
        if (!r.ok) { toast(esc(r.error)); return; }
        app.fire('created', r.path, dir);
        if (!dir) open(r.path);
        if (done) done(r.path);
      });
    }, { keep: true });
  }
  function rename(p, to) {
    var go = function (v) {
      if (v === p) return;
      post('rename', { from: p, to: v }).then(function (r) {
        if (!r.ok) { toast(esc(r.error)); return; }
        Object.keys(models).forEach(function (old) {
          if (old !== r.from && old.indexOf(r.from + '/') !== 0) return;
          var m = models[old], nw = r.to + old.slice(r.from.length);
          delete models[old];
          m.path = nw; m.lang = HL.langOf(nw);
          forDocs(m, function (d) { d.lang = m.lang; d._text = null; });
          models[nw] = m;
          groups.forEach(function (g) { g.tabs = g.tabs.map(function (t) { return t === old ? nw : t; }); if (g.active === old) g.active = nw; });
        });
        groups.forEach(function (g) { if (g.active) activate(g, g.active); else drawTabs(g); });
        app.fire('renamed', r.from, r.to);
      });
    };
    if (to) return go(to);
    ask('Rename', 'new name', p, go);
  }
  function trash(p) {
    post('trash', { path: p }).then(function (r) {
      if (!r.ok) { toast(esc(r.error)); return; }
      Object.keys(models).forEach(function (q) {
        if (q !== p && q.indexOf(p + '/') !== 0) return;
        models[q].dirty = false;
        groups.forEach(function (g) { if (g.tabs.indexOf(q) >= 0) close(g, q); });
      });
      app.fire('trashed', p);
      toast('Moved <b>' + esc(name(p)) + "</b> to den's bin.", { label: 'Undo', run: function () { post('restore', { id: r.id }).then(function () { app.fire('tree-refresh'); }); } });
    });
  }
  app.newFile = newFile; app.rename = rename; app.trash = trash;

  // ── find in this file ───────────────────────────────────────────────
  function findEvents(g) {
    var f = g.find, q = f.querySelector('.fq'), r = f.querySelector('.fr');
    var opts = function (keep) { return { caseSensitive: f.querySelector('.fcase').getAttribute('aria-pressed') === 'true', word: f.querySelector('.fword').getAttribute('aria-pressed') === 'true', regex: f.querySelector('.fre').getAttribute('aria-pressed') === 'true', keep: keep }; };
    var count = function (res) { f.querySelector('.n').textContent = !q.value ? '' : res.bad ? 'bad pattern' : res.n ? (res.i + 1) + ' of ' + res.n : 'no matches'; };
    g.doFind = function (keep) { var res = g.editor.search(q.value, opts(keep)); count(res); if (res.n && !keep) g.editor.findStep(0); };
    var step = function (d) { count(g.editor.findStep(d)); };
    q.addEventListener('input', function () { g.doFind(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); q.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(g); g.editor.focus(); }
    });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); f.querySelector('.fone').click(); } if (e.key === 'Escape') { e.stopPropagation(); closeFind(g); g.editor.focus(); } });
    f.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('flag')) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); g.doFind(); q.focus(); }
      if (b.classList.contains('fnext')) step(1);
      if (b.classList.contains('fprev')) step(-1);
      if (b.classList.contains('fone')) { g.editor.replaceOne(r.value); g.doFind(true); step(0); r.focus(); }
      if (b.classList.contains('fall')) { var n = g.editor.replaceAll(q.value, r.value, opts()); toast(n ? 'Replaced ' + n + '. Undo with ' + MOD + 'Z.' : 'Nothing to replace.'); g.doFind(); }
      if (b.classList.contains('fx')) { closeFind(g); g.editor.focus(); }
    });
  }
  function openFind(g, replace) {
    g = g || G();
    var m = shown(g);
    if (!m || m.kind !== 'text') return;
    g.find.hidden = false;
    var s = g.editor.selection(), q = g.find.querySelector('.fq');
    if (s && s.indexOf('\n') < 0) q.value = s;
    else if (!s && !q.value) q.value = g.editor.word();
    (replace ? g.find.querySelector('.fr') : q).focus();
    q.select();
    g.doFind();
  }
  function closeFind(g) { g.find.hidden = true; if (g.editor.doc) g.editor.search('', {}); }

  // ── quick open: files, > commands, @ symbols, : lines ───────────────
  var files = null;
  app.forgetFiles = function () { files = null; };
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
  app.fuzzy = fuzzy;
  function picker(opts) {
    var d = modal('<form class="q">' + ICONS.ui(opts.icon || 'search') + '<input placeholder="' + esc(opts.placeholder) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(opts.placeholder) + '"></form>' + (opts.hints ? '<div class="hints">' + opts.hints + '</div>' : '') + '<div class="list" role="listbox"></div>', { title: opts.title, wide: opts.wide });
    var input = d.querySelector('input'), list = d.querySelector('.list'), items = [], at = 0, n = 0;
    function draw() {
      list.innerHTML = items.length ? items.map(function (it, i) {
        return it.group ? '<div class="group">' + esc(it.group) + '</div>' : '<div class="it' + (i === at ? ' on' : '') + '" data-i="' + i + '" role="option">' + (it.icon || '') + '<span class="lbl">' + it.html + '</span>' + (it.sub ? '<span class="sub">' + it.sub + '</span>' : '') + (it.k ? '<span class="k">' + esc(it.k) + '</span>' : '') + '</div>';
      }).join('') : '<div class="empty">' + esc(typeof opts.empty === 'function' ? opts.empty(input.value) : opts.empty || 'Nothing matches.') + '</div>';
      var on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function update() {
      var me = ++n;
      Promise.resolve(opts.items(input.value)).then(function (x) { if (me !== n) return; items = x || []; at = items.findIndex(function (it) { return !it.group; }); draw(); if (opts.preview) opts.preview(items[at]); });
    }
    function pick(i) { var it = items[i]; if (it && !it.group) { closeModal(); it.run(); } }
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      var step = function (dir) { var k = items.length; for (var z = 0; z < k; z++) { at = (at + dir + k) % k; if (!items[at].group) break; } draw(); if (opts.preview) opts.preview(items[at]); };
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
  app.picker = picker;

  function quickOpen(start) {
    var got = function () { return files ? Promise.resolve(files) : get('files').then(function (r) { files = r.files || []; return files; }); };
    picker({
      title: '', placeholder: 'Find a file by name, or > for commands, @ for this file\'s parts, : for a line', value: start || '',
      hints: '<span><b>&gt;</b> commands</span><span><b>@</b> functions and headings</span><span><b>:</b> go to a line</span><span><b>?</b> help</span>',
      empty: function (q) { return q.charAt(0) === ':' ? 'Type a line number.' : 'Nothing matches.'; },
      items: function (q) {
        if (q.charAt(0) === '>') return commandItems(q.slice(1).trim());
        if (q.charAt(0) === '@') return symbolItems(q.slice(1).trim());
        if (q.charAt(0) === ':') return lineItems(q.slice(1).trim());
        if (q.charAt(0) === '?') return [
          { html: '<b>&gt;</b> run a command, like "split" or "theme"', run: function () { quickOpen('>'); } },
          { html: '<b>@</b> jump to a function, class or heading in this file', run: function () { quickOpen('@'); } },
          { html: '<b>:</b> go to a line number', run: function () { quickOpen(':'); } },
          { html: 'Type part of a file name to open it', run: function () { quickOpen(''); } },
        ];
        return got().then(function (all) {
          if (!q) {
            var rec = (mem.recent || []).filter(function (p) { return all.indexOf(p) >= 0; });
            var rest = all.filter(function (p) { return rec.indexOf(p) < 0; }).slice(0, 40);
            return (rec.length ? [{ group: 'Recently opened' }] : []).concat(rec.map(fileItem), rest.length ? [{ group: 'Files' }] : [], rest.map(fileItem));
          }
          var res = [];
          for (var i = 0; i < all.length; i++) { var f = fuzzy(q, all[i]); if (f) res.push({ s: f.score, html: f.html, p: all[i] }); }
          res.sort(function (a, b) { return b.s - a.s; });
          return res.slice(0, 60).map(function (r) { return { html: r.html, icon: ICONS.file(r.p), run: function () { open(r.p); } }; });
        });
      },
    });
  }
  function fileItem(p) { return { html: esc(name(p)), sub: esc(dirOf(p)), icon: ICONS.file(p), run: function () { open(p); } }; }
  function symbolItems(q) {
    var m = active(), ed = editor();
    if (!m || !ed.doc) return [{ group: 'Open a file first.' }];
    var list = symbols(ed.doc.ta.value, m.lang);
    if (!list.length) return [{ group: 'den didn\'t find any functions or headings in this file.' }];
    return list.map(function (s) { var f = fuzzy(q, s.name); return f && { s: f.score, html: '&nbsp;'.repeat(s.depth * 2) + f.html, icon: '<span class="sym"><span class="k ' + s.kind + '">' + ({ fn: 'ƒ', cl: 'C', h: '#', v: '•', css: '{' }[s.kind] || '•') + '</span></span>', k: 'line ' + s.line, run: function () { ed.go(s.line, 1); } }; })
      .filter(Boolean).sort(function (a, b) { return q ? b.s - a.s : 0; });
  }
  function lineItems(q) {
    var ed = editor();
    if (!ed.doc) return [{ group: 'Open a file first.' }];
    var p = q.split(/[:,]/), n = parseInt(p[0], 10), c = parseInt(p[1], 10) || 1, total = ed.pos().lines;
    if (!n) return [{ group: 'Type a line number between 1 and ' + total + '.' }];
    return [{ html: 'Go to line <b>' + Math.min(n, total) + '</b>' + (c > 1 ? ', column ' + c : ''), run: function () { ed.go(Math.min(n, total), c); } }];
  }
  function gotoSymbol() { quickOpen('@'); }
  function goLine() { quickOpen(':'); }

  var ACTIONS = [
    { label: 'Find a file', k: MOD + 'P', run: function () { quickOpen(); } },
    { label: 'Search every file', k: MOD + '⇧F', run: function () { app.showView('search'); } },
    { label: 'Find in this file', k: MOD + 'F', run: function () { openFind(); }, needs: 'text' },
    { label: 'Replace in this file', k: MOD + 'H', run: function () { openFind(null, true); }, needs: 'text' },
    { label: 'Go to line…', k: MOD + 'G', run: function () { goLine(); }, needs: 'text' },
    { label: 'Go to a function or heading…', k: MOD + '⇧O', run: function () { gotoSymbol(); }, needs: 'text' },
    { label: 'Run this file', k: MOD + 'Enter', run: function () { run(); } },
    { label: 'Stop the program', run: function () { post('stop'); } },
    { label: 'Save', k: MOD + 'S', run: function () { save(active(), false); }, needs: 'text' },
    { label: 'Save everything', run: function () { saveAll(); } },
    { label: 'New file', k: 'Alt+N', run: function () { newFile(false); } },
    { label: 'New folder', run: function () { newFile(true); } },
    { label: 'Close this tab', k: 'Alt+W', run: function () { if (G().active) close(G(), G().active); } },
    { label: 'Split: two files side by side', k: MOD + '\\', run: function () { if (groups.length > 1) unsplit(1); else split(); } },
    { label: 'Rename this file', run: function () { if (active()) rename(active().path); } },
    { label: "Move this file to den's bin", run: function () { if (active()) trash(active().path); } },
    { label: 'Earlier versions of this file', run: function () { history(active()); }, needs: 'text' },
    { label: "den's bin (things you deleted)", run: function () { bin(); } },
    { label: 'Preview (web pages, Markdown, pictures, tables)', k: MOD + '⇧V', run: function () { togglePreview(); } },
    { label: 'Turn lines into comments (and back)', k: MOD + '/', run: function () { editor().toggleComment(); }, needs: 'text' },
    { label: 'Copy these lines below', k: 'Alt+⇧↓', run: function () { editor().copyLines(1); }, needs: 'text' },
    { label: 'Select the next place this word is used', k: MOD + 'D', run: function () { editor().selectNext(); }, needs: 'text' },
    { label: 'Change this file\'s language (colours)', run: function () { pickLanguage(); }, needs: 'text' },
    { label: 'Edit with Ember: describe a change', k: MOD + 'E', run: function () { editWithEmber(); }, needs: 'text' },
    { label: 'Ask Ember about what I selected', run: function () { showAskTab(); askEmber('Explain what this part does, step by step.', { selection: true }); }, needs: 'text' },
    { label: 'Ask Ember to explain this file', run: function () { showAskTab(); askEmber('Explain what this file does, in simple words.'); }, needs: 'text' },
    { label: 'Show files', k: MOD + '⇧E', run: function () { app.showView('files'); } },
    { label: 'Show changes (git)', k: MOD + '⇧G', run: function () { app.showView('git'); } },
    { label: 'Show the outline of this file', run: function () { app.showView('outline'); } },
    { label: 'New terminal', k: 'Ctrl+⇧`', run: function () { app.fire('terminal-new'); } },
    { label: 'Show the terminal', k: 'Ctrl+`', run: function () { showPanel('terminal', true); } },
    { label: 'Show problems (mistakes den spotted)', k: MOD + '⇧M', run: function () { showPanel('problems'); } },
    { label: 'Show or hide the side bar', k: MOD + 'B', run: function () { toggle('side'); } },
    { label: 'Show or hide the console and terminal', k: MOD + 'J', run: function () { toggle('panel'); } },
    { label: 'Show or hide Ember', k: MOD + 'I', run: function () { toggle('help'); } },
    { label: 'Colours: Ember', run: function () { setSetting('theme', 'ember'); } },
    { label: 'Colours: Dusk', run: function () { setSetting('theme', 'dusk'); } },
    { label: 'Colours: Moss', run: function () { setSetting('theme', 'moss'); } },
    { label: 'Colours: Daylight', run: function () { setSetting('theme', 'daylight'); } },
    { label: 'Colours: Frost', run: function () { setSetting('theme', 'frost'); } },
    { label: 'Bigger text', k: MOD + '=', run: function () { setSetting('size', Math.min(24, (settings.size || 14) + 1)); } },
    { label: 'Smaller text', k: MOD + '-', run: function () { setSetting('size', Math.max(11, (settings.size || 14) - 1)); } },
    { label: 'Settings', k: MOD + ',', run: function () { settingsBox(); } },
    { label: 'Keys', k: '?', run: function () { keysBox(); } },
    { label: 'Show this folder in ' + placeName, run: function () { post('reveal', { path: '' }); } },
  ];
  app.actions = ACTIONS;
  function commandItems(q) {
    var m = active();
    return ACTIONS.filter(function (a) { return !a.needs || (m && m.kind === 'text'); }).map(function (a) { var f = fuzzy(q, a.label); return f && { s: f.score, html: f.html, k: a.k, run: a.run }; })
      .filter(Boolean).sort(function (a, b) { return q ? b.s - a.s : 0; });
  }
  function palette() { quickOpen('>'); }
  $('cmdBar').onclick = function () { quickOpen(); };
  $('cmdKey').textContent = MOD + 'P';
  $('folderBtn').onclick = function (e) { menuAt(e.currentTarget, [{ label: 'Show in ' + placeName, run: function () { post('reveal', { path: '' }); } }, { label: 'Copy the folder\'s path', run: function () { copy(C.root || C.where); } }, { label: 'Open a terminal here', run: function () { app.fire('terminal-new'); } }]); };
  $('settingsRail').onclick = function () { settingsBox(); };

  // ── the bin, earlier versions, settings, keys ───────────────────────
  function bin() {
    get('bin').then(function (r) {
      var items = r.items || [];
      var d = modal('<div class="list">' + (items.length ? items.map(function (it, i) {
        return '<div class="it" data-i="' + i + '">' + (it.dir ? ICONS.folder(false) : ICONS.file(it.name)) + '<span class="lbl">' + esc(it.path) + '</span><span class="k">' + new Date(it.at).toLocaleString() + '</span><button class="btn" type="button" data-r="' + i + '">Put back</button></div>';
      }).join('') : '<div class="empty">The bin is empty. When you delete something in den, it waits here in case you want it back.</div>') + '</div>', { title: "den's bin", wide: true });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-r]');
        if (!b) return;
        var it = items[+b.getAttribute('data-r')];
        post('restore', { id: it.id }).then(function (x) {
          if (!x.ok) { toast(esc(x.error)); return; }
          closeModal(); app.fire('tree-refresh'); files = null;
          toast('Put <b>' + esc(x.path) + '</b> back.');
        });
      });
    });
  }
  function history(m) {
    if (!m || m.kind !== 'text') return;
    get('history', { path: m.path }).then(function (r) {
      var items = r.items || [];
      if (!items.length) { toast('No earlier versions yet. den keeps one each time you save (at most one a minute).'); return; }
      var d = modal('<div class="in"><div class="hist"><div class="list">' + items.map(function (it, i) {
        return '<div class="it' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' + ICONS.ui('history') + '<span class="lbl">' + new Date(it.at).toLocaleString() + '</span></div>';
      }).join('') + '</div><div class="pane"></div></div><div class="row"><span class="dim" style="margin-right:auto">Green is what you have now; red is what the earlier version had. Bringing it back can be undone with ' + MOD + 'Z.</span><button class="btn go" type="button" data-use="1">Bring this version back</button></div></div>', { title: 'Earlier versions of ' + name(m.path), wide: true });
      var pick = 0, text = '';
      var show = function (i) {
        pick = i;
        each(d.querySelectorAll('.hist .it'), function (el) { el.classList.toggle('on', +el.getAttribute('data-i') === i); });
        get('version', { path: m.path, id: items[i].id }).then(function (v) { text = v.text || ''; d.querySelector('.pane').innerHTML = showDiff('That version → now', text, textOf(m), { lang: m.lang }); });
      };
      d.querySelector('.hist .list').onclick = function (e) { var it = e.target.closest('.it'); if (it) show(+it.getAttribute('data-i')); };
      d.querySelector('[data-use]').onclick = function () {
        closeModal();
        open(m.path).then(function () { var ed = editor(); ed.put(0, ed.doc.ta.value.length, text, 0); toast('Brought back the version from ' + new Date(items[pick].at).toLocaleString() + '.'); });
      };
      show(0);
    });
  }
  function seg(key, choices) {
    return '<span class="seg" data-k="' + key + '">' + choices.map(function (c) { return '<button type="button" data-v="' + c[0] + '" aria-pressed="' + (String(settings[key]) === String(c[0])) + '">' + esc(c[1]) + '</button>'; }).join('') + '</span>';
  }
  var SWATCH = { ember: 'radial-gradient(circle at 20% 20%, #ff7a3d99, transparent 60%), radial-gradient(circle at 80% 40%, #7d4dff99, transparent 60%), #1a1320', dusk: 'radial-gradient(circle at 20% 20%, #5b7cffaa, transparent 60%), radial-gradient(circle at 80% 60%, #ff6fa888, transparent 60%), #0e1226', moss: 'radial-gradient(circle at 20% 30%, #3fbf7f99, transparent 60%), radial-gradient(circle at 80% 60%, #c9d65a77, transparent 60%), #0f1a15', daylight: 'radial-gradient(circle at 20% 20%, #ffb08aaa, transparent 60%), radial-gradient(circle at 80% 60%, #a98bffaa, transparent 60%), #f6f2fb', frost: 'radial-gradient(circle at 20% 20%, #7cc0ffaa, transparent 60%), radial-gradient(circle at 80% 60%, #a5f0e0aa, transparent 60%), #f1f6fb' };
  function settingsBox() {
    get('ai').then(function (ai) {
      var mods = ai.models || [];
      var d = modal('<div class="in"><div class="set">' +
        '<label>Colours</label><div class="swatches">' + THEMES.map(function (t) { return '<button type="button" class="swatch" data-theme="' + t[0] + '" aria-pressed="' + (settings.theme === t[0]) + '"><i style="background:' + SWATCH[t[0]] + '"></i>' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
        '<label>Glass</label>' + seg('glass', [['on', 'See-through panes'], ['off', 'Solid (faster)']]) +
        '<label>Text size</label>' + seg('size', [[12, 'Small'], [14, 'Medium'], [16, 'Large'], [19, 'Huge']]) +
        '<label>Save</label>' + seg('autosave', [['on', 'As I type'], ['off', 'Only when I press ' + MOD + 'S']]) +
        '<label>Long lines</label>' + seg('wrap', [['auto', 'Wrap notes, not code'], ['on', 'Always wrap'], ['off', 'Never wrap']]) +
        '<label>Indent with</label>' + seg('tab', [['auto', 'What the file uses'], ['2', '2 spaces'], ['4', '4 spaces']]) +
        '<label>Map of the file</label>' + seg('minimap', [['on', 'Show'], ['off', 'Hide']]) +
        '<label>Indent lines</label>' + seg('guides', [['on', 'Show'], ['off', 'Hide']]) +
        '<label>Spot mistakes</label>' + seg('check', [['on', 'As I type'], ['off', 'No']]) +
        '<label>Ember\'s AI</label>' + (mods.length ? '<select id="aiPick" class="btn"><option value="">Best free one (automatic)</option>' + mods.map(function (m) { return '<option value="' + esc(m.key) + '"' + (settings.ai === m.key ? ' selected' : '') + '>' + esc(m.name) + (m.free ? ' (free)' : m.local ? ' (this computer)' : '') + '</option>'; }).join('') + '</select>' : '<span class="dim">Not set up yet: see the Ask tab.</span>') +
        '</div></div>', { title: 'Settings', wide: false });
      d.addEventListener('click', function (e) {
        var sw = e.target.closest('.swatch');
        if (sw) { setSetting('theme', sw.getAttribute('data-theme')); each(d.querySelectorAll('.swatch'), function (x) { x.setAttribute('aria-pressed', String(x === sw)); }); return; }
        var b = e.target.closest('.seg button');
        if (!b) return;
        var k = b.parentNode.getAttribute('data-k'), v = b.getAttribute('data-v');
        setSetting(k, k === 'size' ? +v : v);
        each(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      var sel2 = d.querySelector('#aiPick');
      if (sel2) sel2.onchange = function () { setSetting('ai', sel2.value); aiInfo = null; checkAi(); };
    });
  }
  function keysBox() {
    var K = [
      [MOD + 'P', 'find a file (then > for commands, @ for functions, : for a line)'], [MOD + 'K or ' + MOD + '⇧P', 'everything den can do'],
      [MOD + 'S', 'save (den also saves as you type)'], [MOD + 'Enter or F5', 'run this file'], [MOD + 'E', 'ask Ember to change your code (you see the change first)'],
      [MOD + 'F / ' + MOD + 'H', 'find / replace in this file'], [MOD + '⇧F', 'search (and replace) in every file'], [MOD + 'G', 'go to a line'], [MOD + '⇧O', 'go to a function or heading'],
      [MOD + 'D', 'select this word, then the next place it\'s used'], [MOD + '/', 'comment lines in or out'], ['Tab / Shift+Tab', 'push lines in / pull them out'],
      ['Alt+↑ / Alt+↓', 'move lines up or down'], ['Alt+⇧↑ / Alt+⇧↓', 'copy lines up or down'], [MOD + '⇧K', 'delete lines'], [MOD + 'Z', 'undo'],
      [MOD + '\\', 'two files side by side'], ['Alt+N / Alt+W', 'new file / close tab'], ['Alt+1 … 9', 'jump to a tab'], ['F8', 'next mistake'],
      ['Ctrl+`', 'terminal'], [MOD + 'B / J / I', 'show or hide the side bar / panel / Ember'], [MOD + '⇧E / ⇧G', 'files / changes'], [MOD + '⇧V', 'preview'],
    ];
    modal('<div class="in"><dl class="keys">' + K.map(function (k) { return '<dt><kbd>' + esc(k[0]) + '</kbd></dt><dd>' + esc(k[1]) + '</dd>'; }).join('') + '</dl></div>', { title: 'Keys', wide: true });
  }
  app.settingsBox = settingsBox;

  // ── Ask Ember ───────────────────────────────────────────────────────
  var chat = [], aiInfo = null, asking = null;
  function showWhatTab() { $('tabWhat').setAttribute('aria-selected', 'true'); $('tabAsk').setAttribute('aria-selected', 'false'); $('whatPane').hidden = false; $('askPane').hidden = true; $('askForm').hidden = true; }
  function showAskTab() { $('tabWhat').setAttribute('aria-selected', 'false'); $('tabAsk').setAttribute('aria-selected', 'true'); $('whatPane').hidden = true; $('askPane').hidden = false; $('askForm').hidden = false; if (!isOpen('help')) toggle('help', true); checkAi(); drawChips(); }
  $('tabWhat').onclick = showWhatTab;
  $('tabAsk').onclick = function () { showAskTab(); $('askQ').focus(); };
  function checkAi() {
    if (aiInfo) return Promise.resolve(aiInfo);
    return get('ai').then(function (r) {
      aiInfo = r;
      $('askModel').textContent = r.ready ? 'Ember is using ' + r.model.name + (r.model.free ? ' (free)' : r.model.local ? ' (on this computer)' : '') : '';
      $('stAi').innerHTML = ICONS.ui('spark') + esc(r.ready ? r.model.name : 'Ember\'s AI: not set up');
      if (!r.ready) drawChat();
      return r;
    });
  }
  app.checkAi = checkAi;
  function drawChips() {
    var m = active(), has = !!(m && m.kind === 'text'), selText = has && editor().selection();
    var chips = [
      ['Explain this file', 'Explain what this file does, in simple words.', {}, has],
      ['Explain what I selected', 'Explain what this part does, step by step.', { selection: true }, !!selText],
      ['Why did it break?', 'Why did my program stop with this error, and how do I fix it?', { error: true }, !!lastError],
      ['Give me an idea', 'Suggest one small thing I could add or improve next, and show me how.', {}, has],
    ];
    $('chips').innerHTML = chips.map(function (c, i) { return '<button class="chip" type="button" data-i="' + i + '"' + (c[3] ? '' : ' disabled') + '>' + esc(c[0]) + '</button>'; }).join('');
    $('chips').onclick = function (e) { var b = e.target.closest('.chip'); if (b && !b.disabled) { var c = chips[+b.getAttribute('data-i')]; askEmber(c[1], c[2]); } };
  }
  function setupCard() {
    return '<div class="card"><h4>Set up Ember\'s AI (free, about a minute)</h4><p>Ember uses the free AI you set up in <b>Tree of Thought</b>, so it runs in the cloud and costs nothing.</p><ol class="tips"><li>' + (aiInfo && aiInfo.tot ? 'You have Tree of Thought.' : 'Install Tree of Thought: open a terminal and type <code>pca</code>, then pick it.') + '</li><li>In a terminal, type <code>tot free</code> and follow the steps (copy and paste a key).</li><li>Come back here and press <b>Check again</b>.</li></ol><div class="row"><button class="btn go" type="button" id="aiAgain">Check again</button></div></div>';
  }
  function drawChat() {
    var c = $('chat');
    if (aiInfo && !aiInfo.ready) {
      c.innerHTML = setupCard() + '<div class="card"><h4>Until then</h4><p>The <b>What\'s this?</b> tab explains common words and errors without any AI.</p></div>';
      $('aiAgain').onclick = function () { aiInfo = null; checkAi().then(function (r) { if (r.ready) { drawChat(); toast('Ember\'s AI is ready.'); } else toast('Not yet. Did <code>tot free</code> finish?'); }); };
      return;
    }
    if (!chat.length) { c.innerHTML = '<div class="card"><h4>Ask me anything</h4><p>I can see the file you have open (and what you select), so you can just ask "what does this do?" or "why doesn\'t this work?".</p><p class="dim">I only suggest. When I show code, <b>Apply</b> shows you exactly what would change before anything does.</p></div>'; return; }
    c.innerHTML = chat.map(function (m, i) {
      return '<div class="msg ' + (m.role === 'user' ? 'me' : 'bot') + '"><span class="who">' + (m.role === 'user' ? 'You' : 'Ember') + '</span><div class="body">' + (m.role === 'user' ? '<p>' + esc(m.content) + '</p>' : rich(m.content, i)) + (m.error ? '<p class="err">' + esc(m.error) + '</p>' : '') + '</div></div>';
    }).join('');
    var pane = $('askPane'); pane.scrollTop = pane.scrollHeight;
  }
  /** Ember's answer, lightly formatted. Code blocks get Copy and Apply. */
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
        html += '<div class="code"><div class="bar"><span>' + esc(lang || 'code') + '</span><button type="button" data-copy="' + n + ':' + i + '">Copy</button>' + (active() && active().kind === 'text' ? '<button type="button" class="go" data-put="' + n + ':' + i + '">Apply…</button>' : '') + '</div><pre class="hl">' + HL.highlight(code, langOfFence(lang)).join('\n') + '</pre></div>';
      }
    }
    return html;
  }
  function langOfFence(lang) { return HL.langOf('x.' + ({ python: 'py', javascript: 'js', js: 'js', py: 'py', html: 'html', css: 'css', bash: 'sh', shell: 'sh', sh: 'sh', json: 'json', typescript: 'ts' }[String(lang).toLowerCase()] || lang)); }
  function mini(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
  function codeAt(ref) {
    var a = ref.split(':'), m = chat[+a[0]], parts = String(m.content).split(/```([\w+#.-]*)\n?([\s\S]*?)(?:```|$)/);
    return (parts[+a[1] + 2] || '').replace(/\n$/, '');
  }
  $('chat').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'), p = e.target.closest('[data-put]');
    if (c) copy(codeAt(c.getAttribute('data-copy')));
    if (p) applyCode(codeAt(p.getAttribute('data-put')));
  });

  /**
   * Put Ember's code into the file, after showing exactly what changes.
   * Replaces what you selected; or the whole file when the code is clearly a
   * whole new version of it; otherwise goes in where the cursor is.
   */
  function applyCode(code, opts) {
    opts = opts || {};
    var m = active(), ed = editor();
    if (!m || !ed.doc) return;
    var ta = ed.doc.ta, text = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (opts.range) { s = opts.range[0]; e = opts.range[1]; }
    else if (s === e) {
      var cl = DIFF.split(code), fl = DIFF.split(text);
      var firstC = (cl.filter(function (l) { return l.trim(); })[0] || '').trim(), firstF = (fl.filter(function (l) { return l.trim(); })[0] || '').trim();
      if (opts.whole || !text.trim() || cl.length >= fl.length * 0.6 || (firstC && firstC === firstF && cl.length > 3)) { s = 0; e = text.length; }
      else {
        // a few lines: they go on their own line (an empty line is used; otherwise below this one)
        var ls = text.lastIndexOf('\n', s - 1) + 1, le = text.indexOf('\n', s); if (le < 0) le = text.length;
        if (!text.slice(ls, le).trim()) { s = ls; e = le; }
        else { s = e = le; code = '\n' + code; }
      }
    }
    var after = text.slice(0, s) + code + (code && e === text.length && /\n$/.test(text) && !/\n$/.test(code) ? '\n' : '') + text.slice(e);
    var where = s === 0 && e === text.length ? 'the whole file' : s === e || !text.slice(s, e).trim() ? 'new lines where your cursor is' : 'the part you selected';
    var dd = DIFF.rows(text, after, 0), lost = dd.dels - dd.adds;
    var warn = lost > 15 && lost > DIFF.split(text).length / 3 ? '<span class="err" style="margin-right:auto">Careful: this takes out ' + dd.dels + ' lines and puts back ' + dd.adds + '. Look closely before you apply it.</span>' : '<span class="dim" style="margin-right:auto">Green lines are added, red ones removed. ' + MOD + 'Z undoes it afterwards.</span>';
    var d = modal('<div class="in" style="padding-top:8px"><div class="hist" style="grid-template-columns:minmax(0,1fr);min-height:0"><div class="pane">' + showDiff('Ember\'s change to ' + name(m.path) + ' (' + where + ')', text, after, { lang: m.lang }) + '</div></div><div class="row">' + warn + '<button class="btn" type="button" data-x="1">Cancel</button><button class="btn go" type="button" data-ok="1">' + ICONS.ui('check') + 'Apply</button></div></div>', { title: 'Look before it changes', wide: true });
    d.querySelector('[data-x]').onclick = closeModal;
    var ok = d.querySelector('[data-ok]');
    ok.focus();
    ok.onclick = function () {
      closeModal();
      ed.put(s, e, after.slice(s, after.length - (text.length - e)), s + code.length);
      toast('Changed <b>' + esc(name(m.path)) + '</b>. ' + MOD + 'Z undoes it.');
      ember.feel('happy', 1500);
    };
  }
  app.applyCode = applyCode;

  function askEmber(question, opts) {
    opts = opts || {};
    if (asking) asking.abort();
    return checkAi().then(function (ai) {
      if (!ai.ready) { showAskTab(); drawChat(); return; }
      var m = active(), ed = editor();
      var ctx = {};
      if (m && ed.doc) { ctx.file = m.path; ctx.lang = HL.NAMES[m.lang] || ''; ctx.text = ed.doc.ta.value; if (opts.selection || ed.selection()) ctx.selection = ed.selection(); }
      if ((opts.error || /error|broke|wrong|crash|stop/i.test(question)) && lastError) ctx.error = lastError.output || '';
      var history2 = chat.filter(function (x) { return !x.error; }).map(function (x) { return { role: x.role, content: x.content }; });
      chat.push({ role: 'user', content: question });
      var answer = { role: 'assistant', content: '' };
      chat.push(answer);
      drawChat();
      ember.say('Thinking…');
      $('askGo').textContent = 'Stop';
      var ac = new AbortController();
      asking = ac;
      return stream(question, ctx, history2, ac, function (t) { answer.content = t; drawChat(); }).then(function (r) {
        answer.content = r.text; answer.error = r.error;
      }).then(function () {
        asking = null;
        $('askGo').textContent = 'Ask';
        if (!answer.content && !answer.error) answer.error = 'No answer came back. Try again in a moment.';
        drawChat();
        ember.say(answer.error ? 'Hmm, that didn\'t work. See below.' : 'There you go!', answer.error ? 'bad' : 'ok');
        if (!answer.error) ember.feel('happy', 1500);
      });
    });
  }
  /** Ask, and stream the answer: onText(textSoFar). Resolves { text, error }. */
  function stream(question, ctx, hist, ac, onText) {
    var text = '', error = null;
    return fetch('api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: question, context: ctx, history: hist || [] }), signal: ac.signal }).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      if (/json/.test(ct)) return res.json().then(function (j) { error = j.error || 'Something went wrong.'; });
      var reader = res.body.getReader(), dec = new TextDecoder(), last = 0;
      var pump = function () {
        return reader.read().then(function (x) {
          if (x.done) return;
          text += dec.decode(x.value, { stream: true });
          var cut = text.indexOf('\u0000');
          if (cut >= 0) { error = text.slice(cut + 1).trim(); text = text.slice(0, cut).trim(); }
          if (Date.now() - last > 80) { last = Date.now(); onText(text); }
          return pump();
        });
      };
      return pump();
    }).catch(function (e) { if (e.name !== 'AbortError') error = "Couldn't reach Ember: " + e.message; else if (!text) text = '(stopped)'; })
      .then(function () { return { text: text, error: error }; });
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
  app.askEmber = askEmber; app.showAskTab = showAskTab;

  /** "Edit with Ember": say what to change; Ember writes it; you see the change; then Apply. */
  function editWithEmber(preset, opts) {
    opts = opts || {};
    var m = active(), ed = editor();
    if (!m || !ed.doc) { toast('Open a file first.'); return; }
    var ta = ed.doc.ta, range = [ta.selectionStart, ta.selectionEnd], sel = range[0] !== range[1] && !opts.whole;
    var go = function (want) {
      checkAi().then(function (ai) {
        if (!ai.ready) { showAskTab(); drawChat(); return; }
        var q = sel ? 'Change the part I selected so that: ' + want + '\nReply with only the new version of the selected part, in one code block, with nothing before or after it.'
          : 'Change this file so that: ' + want + '\nReply with the whole new file in one code block, then one short sentence about what you changed.';
        var ctx = { file: m.path, lang: HL.NAMES[m.lang] || '', text: ta.value };
        if (sel) ctx.selection = ta.value.slice(range[0], range[1]);
        if (opts.error && lastError) ctx.error = lastError.output || '';
        var d = modal('<div class="in"><p style="margin:0">Ember is writing the change to <b>' + esc(name(m.path)) + '</b>…</p><pre class="hl" style="max-height:40vh;overflow:auto;margin:0;padding:10px;border-radius:10px;background:var(--glass2)"></pre><div class="row"><button class="btn" type="button" data-x="1">Stop</button></div></div>', { title: 'Edit with Ember', wide: true });
        var ac = new AbortController(), pre = d.querySelector('pre');
        d.querySelector('[data-x]').onclick = function () { ac.abort(); closeModal(); };
        ember.say('Writing that change…');
        stream(q, ctx, [], ac, function (t) { pre.textContent = t.slice(-3000); pre.scrollTop = pre.scrollHeight; }).then(function (r) {
          if (ac.signal.aborted) return;
          closeModal();
          if (r.error) { toast(esc(r.error)); return; }
          var mm = r.text.match(/```[\w+#.-]*\n?([\s\S]*?)(?:```|$)/);
          if (!mm) { showAskTab(); chat.push({ role: 'user', content: want }, { role: 'assistant', content: r.text }); drawChat(); return; }
          var code = mm[1].replace(/\n$/, '');
          if (!sel && /\n$/.test(ta.value)) code += '\n';
          applyCode(code, sel ? { range: range } : { whole: true });
          var note = r.text.slice(r.text.lastIndexOf('```') + 3).trim();
          if (note) ember.say(esc(note.slice(0, 300)), 'ok');
        });
      });
    };
    if (preset) return go(preset);
    ask('Edit with Ember', sel ? 'what should change in the part you selected?' : 'what should change? e.g. "add a score that goes up"', '', go, { note: 'Ember writes the change, then shows you exactly what would change before anything does.' });
  }
  app.editWithEmber = editWithEmber;

  // ── keys ────────────────────────────────────────────────────────────
  function nextProblem(dir) {
    var m = active(), ed = editor();
    if (!m || !ed.doc) return;
    var list = problemsOf(m).slice().sort(function (a, b) { return a.line - b.line; });
    if (!list.length) { status('No mistakes spotted in this file.'); return; }
    var line = ed.pos().line, p = dir > 0 ? list.filter(function (x) { return x.line > line; })[0] || list[0] : list.filter(function (x) { return x.line < line; }).pop() || list[list.length - 1];
    ed.go(p.line, p.col || 1);
  }
  document.addEventListener('keydown', function (e) {
    var mod = MAC ? e.metaKey : e.ctrlKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var inTerm = e.target.classList && e.target.classList.contains('tin');
    var inField = /^(INPUT|SELECT)$/.test(e.target.tagName) || (e.target.tagName === 'TEXTAREA' && !e.target.classList.contains('ta') && !inTerm);
    if (e.key === 'Escape') {
      if (!$('modal').hidden) { e.preventDefault(); closeModal(); return; }
      var g = G();
      if (!g.find.hidden) { closeFind(g); g.editor.focus(); return; }
      appEl.classList.remove('show-side', 'show-help');
    }
    if (!$('modal').hidden) return;
    if (e.ctrlKey && (e.code === 'Backquote')) { e.preventDefault(); if (e.shiftKey) app.fire('terminal-new'); else if (panelNow === 'terminal' && isOpen('panel') && inTerm) toggle('panel', false); else showPanel('terminal', true); return; }
    // the terminal gets its own keys (on a Mac, ⌘ ones are den's; elsewhere, Ctrl+Shift ones)
    if (inTerm && (MAC ? !e.metaKey || k === 'k' || k === 'c' || k === 'v' : !(e.ctrlKey && e.shiftKey))) return;
    if (mod && !e.altKey) {
      if (k === 's') { e.preventDefault(); var st = active(); if (st && st.kind === 'text' && !st.dirty) status('Already saved.'); save(st); return; }
      if (k === 'p' && !e.shiftKey) { e.preventDefault(); quickOpen(); return; }
      if ((k === 'p' && e.shiftKey) || (k === 'k' && !e.shiftKey)) { e.preventDefault(); palette(); return; }
      if (k === 'f' && e.shiftKey) { e.preventDefault(); app.showView('search', true); return; }
      if (k === 'e' && e.shiftKey) { e.preventDefault(); app.showView('files', true); return; }
      if (k === 'g' && e.shiftKey) { e.preventDefault(); app.showView('git', true); return; }
      if (k === 'o' && e.shiftKey) { e.preventDefault(); gotoSymbol(); return; }
      if (k === 'm' && e.shiftKey) { e.preventDefault(); showPanel('problems'); return; }
      if (k === 'v' && e.shiftKey) { e.preventDefault(); togglePreview(); return; }
      if (k === 'f') { e.preventDefault(); openFind(); return; }
      if (k === 'h' && !MAC) { e.preventDefault(); openFind(null, true); return; }
      if (k === 'h' && MAC && e.altKey) { e.preventDefault(); openFind(null, true); return; }
      if (k === 'g') { e.preventDefault(); goLine(); return; }
      if (k === 'e' && !e.shiftKey) { e.preventDefault(); editWithEmber(); return; }
      if (k === 'Enter') { e.preventDefault(); run(); return; }
      if (k === 'b') { e.preventDefault(); toggle('side'); return; }
      if (k === 'j') { e.preventDefault(); toggle('panel'); return; }
      if (k === 'i' && !e.shiftKey) { e.preventDefault(); toggle('help'); return; }
      if (k === '\\') { e.preventDefault(); if (groups.length > 1) unsplit(1); else split(); return; }
      if (k === ',') { e.preventDefault(); settingsBox(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); setSetting('size', Math.min(24, (settings.size || 14) + 1)); return; }
      if (k === '-') { e.preventDefault(); setSetting('size', Math.max(11, (settings.size || 14) - 1)); return; }
    }
    if (e.key === 'F5') { e.preventDefault(); run(); return; }
    if (e.key === 'F1') { e.preventDefault(); palette(); return; }
    if (e.key === 'F8') { e.preventDefault(); nextProblem(e.shiftKey ? -1 : 1); return; }
    if (e.altKey && !mod && e.code === 'KeyN') { e.preventDefault(); newFile(false); return; }
    if (e.altKey && !mod && e.code === 'KeyW') { e.preventDefault(); if (G().active) close(G(), G().active); return; }
    if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) { e.preventDefault(); var n = +e.code.slice(5) - 1; if (G().tabs[n]) activate(G(), G().tabs[n]); return; }
    if (!inField && e.target.tagName !== 'TEXTAREA' && e.key === '?') { e.preventDefault(); keysBox(); }
  }, true);

  // ── news from den: files changing, programs running, terminals ──────
  var fsTimer = null, changed = new Set();
  function connect() {
    var es = new EventSource('api/events'), fails = 0;
    es.onmessage = function (msg) {
      fails = 0;
      var ev; try { ev = JSON.parse(msg.data); } catch (e) { return; }
      if (ev.t === 'hello') { if (ev.running) onRun({ t: 'start', id: ev.running.id, label: ev.running.label, file: false }); }
      else if (ev.t === 'fs') {
        ev.paths.forEach(function (p) { changed.add(p); });
        clearTimeout(fsTimer);
        fsTimer = setTimeout(function () {
          var ps = Array.from(changed); changed.clear();
          files = null;
          app.fire('fs', ps);
          ps.forEach(function (p) { var m = models[p]; if (m && !m.saving) reload(m); });
        }, 250);
      } else if (ev.t === 'term' || ev.t === 'term-end') app.fire(ev.t, ev);
      else onRun(ev);
    };
    es.onerror = function () {
      fails++;
      if (fails > 3) { es.close(); fetch('api/state').then(function (r) { if (r.ok) { setTimeout(connect, 1000); } else lost(); }).catch(lost); }
    };
  }
  window.addEventListener('focus', function () { if (alive) { app.fire('fs', []); eachModel(function (m) { if (!m.saving) reload(m); }); } });

  // ── off we go ───────────────────────────────────────────────────────
  app.activate = activate;
  app.split = split;
  app.history = history;
  app.showDiff = showDiff;
  app.openFind = openFind;
  app.quickOpen = quickOpen;
  app.editor = editor;
  app.bin = bin;
  app.isRunning = function () { return !!running; };
  icons(document);
  $('folderName').textContent = C.name;
  $('folderBtn').title = C.where;
  makeGroup(0);
  applySettings();
  layout();
  drawPanelActs();
  showPanel(panelNow === 'terminal' ? 'console' : panelNow);
  ember.say('Hi! Open a file on the left, or start from an example.');
  drawWhat();
  drawRun();
  checkAi();
  connect();
  app.ready = function () {
    var want = (location.hash.match(/open=([^&]+)/) || [])[1];
    var saved = mem.groups || (mem.tabs ? [{ tabs: mem.tabs, active: mem.active }] : []);
    var chain = Promise.resolve();
    saved.slice(0, 2).forEach(function (sg, gi) {
      (sg.tabs || []).slice(0, 12).forEach(function (p) {
        chain = chain.then(function () {
          if (gi === 1 && groups.length < 2) makeGroup(1);
          return load(p).then(function (m) { if (m && !m.error && groups[gi].tabs.indexOf(m.path) < 0) groups[gi].tabs.push(m.path); });
        }).catch(function () {});
      });
    });
    chain.then(function () {
      groups.forEach(function (g, gi) {
        var sg = saved[gi] || {};
        if (gi === 1 && !g.tabs.length) { unsplit(1); return; }
        activate(g, g.tabs.indexOf(sg.active) >= 0 ? sg.active : g.tabs[0] || null);
      });
      groups.forEach(function (g) { g.el.classList.toggle('focused', g.i === focusG && groups.length > 1); });
      if (want) return open(decodeURIComponent(want));
    });
  };
  window.addEventListener('resize', function () { groups.forEach(function (g) { if (g.editor.doc) g.editor.render(); }); app.fire('layout'); });
})();
