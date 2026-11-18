// den's editor: a plain textarea you type in (so copy, paste, undo and
// typing in any language all work like everywhere else) over a coloured copy
// of the same text. Each open file keeps its own textarea, so each keeps its
// own undo. Around it: line numbers with change bars, indent guides, matching
// brackets, other uses of the word you're on, squiggles under mistakes, and a
// minimap of the whole file.
(function (root) {
  'use strict';
  var HL = root.HL;
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  var CLOSERS = { ')': 1, ']': 1, '}': 1, '"': 1, "'": 1, '`': 1 };
  var OPEN = { '(': ')', '[': ']', '{': '}' }, CLOSE = { ')': '(', ']': '[', '}': '{' };

  function Editor(host, hooks) {
    this.host = host;
    this.hooks = hooks || {};
    this.doc = null;
    host.classList.add('editor');
    host.innerHTML = '<div class="gutter"><div class="gin"></div></div>' +
      '<div class="view"><div class="layer"><div class="curline"></div><div class="guides"></div><div class="marks"></div><pre class="hl"></pre><div class="squig"></div></div><div class="complete" hidden></div></div>' +
      '<canvas class="mini" aria-hidden="true"></canvas><span class="measure">' + '0'.repeat(100) + '</span>';
    this.gutter = host.querySelector('.gin');
    this.view = host.querySelector('.view');
    this.layer = host.querySelector('.layer');
    this.pre = host.querySelector('pre.hl');
    this.cur = host.querySelector('.curline');
    this.marks = host.querySelector('.marks');
    this.guides = host.querySelector('.guides');
    this.squig = host.querySelector('.squig');
    this.pop = host.querySelector('.complete');
    this.mini = host.querySelector('canvas.mini');
    this.measure = host.querySelector('.measure');
    this.lh = 20; this.cw = 8; this.pad = { t: 8, l: 12 };
    this.find = null; // { matches: [[start, end]], i }
    this.opts = { minimap: true, guides: true };
    this._raf = 0;
    var self = this;
    if (root.ResizeObserver) new ResizeObserver(function () {
      // a narrow editor (two side by side, or next to a preview) gives the map's room to the code
      host.classList.toggle('narrow', host.clientWidth < 560);
      self.metrics(); self.render();
    }).observe(host);
    this.miniDrag(this.mini);
  }

  Editor.prototype.setOptions = function (o) {
    for (var k in o) this.opts[k] = o[k];
    this.host.classList.toggle('no-mini', !this.opts.minimap);
    this.render(true);
  };

  Editor.prototype.metrics = function () {
    var r = this.measure.getBoundingClientRect();
    this.cw = r.width / 100 || 8;
    this.lh = r.height || 20;
    this._colors = null;
  };

  /** A new document (one per open file and group). */
  Editor.prototype.make = function (text, opts) {
    var ta = document.createElement('textarea');
    ta.className = 'ta';
    ta.spellcheck = false;
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('wrap', 'off');
    ta.setAttribute('aria-label', 'Code editor: ' + (opts.name || 'file'));
    ta.value = text;
    var doc = {
      ta: ta, lang: opts.lang || 'text', unit: opts.unit || 4, wrap: !!opts.wrap, readOnly: !!opts.readOnly,
      _text: null, _lines: null, _raw: null, _words: null, sel: [0, 0], top: 0, left: 0,
      problems: [], changes: null,
    };
    if (doc.readOnly) ta.readOnly = true;
    var self = this;
    ta.addEventListener('scroll', function () { if (self.doc === doc) self.sync(); });
    ta.addEventListener('input', function (e) { if (self.doc === doc) self.changed(e); });
    ta.addEventListener('keydown', function (e) { if (self.doc === doc) self.key(e); });
    ta.addEventListener('keyup', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('mouseup', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('select', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('focus', function () { if (self.doc === doc && self.hooks.focus) self.hooks.focus(self); });
    ta.addEventListener('blur', function () { if (self.doc === doc) setTimeout(function () { self.hidePop(); }, 150); });
    ta.addEventListener('mousemove', function (e) { if (self.doc === doc && self.hooks.hover) self.hooks.hover(e, self.posFromPoint(e.clientX, e.clientY)); });
    ta.addEventListener('mouseleave', function () { if (self.doc === doc && self.hooks.hover) self.hooks.hover(null, null); });
    return doc;
  };

  /** Show a document in the editor (and remember where the last one was). */
  Editor.prototype.show = function (doc) {
    if (this.doc && this.doc !== doc) {
      this.doc.sel = [this.doc.ta.selectionStart, this.doc.ta.selectionEnd];
      this.doc.top = this.doc.ta.scrollTop; this.doc.left = this.doc.ta.scrollLeft;
      if (this.doc.ta.parentNode === this.view) this.view.removeChild(this.doc.ta);
    }
    this.doc = doc;
    this.find = null;
    this.hidePop();
    if (!doc) { this.pre.innerHTML = ''; this.gutter.innerHTML = ''; this.guides.innerHTML = ''; this.marks.innerHTML = ''; this.squig.innerHTML = ''; return; }
    if (doc.ta.parentNode && doc.ta.parentNode !== this.view) doc.ta.parentNode.removeChild(doc.ta);
    this.view.appendChild(doc.ta);
    this.setWrap(doc.wrap);
    this.metrics();
    doc.ta.setSelectionRange(doc.sel[0], doc.sel[1]);
    doc.ta.scrollTop = doc.top; doc.ta.scrollLeft = doc.left;
    this._lastLine = -1;
    this.render(true);
    this.moved();
  };

  Editor.prototype.setWrap = function (on) {
    var d = this.doc;
    if (!d) return;
    d.wrap = on && d.ta.value.length < 400000;
    this.host.classList.toggle('wrap', d.wrap);
    d.ta.setAttribute('wrap', d.wrap ? 'soft' : 'off');
    this.render(true);
  };

  Editor.prototype.focus = function () { if (this.doc) this.doc.ta.focus({ preventScroll: true }); };

  // ── drawing ──────────────────────────────────────────────────────────
  Editor.prototype.lines = function () {
    var d = this.doc, t = d.ta.value;
    if (d._text === t) return d._lines;
    var quick = d._lines && t.length > 40000 && this.patch(d, t);
    if (!quick) { d._lines = HL.highlight(t, d.lang); d._raw = t.split('\n'); }
    d._text = t;
    d._wordsOld = true;
    return d._lines;
  };

  /**
   * Big files: colour just the lines you changed straight away, and the whole
   * file again once you pause (so typing stays quick).
   */
  Editor.prototype.patch = function (d, t) {
    var old = d._text, n = Math.min(old.length, t.length), a = 0;
    while (a < n && old.charCodeAt(a) === t.charCodeAt(a)) a++;
    var z = 0;
    while (z < n - a && old.charCodeAt(old.length - 1 - z) === t.charCodeAt(t.length - 1 - z)) z++;
    var ls = old.lastIndexOf('\n', a - 1) + 1;
    var oldEnd = old.indexOf('\n', old.length - z); if (oldEnd < 0) oldEnd = old.length;
    var newEnd = t.indexOf('\n', t.length - z); if (newEnd < 0) newEnd = t.length;
    var oldPart = old.slice(ls, oldEnd), newPart = t.slice(ls, newEnd);
    if (oldPart.split('\n').length > 4 || newPart.split('\n').length > 4) return false;
    var first = old.slice(0, ls).split('\n').length - 1, gone = oldPart.split('\n').length;
    var fresh = HL.highlight(newPart, d.lang), raw = newPart.split('\n');
    d._lines = d._lines.slice(0, first).concat(fresh, d._lines.slice(first + gone));
    d._raw = d._raw.slice(0, first).concat(raw, d._raw.slice(first + gone));
    var self = this;
    clearTimeout(d._full);
    d._full = setTimeout(function () { d._text = null; if (self.doc === d) self.render(); }, 450);
    return true;
  };

  Editor.prototype.changed = function (e) {
    var self = this;
    this.hooks.change && this.hooks.change(this.doc, this);
    if (!this._raf) this._raf = requestAnimationFrame(function () { self._raf = 0; self.render(); self.moved(); });
    if (e && e.inputType === 'insertText' && e.data && /[\w$-]/.test(e.data)) this.suggest();
    else if (e && e.inputType !== 'insertText') this.hidePop();
  };

  /** Keep the coloured copy and the line numbers lined up with the scrolled text. */
  Editor.prototype.place = function () {
    var ta = this.doc.ta;
    this.layer.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
    this.gutter.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  };

  Editor.prototype.sync = function () {
    var ta = this.doc.ta;
    this.place();
    if (!this.doc.wrap && this._win) {
      var first = Math.floor(ta.scrollTop / this.lh), last = first + Math.ceil(ta.clientHeight / this.lh);
      var n = this.doc._lines ? this.doc._lines.length : 0;
      if ((this._win[0] > 0 && first < this._win[0] + 20) || (this._win[1] < n && last > this._win[1] - 20)) this.render();
    }
    if (this._mini && this._mini.n * this._mini.lh > this._mini.H) this.drawMini(); // a long file's map scrolls too
    else this.drawMiniView();
    this.hidePop();
    if (this.hooks.scroll) this.hooks.scroll(this);
  };

  Editor.prototype.render = function (force) {
    var d = this.doc;
    if (!d) return;
    var lines = this.lines(), ta = d.ta, lh = this.lh, n = lines.length;
    var cur = this.caretLine();
    var html = '', gut = '';
    var ch = d.changes || { map: {}, dels: [] }, dels = {};
    (ch.dels || []).forEach(function (x) { dels[x] = 1; });
    var bad = {};
    (d.problems || []).forEach(function (p) { bad[p.line - 1] = p.warn ? (bad[p.line - 1] || 'gw') : 'ge'; });
    var gcls = function (k) {
      var c = [];
      if (k === cur) c.push('on');
      if (ch.map[k]) c.push(ch.map[k] === 'add' ? 'ga' : 'gm');
      if (dels[k]) c.push('gd');
      if (bad[k]) c.push(bad[k]);
      return c.length ? ' class="' + c.join(' ') + '"' : '';
    };
    if (d.wrap) {
      this.pre.style.width = ta.clientWidth + 'px';
      for (var i = 0; i < n; i++) html += '<div class="l">' + (lines[i] || ' ') + '</div>';
      this.pre.innerHTML = html;
      var kids = this.pre.children;
      for (var k = 0; k < n; k++) gut += '<div style="height:' + kids[k].offsetHeight + 'px"' + gcls(k) + '>' + (k + 1) + '</div>';
      this.gutter.innerHTML = '<div style="height:' + this.pad.t + 'px"></div>' + gut;
      this._win = null;
      this.guides.innerHTML = '';
    } else {
      this.pre.style.width = '';
      var first = Math.max(0, Math.floor(ta.scrollTop / lh) - 60);
      var last = Math.min(n, Math.ceil((ta.scrollTop + ta.clientHeight) / lh) + 60);
      this._win = [first, last];
      for (var j = first; j < last; j++) {
        html += '<div class="l">' + (lines[j] || ' ') + '</div>';
        gut += '<div' + gcls(j) + '>' + (j + 1) + '</div>';
      }
      this.pre.innerHTML = '<div style="height:' + (first * lh) + 'px"></div>' + html;
      this.gutter.innerHTML = '<div style="height:' + (this.pad.t + first * lh) + 'px"></div>' + gut;
      this.drawGuides(first, last);
    }
    var gw = (String(n).length + 3) + 'ch';
    if (this._gw !== gw) { this._gw = gw; this.host.style.setProperty('--gutter', gw); } // (only when it changes: it restyles everything inside)
    this.drawCur();
    this.drawMarks();
    this.drawSquig();
    this.place();
    this.drawMini();
  };

  /** Faint lines showing how deep each line is indented. */
  Editor.prototype.drawGuides = function (first, last) {
    var d = this.doc;
    if (!this.opts.guides || d.wrap) { this.guides.innerHTML = ''; return; }
    var raw = d._raw, unit = d.unit || 4, cw = this.cw, lh = this.lh, html = '';
    var depth = function (l) {
      var n = 0;
      for (var i = 0; i < l.length; i++) { if (l[i] === ' ') n++; else if (l[i] === '\t') n += unit - (n % unit); else return n; }
      return -1; // blank
    };
    var level = function (i) {
      var v = depth(raw[i] || '');
      if (v >= 0) return v;
      // a blank line takes the depth of the lines around it
      var a = -1, b = -1;
      for (var p = i - 1; p >= 0 && p > i - 200; p--) { a = depth(raw[p]); if (a >= 0) break; }
      for (var q = i + 1; q < raw.length && q < i + 200; q++) { b = depth(raw[q]); if (b >= 0) break; }
      return Math.max(0, Math.min(a < 0 ? 0 : a, b < 0 ? 0 : b));
    };
    for (var i = first; i < last; i++) {
      var levels = Math.floor(level(i) / unit);
      if (levels <= 0) continue;
      html += '<i style="top:' + (this.pad.t + i * lh) + 'px;height:' + lh + 'px;width:' + (levels * unit * cw) + 'px;background-size:' + (unit * cw) + 'px 100%"></i>';
    }
    this.guides.style.left = this.pad.l + 'px';
    this.guides.innerHTML = html;
  };

  Editor.prototype.lineTop = function (line) {
    if (!this.doc.wrap) return { top: this.pad.t + line * this.lh, h: this.lh };
    var el = this.pre.children[line];
    return el ? { top: el.offsetTop, h: el.offsetHeight } : { top: 0, h: this.lh };
  };

  Editor.prototype.drawCur = function () {
    var p = this.lineTop(this.caretLine());
    this.cur.style.top = p.top + 'px';
    this.cur.style.height = p.h + 'px';
  };

  /** Column on screen (tabs count as several). */
  Editor.prototype.vcol = function (lineText, col) {
    var n = 0, tab = this.doc.unit || 4;
    for (var i = 0; i < col; i++) n = lineText[i] === '\t' ? n + tab - (n % tab) : n + 1;
    return n;
  };

  /** A box around text from position a to b on one line. */
  Editor.prototype.box = function (a, b, cls, starts) {
    var t = this.doc.ta.value, line = this.lineAt(a, starts), ls = starts[line];
    var le = t.indexOf('\n', ls); if (le < 0) le = t.length;
    var lt = t.slice(ls, le);
    var x = this.pad.l + this.vcol(lt, a - ls) * this.cw;
    var w = Math.max(2, (this.vcol(lt, Math.min(b, le) - ls) - this.vcol(lt, a - ls)) * this.cw);
    return '<i class="' + cls + '" style="left:' + x + 'px;top:' + (this.pad.t + line * this.lh) + 'px;width:' + w + 'px;height:' + this.lh + 'px"></i>';
  };

  Editor.prototype.drawMarks = function () {
    var f = this.find, d = this.doc;
    if (d.wrap) { this.marks.innerHTML = ''; return; }
    var html = '', win = this._win || [0, Infinity], starts = this.lineStarts(), self = this;
    var inWin = function (pos) { var l = self.lineAt(pos, starts); return l >= win[0] && l <= win[1]; };
    if (f && f.matches.length) {
      for (var k = 0; k < f.matches.length; k++) {
        var m = f.matches[k];
        if (inWin(m[0])) html += this.box(m[0], m[1], k === f.i ? 'now' : 'hit', starts);
      }
    }
    // other places the word you're on is used
    if (!f && d._same) d._same.forEach(function (m) { if (inWin(m[0])) html += self.box(m[0], m[1], 'same', starts); });
    if (d._pair) d._pair.forEach(function (p) { html += self.box(p, p + 1, 'pair', starts); });
    this.marks.innerHTML = html;
  };

  /** Squiggly underlines under the mistakes den found. */
  Editor.prototype.drawSquig = function () {
    var d = this.doc;
    if (d.wrap || !d.problems || !d.problems.length) { this.squig.innerHTML = ''; return; }
    var raw = d._raw || d.ta.value.split('\n'), html = '', self = this;
    d.problems.forEach(function (p) {
      var li = Math.max(0, Math.min(raw.length - 1, p.line - 1)), lt = raw[li] || '';
      var c = Math.max(0, Math.min(lt.length, (p.col || 1) - 1));
      var end = c;
      while (end < lt.length && /[\w$]/.test(lt[end])) end++;
      if (end === c) end = Math.min(lt.length, c + 1);
      if (end === c && c > 0) c--; // past the end of the line: underline the last thing on it
      var x = self.pad.l + self.vcol(lt, c) * self.cw, w = Math.max(self.cw, (self.vcol(lt, end) - self.vcol(lt, c)) * self.cw);
      html += '<i class="' + (p.warn ? 'w' : 'e') + '" style="left:' + x + 'px;top:' + (self.pad.t + (li + 1) * self.lh - 4) + 'px;width:' + w + 'px"></i>';
    });
    this.squig.innerHTML = html;
  };

  Editor.prototype.setProblems = function (doc, list) {
    doc.problems = list || [];
    if (this.doc === doc) { this.render(); }
  };
  Editor.prototype.setChanges = function (doc, marks) {
    doc.changes = marks;
    if (this.doc === doc) this.render();
  };

  Editor.prototype.lineStarts = function () {
    var t = this.doc.ta.value;
    if (this._lsText === t) return this._ls;
    var out = [0];
    for (var i = t.indexOf('\n'); i >= 0; i = t.indexOf('\n', i + 1)) out.push(i + 1);
    this._lsText = t; this._ls = out;
    return out;
  };
  Editor.prototype.lineAt = function (pos, starts) {
    var lo = 0, hi = starts.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo;
  };

  // ── the minimap ──────────────────────────────────────────────────────
  Editor.prototype.tokenColors = function () {
    if (this._colors) return this._colors;
    var probe = document.createElement('span'), out = {};
    this.pre.appendChild(probe);
    ['', 'kw', 'str', 'num', 'com', 'fn', 'def', 'type', 'builtin', 'deco', 'tag', 'prop', 'punct', 'attr', 'class', 'var', 'head', 'em'].forEach(function (c) {
      probe.className = c;
      out[c] = getComputedStyle(probe).color;
    });
    this.pre.removeChild(probe);
    this._colors = out;
    return out;
  };

  Editor.prototype.drawMini = function () {
    var d = this.doc, cv = this.mini;
    if (!d || !this.opts.minimap || d.wrap || this.host.classList.contains('narrow')) { cv.style.display = 'none'; return; }
    cv.style.display = '';
    var self = this;
    if (this._miniTimer) return;
    this._miniTimer = setTimeout(function () { self._miniTimer = 0; self.paintMini(); }, d._miniAt ? 120 : 0);
  };

  Editor.prototype.paintMini = function () {
    var d = this.doc, cv = this.mini;
    if (!d || cv.style.display === 'none') return;
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var c = cv.getContext('2d'), lines = this.lines(), n = lines.length, ta = d.ta;
    // short files fit whole; long ones get 2 pixels a line, and the map scrolls with you
    var lh = n * 2 <= H ? Math.min(3, H / Math.max(1, n)) : 2, cw = Math.min(1.25, (W - 6) / 90), colors = this.tokenColors();
    var room = Math.max(1, ta.scrollHeight - ta.clientHeight), off = n * lh > H ? Math.round((ta.scrollTop / room) * (n * lh - H)) : 0;
    this._mini = { lh: lh, n: n, H: H, off: off };
    c.setTransform(dpr, 0, 0, dpr, 0, -off * dpr);
    c.clearRect(0, off, W, H);
    var re = /<span class="([\w ]+)">([^<]*)<\/span>|([^<]+)/g, ent = /&(lt|gt|amp|quot|#39);/g;
    var step = 1, from = Math.max(0, Math.floor(off / lh)), to = Math.min(n, Math.ceil((off + H) / lh) + 1);
    c.globalAlpha = 0.75;
    for (var i = from; i < to; i += step) {
      var s = lines[i], x = 4, m;
      if (!s) continue;
      re.lastIndex = 0;
      while ((m = re.exec(s)) && x < W) {
        var text = (m[2] !== undefined ? m[2] : m[3]).replace(ent, '_');
        var cls = m[1] ? m[1].split(' ')[0] : '';
        // runs of letters as little bars, spaces as gaps
        var start = -1;
        for (var j = 0; j <= text.length; j++) {
          var ws = j === text.length || text[j] === ' ' || text[j] === '\t';
          if (!ws && start < 0) start = j;
          if (ws && start >= 0) {
            c.fillStyle = colors[cls] || colors[''];
            c.fillRect(x + start * cw, i * lh, (j - start) * cw, Math.max(0.6, lh * 0.8));
            start = -1;
          }
        }
        x += text.length * cw;
      }
    }
    c.globalAlpha = 1;
    // changes on the left edge, mistakes and find matches on the right
    var ch = d.changes;
    if (ch && ch.map) for (var k in ch.map) { c.fillStyle = ch.map[k] === 'add' ? '#5ec27a' : '#5aa2f0'; c.fillRect(0, k * lh, 2, Math.max(2, lh)); }
    (d.problems || []).forEach(function (p) { c.fillStyle = p.warn ? '#e9c46a' : '#ff5f6d'; c.fillRect(W - 4, (p.line - 1) * lh - 1, 4, Math.max(3, lh + 1)); });
    if (this.find && this.find.matches.length) {
      var starts = this.lineStarts(), self = this;
      c.fillStyle = '#ffd25a';
      this.find.matches.slice(0, 2000).forEach(function (mm) { c.fillRect(W - 8, self.lineAt(mm[0], starts) * lh, 3, Math.max(2, lh)); });
    }
    d._miniAt = Date.now();
    this.drawMiniView();
  };

  Editor.prototype.drawMiniView = function () {
    var d = this.doc, m = this._mini;
    if (!d || !m) return;
    var ta = d.ta, total = Math.max(1, m.n * this.lh);
    var top = (ta.scrollTop / this.lh) * m.lh - (m.off || 0), h = Math.max(8, (ta.clientHeight / this.lh) * m.lh);
    // the box showing what's on screen, drawn by the canvas's neighbour (see den.css)
    var box = this._mvBox || (this._mvBox = this.host.appendChild(document.createElement('i')));
    box.className = 'mview';
    box.style.top = top + 'px';
    box.style.height = Math.min(h, m.H) + 'px';
    void total;
  };

  Editor.prototype.miniDrag = function (cv) {
    var self = this;
    var go = function (e) {
      var m = self._mini, d = self.doc;
      if (!m || !d) return;
      var r = cv.getBoundingClientRect(), y = e.clientY - r.top;
      var line = (y + (m.off || 0)) / m.lh;
      d.ta.scrollTop = Math.max(0, line * self.lh - d.ta.clientHeight / 2);
    };
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      go(e);
      var mv = function (ev) { go(ev); };
      var up = function () { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); self.focus(); };
      cv.addEventListener('pointermove', mv);
      cv.addEventListener('pointerup', up);
    });
    cv.addEventListener('wheel', function (e) { if (self.doc) { self.doc.ta.scrollTop += e.deltaY; e.preventDefault(); } }, { passive: false });
  };

  // ── where the caret is ───────────────────────────────────────────────
  Editor.prototype.caretLine = function () {
    var ta = this.doc.ta, t = ta.value, p = ta.selectionStart, n = 0;
    for (var i = t.indexOf('\n'); i >= 0 && i < p; i = t.indexOf('\n', i + 1)) n++;
    return n;
  };
  Editor.prototype.pos = function () {
    var ta = this.doc.ta, t = ta.value, p = ta.selectionStart;
    var line = this.caretLine(), ls = t.lastIndexOf('\n', p - 1) + 1;
    return { line: line + 1, col: p - ls + 1, sel: Math.abs(ta.selectionEnd - ta.selectionStart), lines: this.lineStarts().length };
  };
  /** Which line and column is under the mouse (not for wrapped text). */
  Editor.prototype.posFromPoint = function (x, y) {
    var d = this.doc;
    if (!d || d.wrap) return null;
    var r = this.view.getBoundingClientRect();
    var line = Math.floor((y - r.top + d.ta.scrollTop - this.pad.t) / this.lh);
    var vc = Math.floor((x - r.left + d.ta.scrollLeft - this.pad.l) / this.cw);
    if (line < 0) return null;
    return { line: line + 1, col: vc + 1 };
  };
  /** The word the caret is in (for "What's this?"). */
  Editor.prototype.word = function () {
    var r = this.wordRange();
    return r ? this.doc.ta.value.slice(r[0], r[1]) : '';
  };
  Editor.prototype.wordRange = function () {
    var ta = this.doc.ta, t = ta.value, p = ta.selectionStart;
    var re = this.doc.lang === 'css' || this.doc.lang === 'html' ? /[\w-]/ : /[\w$]/;
    var a = p, b = p;
    while (a > 0 && re.test(t[a - 1])) a--;
    while (b < t.length && re.test(t[b])) b++;
    return b > a ? [a, b] : null;
  };
  Editor.prototype.selection = function () {
    var ta = this.doc.ta;
    return ta.value.slice(ta.selectionStart, ta.selectionEnd);
  };
  Editor.prototype.moved = function () {
    if (!this.doc) return;
    var line = this.caretLine();
    if (line !== this._lastLine) {
      this._lastLine = line;
      this.drawCur();
      var on = this.gutter.querySelector('.on'); if (on) on.classList.remove('on');
      var first = this._win ? this._win[0] : 0;
      var g = this.gutter.children[line - first + 1];
      if (g) g.classList.add('on');
    }
    this.findSame();
    this.findPair();
    this.drawMarks();
    this.hooks.cursor && this.hooks.cursor(this.doc, this);
  };

  /** Other uses of the word you're on. */
  Editor.prototype.findSame = function () {
    var d = this.doc, ta = d.ta;
    d._same = null;
    if (ta.selectionStart !== ta.selectionEnd || d.lang === 'text' || d.lang === 'markdown') return;
    var r = this.wordRange();
    if (!r || r[1] - r[0] < 2 || /^\d/.test(ta.value[r[0]])) return;
    var w = ta.value.slice(r[0], r[1]), t = ta.value, out = [];
    var esc = w.replace(/[$]/g, '\\$');
    var re = new RegExp('(^|[^\\w$' + (d.lang === 'css' || d.lang === 'html' ? '-' : '') + '])(' + esc + ')(?![\\w$])', 'g'), m;
    while ((m = re.exec(t)) && out.length < 400) { var s = m.index + m[1].length; out.push([s, s + w.length]); }
    if (out.length > 1) d._same = out;
  };

  /** The bracket that goes with the one next to the caret. */
  Editor.prototype.findPair = function () {
    var d = this.doc, ta = d.ta, t = ta.value, p = ta.selectionStart;
    d._pair = null;
    if (ta.selectionStart !== ta.selectionEnd) return;
    var at = OPEN[t[p]] || CLOSE[t[p]] ? p : OPEN[t[p - 1]] || CLOSE[t[p - 1]] ? p - 1 : -1;
    if (at < 0) return;
    var ch = t[at], dir = OPEN[ch] ? 1 : -1, want = OPEN[ch] || CLOSE[ch], depth = 0;
    for (var i = at, steps = 0; i >= 0 && i < t.length && steps < 30000; i += dir, steps++) {
      if (t[i] === ch) depth++;
      else if (t[i] === want) { depth--; if (depth === 0) { d._pair = [at, i]; return; } }
    }
  };

  /** Jump to a line (and column), and put it in view. */
  Editor.prototype.go = function (line, col, len) {
    var ta = this.doc.ta, starts = this.lineStarts();
    var l = Math.max(0, Math.min(starts.length - 1, (line || 1) - 1));
    var p = Math.min(ta.value.length, starts[l] + Math.max(0, (col || 1) - 1));
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(p, p + (len || 0));
    this.reveal(l);
    this.moved();
  };
  Editor.prototype.reveal = function (line) {
    var ta = this.doc.ta, p = this.lineTop(line);
    if (p.top < ta.scrollTop + this.lh || p.top + p.h > ta.scrollTop + ta.clientHeight - this.lh) ta.scrollTop = Math.max(0, p.top - ta.clientHeight / 3);
    this.render();
  };

  // ── typing helpers ───────────────────────────────────────────────────
  /** Replace part of the text the way typing would, so undo works. */
  Editor.prototype.put = function (start, end, text, selA, selB) {
    var ta = this.doc.ta;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    var ok = false;
    try { ok = document.execCommand(text ? 'insertText' : 'delete', false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, start, end, 'end'); this.changed(); }
    if (selA !== undefined) ta.setSelectionRange(selA, selB === undefined ? selA : selB);
  };

  Editor.prototype.indentOf = function (line) { return (line.match(/^[ \t]*/) || [''])[0]; };
  Editor.prototype.unitText = function () { return ' '.repeat(this.doc.unit || 4); };

  /** Indent or outdent every line the selection touches. */
  Editor.prototype.shiftLines = function (out) {
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var b = e > s && t[e - 1] === '\n' ? e - 1 : e;
    var z = t.indexOf('\n', b); z = z < 0 ? t.length : z;
    var unit = this.unitText(), lines = t.slice(a, z).split('\n'), first = 0, total = 0;
    var out2 = lines.map(function (l, i) {
      var d;
      if (out) {
        var m = l.match(new RegExp('^( {1,' + unit.length + '}|\\t)'));
        d = m ? -m[0].length : 0;
        l = m ? l.slice(m[0].length) : l;
      } else if (l.length || lines.length === 1) { l = unit + l; d = unit.length; } else d = 0;
      if (i === 0) first = d;
      total += d;
      return l;
    }).join('\n');
    this.put(a, z, out2, Math.max(a, s + first), e + total);
  };

  Editor.prototype.toggleComment = function () {
    var c = HL.COMMENT[this.doc.lang];
    if (!c) return;
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var b = e > s && t[e - 1] === '\n' ? e - 1 : e;
    var z = t.indexOf('\n', b); z = z < 0 ? t.length : z;
    var block = t.slice(a, z), out;
    if (Array.isArray(c)) {
      var trimmed = block.trim();
      if (trimmed.startsWith(c[0]) && trimmed.endsWith(c[1])) out = block.replace(c[0] + ' ', '').replace(c[0], '').replace(new RegExp(' ?' + c[1].replace(/[*]/g, '\\*') + '(\\s*)$'), '$1');
      else { var ind = this.indentOf(block); out = ind + c[0] + ' ' + block.slice(ind.length) + ' ' + c[1]; }
    } else {
      var lines = block.split('\n');
      var all = lines.every(function (l) { return !l.trim() || l.trim().startsWith(c); });
      var min = Math.min.apply(null, lines.filter(function (l) { return l.trim(); }).map(function (l) { return l.match(/^\s*/)[0].length; }).concat([1e9]));
      out = lines.map(function (l) {
        if (!l.trim()) return l;
        if (all) return l.replace(new RegExp('^(\\s*)' + c.replace(/[-/]/g, '\\$&') + ' ?'), '$1');
        return l.slice(0, min) + c + ' ' + l.slice(min);
      }).join('\n');
    }
    this.put(a, z, out, a, a + out.length);
  };

  /** Move the selected lines up or down one. */
  Editor.prototype.moveLines = function (dir) {
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var b = e > s && t[e - 1] === '\n' ? e - 1 : e;
    var z = t.indexOf('\n', b); z = z < 0 ? t.length : z;
    var block = t.slice(a, z);
    if (dir < 0) {
      if (a === 0) return;
      var pa = t.lastIndexOf('\n', a - 2) + 1, prev = t.slice(pa, a - 1);
      this.put(pa, z, block + '\n' + prev, s - (a - pa), e - (a - pa));
    } else {
      if (z >= t.length) return;
      var nz = t.indexOf('\n', z + 1); nz = nz < 0 ? t.length : nz;
      var next = t.slice(z + 1, nz);
      this.put(a, nz, next + '\n' + block, s + next.length + 1, e + next.length + 1);
    }
  };

  /** Copy the selected lines (or this line) above or below. */
  Editor.prototype.copyLines = function (dir) {
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var b = e > s && t[e - 1] === '\n' ? e - 1 : e;
    var z = t.indexOf('\n', b); z = z < 0 ? t.length : z;
    var block = t.slice(a, z);
    if (dir > 0) this.put(z, z, '\n' + block, s + block.length + 1, e + block.length + 1);
    else this.put(a, a, block + '\n', s, e);
  };

  Editor.prototype.deleteLines = function () {
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var z = t.indexOf('\n', e); z = z < 0 ? t.length : z + 1;
    if (z === t.length && a > 0) a--;
    this.put(a, z, '', a);
  };

  /** Select the word you're on, or (pressed again) the next place it's used. */
  Editor.prototype.selectNext = function () {
    var ta = this.doc.ta, t = ta.value;
    if (ta.selectionStart === ta.selectionEnd) { var r = this.wordRange(); if (r) ta.setSelectionRange(r[0], r[1]); this.moved(); return; }
    var w = t.slice(ta.selectionStart, ta.selectionEnd);
    var i = t.indexOf(w, ta.selectionEnd);
    if (i < 0) i = t.indexOf(w);
    if (i >= 0) { ta.setSelectionRange(i, i + w.length); this.reveal(this.lineAt(i, this.lineStarts())); this.moved(); }
  };

  Editor.prototype.key = function (e) {
    var d = this.doc, ta = d.ta;
    if (d.readOnly) return;
    var mod = MAC ? e.metaKey : e.ctrlKey;
    var s = ta.selectionStart, en = ta.selectionEnd, t = ta.value;
    // suggestions
    if (this.popOpen()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.popMove(e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && this._popMoved)) { e.preventDefault(); this.popAccept(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.hidePop(); return; }
    }
    if (mod && e.key === '/') { e.preventDefault(); this.toggleComment(); return; }
    if (mod && (e.key === ']' || e.key === '[')) { e.preventDefault(); this.shiftLines(e.key === '['); return; }
    if (mod && e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); this.deleteLines(); return; }
    if (mod && !e.shiftKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); this.selectNext(); return; }
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); this.copyLines(e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); this.moveLines(e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      var lineStart = t.lastIndexOf('\n', s - 1) + 1;
      // "!" then Tab in an HTML file: a whole page to start from
      if (d.lang === 'html' && s === en && t.slice(lineStart, s).trim() === '!' && root.HELP) {
        this.put(lineStart, s, root.HELP.STARTERS.html.replace(/\n$/, ''));
        return;
      }
      if (e.shiftKey || t.slice(s, en).indexOf('\n') >= 0) { this.shiftLines(e.shiftKey); return; }
      var col = s - lineStart, unit = d.unit || 4;
      this.put(s, en, ' '.repeat(unit - (col % unit)));
      return;
    }
    if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      var ls = t.lastIndexOf('\n', s - 1) + 1, line = t.slice(ls, s), ind = this.indentOf(line);
      var before = line.replace(/\s+$/, ''), after = t[en], extra = '';
      if (/[{[(]$/.test(before) || (d.lang === 'python' && /:$/.test(before.replace(/#.*$/, '').trim())) || (d.lang === 'html' && /<(\w+)[^>]*>$/.test(before) && !/<\/|\/>$|<(br|img|input|meta|link|hr)\b/i.test(before))) extra = this.unitText();
      if (d.lang === 'python' && /^\s*(return|pass|break|continue|raise)\b/.test(line)) ind = ind.slice(0, Math.max(0, ind.length - (d.unit || 4)));
      var opener = before.slice(-1);
      if (extra && (PAIRS[opener] === after || (d.lang === 'html' && t.slice(en, en + 2) === '</'))) {
        var mid = '\n' + ind + extra, tail = '\n' + ind;
        this.put(s, en, mid + tail, s + mid.length);
        return;
      }
      var ins = '\n' + ind + extra;
      this.put(s, en, ins, s + ins.length);
      return;
    }
    if (e.key === 'Backspace' && s === en && s > 0 && !mod && !e.altKey) {
      var pr = t[s - 1], nx = t[s];
      if (PAIRS[pr] && PAIRS[pr] === nx) { e.preventDefault(); this.put(s - 1, s + 1, '', s - 1); return; }
      var lst = t.lastIndexOf('\n', s - 1) + 1, lead = t.slice(lst, s);
      if (lead.length && /^ +$/.test(lead)) {
        var u = d.unit || 4, cut = lead.length % u || u;
        if (cut > 1) { e.preventDefault(); this.put(s - cut, s, '', s - cut); return; }
      }
    }
    if (!mod && !e.altKey && e.key.length === 1) {
      var ch = e.key;
      // typing a closer that's already there: just step over it
      if (CLOSERS[ch] && s === en && t[s] === ch) {
        var over = ch === ')' || ch === ']' || ch === '}';
        if (!over) {
          // a quote: step over it when it closes a string that's open on this line
          var bef = t.slice(t.lastIndexOf('\n', s - 1) + 1, s).replace(/\\./g, '');
          over = (bef.split(ch).length - 1) % 2 === 1;
        }
        if (over) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); this.moved(); return; }
      }
      if (PAIRS[ch]) {
        var quote = ch === '"' || ch === "'" || ch === '`';
        if (s !== en && t.slice(s, en).indexOf('\n') < 0) { e.preventDefault(); this.put(s, en, ch + t.slice(s, en) + PAIRS[ch], s + 1, en + 1); return; }
        var nextc = t[en] || '', prevc = t[s - 1] || '';
        var free = !nextc || /[\s)\]};,:]/.test(nextc);
        if (quote && /[\w\\]/.test(prevc)) free = false; // don't, it's
        if (quote && d.lang === 'markdown') free = false;
        if (ch === "'" && (d.lang === 'html' || d.lang === 'text')) free = false;
        if (free) { e.preventDefault(); this.put(s, en, ch + PAIRS[ch], s + 1); this._auto = s + 1; return; }
      }
    }
  };

  // ── suggestions as you type ──────────────────────────────────────────
  Editor.prototype.words = function () {
    var d = this.doc;
    // the words in the file are gathered again at most every couple of seconds (it's slow on big files)
    if (!d._words || (d._wordsOld && Date.now() - (d._wordsAt || 0) > 2000)) {
      d._wordsOld = false;
      d._wordsAt = Date.now();
      var seen = Object.create(null), list = [];
      HL.keywords(d.lang).forEach(function (w) { if (!seen[w]) { seen[w] = 1; list.push(w); } });
      var re = d.lang === 'css' ? /[A-Za-z_-][\w-]{2,}/g : /[A-Za-z_$][\w$]{2,}/g, m, t = d.ta.value.slice(0, 300000), n = 0;
      while ((m = re.exec(t)) && n < 6000) { if (!seen[m[0]]) { seen[m[0]] = 1; list.push(m[0]); n++; } }
      d._words = list;
    }
    return d._words;
  };

  Editor.prototype.suggest = function () {
    var d = this.doc;
    if (d.wrap || d.lang === 'markdown' || d.lang === 'text') return this.hidePop();
    var ta = d.ta, t = ta.value, p = ta.selectionStart, a = p;
    var re = d.lang === 'css' ? /[\w-]/ : /[\w$]/;
    while (a > 0 && re.test(t[a - 1])) a--;
    var pre = t.slice(a, p);
    if (pre.length < 2 || /^\d/.test(pre) || /[\w$]/.test(t[p] || '')) return this.hidePop();
    var low = pre.toLowerCase();
    var list = this.words().filter(function (w) { return w !== pre && w.toLowerCase().indexOf(low) === 0; });
    list.sort(function (x, y) { return (y.indexOf(pre) === 0) - (x.indexOf(pre) === 0) || x.length - y.length; });
    list = list.slice(0, 7);
    if (!list.length) return this.hidePop();
    this._pop = { from: a, to: p, list: list, i: 0 };
    this._popMoved = false;
    var lineStart = t.lastIndexOf('\n', a - 1) + 1, line = this.caretLine();
    var x = this.pad.l + this.vcol(t.slice(lineStart, a + 200), a - lineStart) * this.cw - ta.scrollLeft;
    var y = this.pad.t + (line + 1) * this.lh - ta.scrollTop;
    this.pop.style.left = Math.max(0, Math.min(x, this.view.clientWidth - 220)) + 'px';
    this.pop.style.top = (y + 2 > this.view.clientHeight - 150 ? y - this.lh - 4 - list.length * this.lh * 1.15 : y + 2) + 'px';
    this.drawPop();
    this.pop.hidden = false;
  };
  Editor.prototype.drawPop = function () {
    var p = this._pop, self = this;
    this.pop.innerHTML = p.list.map(function (w, i) {
      return '<div class="' + (i === p.i ? 'on' : '') + '" data-i="' + i + '"><b>' + HL.esc(w.slice(0, p.to - p.from)) + '</b>' + HL.esc(w.slice(p.to - p.from)) + (i === p.i ? '<kbd>tab</kbd>' : '') + '</div>';
    }).join('');
    Array.prototype.forEach.call(this.pop.children, function (el) {
      el.addEventListener('mousedown', function (e) { e.preventDefault(); p.i = +el.getAttribute('data-i'); self.popAccept(); });
    });
  };
  Editor.prototype.popOpen = function () { return !this.pop.hidden && this._pop; };
  Editor.prototype.popMove = function (d) { var p = this._pop; p.i = (p.i + d + p.list.length) % p.list.length; this._popMoved = true; this.drawPop(); };
  Editor.prototype.popAccept = function () {
    var p = this._pop;
    this.hidePop();
    var w = p.list[p.i];
    this.put(p.from, this.doc.ta.selectionStart, w, p.from + w.length);
  };
  Editor.prototype.hidePop = function () { this.pop.hidden = true; this._pop = null; };

  // ── find ─────────────────────────────────────────────────────────────
  Editor.prototype.matcher = function (q, opts) {
    var src = opts.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (opts.word) src = '(?<![\\w$])(?:' + src + ')(?![\\w$])';
    try { return new RegExp(src, opts.caseSensitive ? 'g' : 'gi'); } catch (e) { return null; }
  };
  Editor.prototype.search = function (q, opts) {
    var d = this.doc;
    if (!d || !q) { this.find = null; this.drawMarks(); this.drawMini(); return { n: 0, i: -1 }; }
    var re = this.matcher(q, opts);
    if (!re) { this.find = null; this.drawMarks(); return { n: 0, i: -1, bad: true }; }
    var t = d.ta.value, matches = [], m;
    while ((m = re.exec(t)) && matches.length < 5000) { if (!m[0].length) { re.lastIndex++; continue; } matches.push([m.index, m.index + m[0].length]); }
    var from = d.ta.selectionStart, k = 0;
    while (k < matches.length && matches[k][0] < from) k++;
    if (opts.keep && this.find && this.find.q === q) k = Math.min(this.find.i, matches.length - 1);
    this.find = { q: q, matches: matches, i: matches.length ? k % matches.length : -1, opts: opts };
    this.drawMarks();
    this.drawMini();
    return { n: matches.length, i: this.find.i };
  };
  Editor.prototype.findStep = function (dir, select) {
    var f = this.find;
    if (!f || !f.matches.length) return { n: 0, i: -1 };
    f.i = (f.i + dir + f.matches.length) % f.matches.length;
    var m = f.matches[f.i], ta = this.doc.ta;
    if (select !== false) { ta.setSelectionRange(m[0], m[1]); this.reveal(this.lineAt(m[0], this.lineStarts())); }
    this.drawMarks();
    return { n: f.matches.length, i: f.i };
  };
  Editor.prototype.replaceOne = function (withText) {
    var f = this.find;
    if (!f || f.i < 0) return;
    var m = f.matches[f.i], t = this.doc.ta.value;
    var rep = withText;
    if (f.opts.regex) { var re = this.matcher(f.q, f.opts); rep = t.slice(m[0], m[1]).replace(new RegExp(re.source, re.flags.replace('g', '')), withText); }
    this.put(m[0], m[1], rep, m[0] + rep.length);
  };
  Editor.prototype.replaceAll = function (q, withText, opts) {
    var d = this.doc, t = d.ta.value, re = this.matcher(q, opts);
    if (!re) return 0;
    var n = (t.match(re) || []).length;
    if (!n) return 0;
    this.put(0, t.length, t.replace(re, opts.regex ? withText : function () { return withText; }), 0);
    return n;
  };

  root.Editor = Editor;
  root.Editor.MAC = MAC;
})(this);
