// den's editor: a plain textarea you type in (so copy, paste, undo and
// spell-free typing all work like everywhere else) over a coloured copy of the
// same text. Each open file keeps its own textarea, so each keeps its own undo.
(function (root) {
  'use strict';
  var HL = root.HL;
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  var CLOSERS = { ')': 1, ']': 1, '}': 1, '"': 1, "'": 1, '`': 1 };

  function Editor(host, hooks) {
    this.host = host;
    this.hooks = hooks || {};
    this.doc = null;
    this.gutter = host.querySelector('.gin');
    this.view = host.querySelector('.view');
    this.layer = host.querySelector('.layer');
    this.pre = host.querySelector('pre.hl');
    this.cur = host.querySelector('.curline');
    this.marks = host.querySelector('.marks');
    this.pop = host.querySelector('.complete');
    this.measure = document.createElement('span');
    this.measure.className = 'measure';
    this.measure.textContent = '0'.repeat(100);
    host.appendChild(this.measure);
    this.lh = 20; this.cw = 8; this.pad = { t: 8, l: 12 };
    this.find = null; // { matches: [[start, end]], i }
    this._raf = 0;
    var self = this;
    if (root.ResizeObserver) new ResizeObserver(function () { self.metrics(); self.render(); }).observe(this.view);
  }

  Editor.prototype.metrics = function () {
    var r = this.measure.getBoundingClientRect();
    this.cw = r.width / 100 || 8;
    this.lh = r.height || 20;
  };

  /** A new document (one per open file). */
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
      _text: null, _lines: null, _words: null, sel: [0, 0], top: 0, left: 0,
    };
    if (doc.readOnly) ta.readOnly = true;
    var self = this;
    ta.addEventListener('scroll', function () { if (self.doc === doc) self.sync(); });
    ta.addEventListener('input', function (e) { if (self.doc === doc) self.changed(e); });
    ta.addEventListener('keydown', function (e) { if (self.doc === doc) self.key(e); });
    ta.addEventListener('keyup', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('mouseup', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('select', function () { if (self.doc === doc) self.moved(); });
    ta.addEventListener('blur', function () { if (self.doc === doc) setTimeout(function () { self.hidePop(); }, 150); });
    return doc;
  };

  /** Show a document in the editor (and remember where the last one was). */
  Editor.prototype.show = function (doc) {
    if (this.doc && this.doc !== doc) {
      this.doc.sel = [this.doc.ta.selectionStart, this.doc.ta.selectionEnd];
      this.doc.top = this.doc.ta.scrollTop; this.doc.left = this.doc.ta.scrollLeft;
      if (this.doc.ta.parentNode) this.doc.ta.parentNode.removeChild(this.doc.ta);
    }
    this.doc = doc;
    this.find = null;
    this.hidePop();
    if (!doc) { this.pre.innerHTML = ''; this.gutter.innerHTML = ''; return; }
    this.view.appendChild(doc.ta);
    this.setWrap(doc.wrap);
    this.metrics();
    doc.ta.setSelectionRange(doc.sel[0], doc.sel[1]);
    doc.ta.scrollTop = doc.top; doc.ta.scrollLeft = doc.left;
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
    if (d._text !== t) { d._text = t; d._lines = HL.highlight(t, d.lang); d._words = null; }
    return d._lines;
  };

  Editor.prototype.changed = function (e) {
    var self = this;
    this.hooks.change && this.hooks.change(this.doc);
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
    this.hidePop();
  };

  Editor.prototype.render = function (force) {
    var d = this.doc;
    if (!d) return;
    var lines = this.lines(), ta = d.ta, lh = this.lh, n = lines.length;
    var cur = this.caretLine();
    var html = '', gut = '';
    if (d.wrap) {
      this.pre.style.width = ta.clientWidth + 'px';
      for (var i = 0; i < n; i++) html += '<div class="l">' + (lines[i] || ' ') + '</div>';
      this.pre.innerHTML = html;
      // line numbers follow the wrapped lines' real heights
      var kids = this.pre.children;
      for (var k = 0; k < n; k++) gut += '<div style="height:' + kids[k].offsetHeight + 'px"' + (k === cur ? ' class="on"' : '') + '>' + (k + 1) + '</div>';
      this.gutter.innerHTML = '<div style="height:' + this.pad.t + 'px"></div>' + gut;
      this._win = null;
    } else {
      this.pre.style.width = '';
      var first = Math.max(0, Math.floor(ta.scrollTop / lh) - 60);
      var last = Math.min(n, Math.ceil((ta.scrollTop + ta.clientHeight) / lh) + 60);
      this._win = [first, last];
      for (var j = first; j < last; j++) {
        html += '<div class="l">' + (lines[j] || ' ') + '</div>';
        gut += '<div' + (j === cur ? ' class="on"' : '') + '>' + (j + 1) + '</div>';
      }
      this.pre.innerHTML = '<div style="height:' + (first * lh) + 'px"></div>' + html;
      this.gutter.innerHTML = '<div style="height:' + (this.pad.t + first * lh) + 'px"></div>' + gut;
    }
    this.host.style.setProperty('--gutter', (String(n).length + 2) + 'ch');
    this.drawCur();
    this.drawMarks();
    this.place();
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

  Editor.prototype.drawMarks = function () {
    var f = this.find, d = this.doc;
    if (!f || !f.matches.length || d.wrap) { this.marks.innerHTML = ''; return; }
    var text = d.ta.value, html = '', win = this._win || [0, Infinity];
    var lineStarts = this.lineStarts();
    for (var k = 0; k < f.matches.length; k++) {
      var m = f.matches[k], line = this.lineAt(m[0], lineStarts);
      if (line < win[0] || line > win[1]) continue;
      var ls = lineStarts[line], lt = text.slice(ls, text.indexOf('\n', ls) < 0 ? text.length : text.indexOf('\n', ls));
      var x = this.pad.l + this.vcol(lt, m[0] - ls) * this.cw, w = Math.max(2, (this.vcol(lt, m[1] - ls) - this.vcol(lt, m[0] - ls)) * this.cw);
      html += '<i class="' + (k === f.i ? 'now' : '') + '" style="left:' + x + 'px;top:' + (this.pad.t + line * this.lh) + 'px;width:' + w + 'px;height:' + this.lh + 'px"></i>';
    }
    this.marks.innerHTML = html;
  };

  Editor.prototype.lineStarts = function () {
    var t = this.doc.ta.value, out = [0];
    for (var i = t.indexOf('\n'); i >= 0; i = t.indexOf('\n', i + 1)) out.push(i + 1);
    return out;
  };
  Editor.prototype.lineAt = function (pos, starts) {
    var lo = 0, hi = starts.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo;
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
    return { line: line + 1, col: p - ls + 1, sel: Math.abs(ta.selectionEnd - ta.selectionStart) };
  };
  /** The word the caret is in (for "What's this?"). */
  Editor.prototype.word = function () {
    var ta = this.doc.ta, t = ta.value, p = ta.selectionStart;
    var re = this.doc.lang === 'css' || this.doc.lang === 'html' ? /[\w-]/ : /[\w$]/;
    var a = p, b = p;
    while (a > 0 && re.test(t[a - 1])) a--;
    while (b < t.length && re.test(t[b])) b++;
    return t.slice(a, b);
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
    this.hooks.cursor && this.hooks.cursor(this.doc);
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

  Editor.prototype.deleteLines = function () {
    var ta = this.doc.ta, t = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var a = t.lastIndexOf('\n', s - 1) + 1;
    var z = t.indexOf('\n', e); z = z < 0 ? t.length : z + 1;
    if (z === t.length && a > 0) a--;
    this.put(a, z, '', a);
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
          var before = t.slice(t.lastIndexOf('\n', s - 1) + 1, s).replace(/\\./g, '');
          over = (before.split(ch).length - 1) % 2 === 1;
        }
        if (over) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
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
    if (!d._words) {
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
    // count it from the text without this word, so a word you're halfway through doesn't suggest itself
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
  Editor.prototype.search = function (q, opts) {
    var d = this.doc;
    if (!d || !q) { this.find = null; this.drawMarks(); return { n: 0, i: -1 }; }
    var t = d.ta.value, hay = opts.caseSensitive ? t : t.toLowerCase(), needle = opts.caseSensitive ? q : q.toLowerCase();
    var matches = [];
    for (var i = hay.indexOf(needle); i >= 0 && matches.length < 5000; i = hay.indexOf(needle, i + Math.max(1, needle.length))) matches.push([i, i + needle.length]);
    var from = d.ta.selectionStart, k = 0;
    while (k < matches.length && matches[k][0] < from) k++;
    if (opts.keep && this.find && this.find.q === q) k = Math.min(this.find.i, matches.length - 1);
    this.find = { q: q, matches: matches, i: matches.length ? k % matches.length : -1, opts: opts };
    this.drawMarks();
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
    var m = f.matches[f.i];
    this.put(m[0], m[1], withText, m[0] + withText.length);
  };
  Editor.prototype.replaceAll = function (q, withText, opts) {
    var d = this.doc, t = d.ta.value;
    var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.caseSensitive ? 'g' : 'gi');
    var n = (t.match(re) || []).length;
    if (!n) return 0;
    this.put(0, t.length, t.replace(re, function () { return withText; }), 0);
    return n;
  };

  root.Editor = Editor;
  root.Editor.MAC = MAC;
})(this);
