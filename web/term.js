// A terminal screen for den: it understands what programs print (colours,
// moving the cursor, clearing, full-screen programs like nano and top) and
// turns your keys into what a real terminal would send.
//
//   var t = new Term(hostElement, { send: function (bytes) {}, resize: function (cols, rows) {} });
//   t.write(textFromTheProgram);
(function (root) {
  'use strict';
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var MAX_HISTORY = 3000;
  var BASE16 = ['#1d1f26', '#e5626b', '#8fcf7a', '#e9c46a', '#6aa7f0', '#c38ae6', '#5cc6c6', '#d6d9e0',
    '#6b7080', '#ff7a83', '#a8e892', '#f5d67f', '#8cc0ff', '#d9a6ff', '#7ee0e0', '#ffffff'];

  function color256(n) {
    if (n < 16) return 'var(--t' + n + ',' + BASE16[n] + ')';
    if (n < 232) { n -= 16; var r = Math.floor(n / 36), g = Math.floor(n / 6) % 6, b = n % 6, f = function (v) { return v ? 55 + v * 40 : 0; }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
    var v = 8 + (n - 232) * 10;
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  function wide(cp) {
    return (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd);
  }

  var BLANK = { ch: ' ', s: null };
  function newStyle() { return { fg: null, bg: null, b: 0, d: 0, i: 0, u: 0, r: 0, x: 0 }; }
  function sameStyle(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.fg === b.fg && a.bg === b.bg && a.b === b.b && a.d === b.d && a.i === b.i && a.u === b.u && a.r === b.r && a.x === b.x;
  }
  function blankRow(cols, s) { var r = new Array(cols); for (var i = 0; i < cols; i++) r[i] = s ? { ch: ' ', s: s } : BLANK; return r; }

  function Term(host, hooks) {
    this.host = host;
    this.hooks = hooks || {};
    host.classList.add('term');
    host.innerHTML = '<div class="tscroll"><div class="thist"></div><div class="tscreen"></div></div><textarea class="tin" aria-label="Terminal: type here" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><span class="tmeasure">0000000000</span>';
    this.scroller = host.querySelector('.tscroll');
    this.hist = host.querySelector('.thist');
    this.screenEl = host.querySelector('.tscreen');
    this.input = host.querySelector('.tin');
    this.measure = host.querySelector('.tmeasure');
    this.cols = 80; this.rows = 24;
    this.reset();
    this.histCount = 0;
    this.pending = '';
    this._raf = 0;
    var self = this;
    this.input.addEventListener('keydown', function (e) { self.key(e); });
    this.input.addEventListener('input', function (e) {
      if (e.isComposing) return;
      var v = self.input.value;
      self.input.value = '';
      if (v) self.send(v);
    });
    this.input.addEventListener('compositionend', function () { var v = self.input.value; self.input.value = ''; if (v) self.send(v); });
    this.input.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text');
      self.paste(text);
    });
    this.scroller.addEventListener('scroll', function () { self.onScroll(); });
    this.input.addEventListener('focus', function () { host.classList.add('focused'); self.dirty(); });
    this.input.addEventListener('blur', function () { host.classList.remove('focused'); self.dirty(); });
    host.addEventListener('mouseup', function () {
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return; // leave a selection alone (to copy it)
      self.focus();
    });
    if (root.ResizeObserver) new ResizeObserver(function () { self.fit(); }).observe(host);
  }

  Term.prototype.reset = function () {
    this.style = newStyle();
    this.main = { lines: [], x: 0, y: 0 };
    this.alt = null;
    this.buf = this.main;
    for (var i = 0; i < this.rows; i++) this.main.lines.push(blankRow(this.cols));
    this.top = 0; this.bottom = this.rows - 1;
    this.saved = null;
    this.wrapNext = false;
    this.modes = { appCursor: false, paste: false, cursor: true, autowrap: true, insert: false };
    this.state = 0; this.params = ''; this.osc = '';
    this.dirtyAll = true;
  };

  Term.prototype.focus = function () { this.input.focus({ preventScroll: true }); };

  /** Fit as many rows and columns as there's room for. */
  Term.prototype.fit = function () {
    var r = this.measure.getBoundingClientRect();
    var cw = r.width / 10, ch = r.height;
    if (!cw || !ch) return;
    var w = this.scroller.clientWidth - 16, h = this.scroller.clientHeight - 8;
    var cols = Math.max(20, Math.floor(w / cw)), rows = Math.max(5, Math.floor(h / ch));
    if (cols === this.cols && rows === this.rows) return;
    this.resize(cols, rows);
    if (this.hooks.resize) this.hooks.resize(cols, rows);
  };

  Term.prototype.resize = function (cols, rows) {
    var self = this;
    [this.main, this.alt].forEach(function (b) {
      if (!b) return;
      b.lines = b.lines.map(function (l) {
        if (l.length > cols) return l.slice(0, cols);
        while (l.length < cols) l.push(BLANK);
        return l;
      });
      // fewer rows: the top ones scroll off (into the history, for the main screen)
      while (b.lines.length > rows) {
        if (b.y > 0 || b.lines.length - 1 > b.y) {
          var top = b.lines.shift();
          if (b === self.main) self.toHistory(top);
          if (b.y > 0) b.y--;
        } else b.lines.pop();
      }
      while (b.lines.length < rows) b.lines.push(blankRow(cols));
      b.x = Math.min(b.x, cols - 1);
      b.y = Math.min(b.y, rows - 1);
    });
    this.cols = cols; this.rows = rows;
    this.top = 0; this.bottom = rows - 1;
    this.dirtyAll = true;
    this.dirty();
  };

  // ── what programs send ────────────────────────────────────────────────
  Term.prototype.write = function (data) {
    var s = String(data);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      var ch = s[i];
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { ch = s.slice(i, i + 2); c = s.codePointAt(i); i++; }
      switch (this.state) {
        case 0: // plain text
          if (c === 0x1b) { this.state = 1; continue; }
          if (c < 0x20 || c === 0x7f) { this.control(c); continue; }
          this.print(ch, c);
          continue;
        case 1: // after ESC
          this.escape(ch);
          continue;
        case 2: // CSI: ESC [ params final
          if (c >= 0x40 && c <= 0x7e) { this.state = 0; this.csi(this.params, ch); this.params = ''; }
          else if (c === 0x1b) { this.state = 1; this.params = ''; }
          else if (this.params.length < 64) this.params += ch;
          continue;
        case 3: // OSC: ESC ] text BEL (or ESC \)
          if (c === 0x07) { this.state = 0; this.oscDone(); }
          else if (c === 0x1b) { this.state = 4; }
          else if (this.osc.length < 2048) this.osc += ch;
          continue;
        case 4: // ESC inside OSC (ESC \ ends it)
          this.state = 0; this.oscDone();
          if (ch !== '\\') { this.state = 1; this.escape(ch); }
          continue;
        case 5: // ESC ( x: character sets (ignored)
          this.state = 0;
          continue;
        case 6: // DCS etc.: skip until ESC \ or BEL
          if (c === 0x07) this.state = 0;
          else if (c === 0x1b) this.state = 7;
          continue;
        case 7:
          this.state = ch === '\\' ? 0 : 6;
          continue;
      }
    }
    this.dirty();
  };

  Term.prototype.control = function (c) {
    var b = this.buf;
    if (c === 0x07) { this.host.classList.remove('bell'); void this.host.offsetWidth; this.host.classList.add('bell'); return; }
    if (c === 0x08) { if (this.wrapNext) this.wrapNext = false; else if (b.x > 0) b.x--; return; }
    if (c === 0x09) { this.wrapNext = false; b.x = Math.min(this.cols - 1, (Math.floor(b.x / 8) + 1) * 8); return; }
    if (c === 0x0a || c === 0x0b || c === 0x0c) { this.wrapNext = false; this.lineFeed(); return; }
    if (c === 0x0d) { this.wrapNext = false; b.x = 0; return; }
  };

  Term.prototype.print = function (ch, cp) {
    var b = this.buf, w = wide(cp) ? 2 : 1;
    if (this.wrapNext) {
      this.wrapNext = false;
      if (this.modes.autowrap) { b.x = 0; this.lineFeed(true); }
    }
    if (w === 2 && b.x === this.cols - 1) { if (this.modes.autowrap) { b.x = 0; this.lineFeed(true); } }
    var line = b.lines[b.y];
    var st = this.styleRef();
    if (this.modes.insert) { line.splice(b.x, 0, { ch: ' ', s: st }); line.length = this.cols; }
    line[b.x] = { ch: ch, s: st, w: w };
    if (w === 2 && b.x + 1 < this.cols) line[b.x + 1] = { ch: '', s: st };
    line.dirty = true;
    if (b.x + w >= this.cols) { b.x = this.cols - 1; this.wrapNext = true; line.wrapped = true; }
    else b.x += w;
  };

  Term.prototype.styleRef = function () {
    var s = this.style;
    if (!s.fg && !s.bg && !s.b && !s.d && !s.i && !s.u && !s.r && !s.x) return null;
    if (!this._st || !sameStyle(this._st, s)) this._st = Object.assign({}, s);
    return this._st;
  };

  Term.prototype.lineFeed = function () {
    var b = this.buf;
    if (b.y === this.bottom) this.scrollUp(1);
    else if (b.y < this.rows - 1) b.y++;
  };

  Term.prototype.scrollUp = function (n) {
    var b = this.buf;
    for (var k = 0; k < n; k++) {
      var gone = b.lines.splice(this.top, 1)[0];
      if (b === this.main && this.top === 0) this.toHistory(gone);
      b.lines.splice(this.bottom, 0, blankRow(this.cols, this.bgOnly()));
    }
    this.dirtyAll = true;
  };
  Term.prototype.scrollDown = function (n) {
    var b = this.buf;
    for (var k = 0; k < n; k++) {
      b.lines.splice(this.bottom, 1);
      b.lines.splice(this.top, 0, blankRow(this.cols, this.bgOnly()));
    }
    this.dirtyAll = true;
  };
  Term.prototype.bgOnly = function () { return this.style.bg ? { fg: null, bg: this.style.bg, b: 0, d: 0, i: 0, u: 0, r: 0, x: 0 } : null; };

  /** A line that scrolled off the top goes into the history (once, as finished HTML). */
  Term.prototype.toHistory = function (line) {
    var div = document.createElement('div');
    div.className = 'tl';
    div.innerHTML = this.html(line, -1) || ' ';
    this.hist.appendChild(div);
    if (++this.histCount > MAX_HISTORY) { this.hist.removeChild(this.hist.firstChild); this.histCount--; }
  };

  Term.prototype.escape = function (ch) {
    var b = this.buf;
    this.state = 0;
    switch (ch) {
      case '[': this.state = 2; this.params = ''; return;
      case ']': this.state = 3; this.osc = ''; return;
      case '(': case ')': case '*': case '+': this.state = 5; return;
      case 'P': case '_': case '^': this.state = 6; return;
      case '7': this.saved = { x: b.x, y: b.y, style: Object.assign({}, this.style) }; return;
      case '8': if (this.saved) { b.x = this.saved.x; b.y = this.saved.y; this.style = Object.assign({}, this.saved.style); } return;
      case 'D': this.lineFeed(); return;
      case 'E': b.x = 0; this.lineFeed(); return;
      case 'M': if (b.y === this.top) this.scrollDown(1); else if (b.y > 0) b.y--; return;
      case 'c': this.reset(); this.hist.innerHTML = ''; this.histCount = 0; return;
      default: return; // = > and friends: nothing to do
    }
  };

  Term.prototype.oscDone = function () {
    var m = this.osc.match(/^([0-2]);(.*)$/);
    if (m && this.hooks.title) this.hooks.title(m[2]);
    this.osc = '';
  };

  Term.prototype.csi = function (params, f) {
    var b = this.buf, priv = params[0] === '?' || params[0] === '>' || params[0] === '=' ? params[0] : '';
    var ps = (priv ? params.slice(1) : params).split(';').map(function (x) { return x === '' ? NaN : parseInt(x, 10); });
    var p = function (i, d) { return isNaN(ps[i]) || ps[i] === undefined ? d : ps[i]; };
    var n = Math.max(1, p(0, 1));
    this.wrapNext = false;
    switch (f) {
      case 'A': b.y = Math.max(b.y >= this.top ? this.top : 0, b.y - n); break;
      case 'B': case 'e': b.y = Math.min(b.y <= this.bottom ? this.bottom : this.rows - 1, b.y + n); break;
      case 'C': case 'a': b.x = Math.min(this.cols - 1, b.x + n); break;
      case 'D': b.x = Math.max(0, b.x - n); break;
      case 'E': b.x = 0; b.y = Math.min(this.rows - 1, b.y + n); break;
      case 'F': b.x = 0; b.y = Math.max(0, b.y - n); break;
      case 'G': case '`': b.x = Math.min(this.cols - 1, Math.max(0, p(0, 1) - 1)); break;
      case 'd': b.y = Math.min(this.rows - 1, Math.max(0, p(0, 1) - 1)); break;
      case 'H': case 'f': b.y = Math.min(this.rows - 1, Math.max(0, p(0, 1) - 1)); b.x = Math.min(this.cols - 1, Math.max(0, p(1, 1) - 1)); break;
      case 'J': this.eraseScreen(p(0, 0)); break;
      case 'K': this.eraseLine(p(0, 0)); break;
      case 'L': if (b.y >= this.top && b.y <= this.bottom) { var t0 = this.top; this.top = b.y; this.scrollDown(n); this.top = t0; } break;
      case 'M': if (b.y >= this.top && b.y <= this.bottom) { var t1 = this.top; this.top = b.y; this.scrollUp(n); this.top = t1; } break;
      case 'P': { var l = b.lines[b.y]; l.splice(b.x, n); while (l.length < this.cols) l.push(BLANK); l.dirty = true; break; }
      case '@': { var l2 = b.lines[b.y]; for (var i = 0; i < n; i++) l2.splice(b.x, 0, BLANK); l2.length = this.cols; l2.dirty = true; break; }
      case 'X': { var l3 = b.lines[b.y]; for (var j = 0; j < n && b.x + j < this.cols; j++) l3[b.x + j] = BLANK; l3.dirty = true; break; }
      case 'S': this.scrollUp(n); break;
      case 'T': if (!priv) this.scrollDown(n); break;
      case 'm': if (!priv) this.sgr(ps); break;
      case 'r': if (!priv) { this.top = Math.max(0, p(0, 1) - 1); this.bottom = Math.min(this.rows - 1, p(1, this.rows) - 1); if (this.bottom <= this.top) { this.top = 0; this.bottom = this.rows - 1; } b.x = 0; b.y = 0; } break;
      case 's': this.saved = { x: b.x, y: b.y, style: Object.assign({}, this.style) }; break;
      case 'u': if (this.saved) { b.x = this.saved.x; b.y = this.saved.y; } break;
      case 'h': case 'l': this.mode(priv, ps, f === 'h'); break;
      case 'n': if (p(0, 0) === 6) this.reply('\x1b[' + (b.y + 1) + ';' + (b.x + 1) + 'R'); else if (p(0, 0) === 5) this.reply('\x1b[0n'); break;
      case 'c': if (!priv) this.reply('\x1b[?1;2c'); else if (priv === '>') this.reply('\x1b[>0;10;1c'); break;
      default: break; // t, q and others: nothing to do
    }
  };

  Term.prototype.reply = function (s) { if (this.hooks.send) this.hooks.send(s); };

  Term.prototype.mode = function (priv, ps, on) {
    var self = this;
    ps.forEach(function (m) {
      if (priv === '?') {
        if (m === 1) self.modes.appCursor = on;
        else if (m === 7) self.modes.autowrap = on;
        else if (m === 25) self.modes.cursor = on;
        else if (m === 2004) self.modes.paste = on;
        else if (m === 1049 || m === 47 || m === 1047) self.altScreen(on, m === 1049);
      } else if (m === 4) self.modes.insert = on;
    });
  };

  Term.prototype.altScreen = function (on, saveCursor) {
    if (on && this.buf === this.main) {
      if (saveCursor) this.saved = { x: this.main.x, y: this.main.y, style: Object.assign({}, this.style) };
      this.alt = { lines: [], x: 0, y: 0 };
      for (var i = 0; i < this.rows; i++) this.alt.lines.push(blankRow(this.cols));
      this.buf = this.alt;
      this.host.classList.add('alt');
    } else if (!on && this.buf === this.alt) {
      this.buf = this.main;
      this.alt = null;
      if (saveCursor && this.saved) { this.main.x = this.saved.x; this.main.y = this.saved.y; }
      this.host.classList.remove('alt');
    }
    this.top = 0; this.bottom = this.rows - 1;
    this.dirtyAll = true;
  };

  Term.prototype.eraseScreen = function (how) {
    var b = this.buf, s = this.bgOnly();
    if (how === 3) { this.hist.innerHTML = ''; this.histCount = 0; return; }
    if (how === 2) {
      // clearing the whole screen keeps what was there in the history (like a real terminal)
      if (b === this.main) {
        var last = -1;
        for (var k = 0; k < b.lines.length; k++) if (b.lines[k].some(function (c) { return c.ch && c.ch !== ' '; })) last = k;
        for (var q = 0; q <= last; q++) this.toHistory(b.lines[q]);
      }
      for (var i = 0; i < this.rows; i++) b.lines[i] = blankRow(this.cols, s);
    } else if (how === 0) {
      this.eraseLine(0);
      for (var j = b.y + 1; j < this.rows; j++) b.lines[j] = blankRow(this.cols, s);
    } else if (how === 1) {
      this.eraseLine(1);
      for (var z = 0; z < b.y; z++) b.lines[z] = blankRow(this.cols, s);
    }
    this.dirtyAll = true;
  };

  Term.prototype.eraseLine = function (how) {
    var b = this.buf, l = b.lines[b.y], s = this.bgOnly(), cell = s ? { ch: ' ', s: s } : BLANK;
    var from = how === 0 ? b.x : 0, to = how === 1 ? b.x + 1 : this.cols;
    for (var i = from; i < to; i++) l[i] = cell;
    l.dirty = true;
  };

  Term.prototype.sgr = function (ps) {
    var s = this.style;
    if (!ps.length || (ps.length === 1 && isNaN(ps[0]))) ps = [0];
    for (var i = 0; i < ps.length; i++) {
      var c = isNaN(ps[i]) ? 0 : ps[i];
      if (c === 0) { this.style = s = newStyle(); }
      else if (c === 1) s.b = 1;
      else if (c === 2) s.d = 1;
      else if (c === 3) s.i = 1;
      else if (c === 4) s.u = 1;
      else if (c === 7) s.r = 1;
      else if (c === 9) s.x = 1;
      else if (c === 21 || c === 22) { s.b = 0; s.d = 0; }
      else if (c === 23) s.i = 0;
      else if (c === 24) s.u = 0;
      else if (c === 27) s.r = 0;
      else if (c === 29) s.x = 0;
      else if (c >= 30 && c <= 37) s.fg = color256(c - 30);
      else if (c >= 90 && c <= 97) s.fg = color256(c - 90 + 8);
      else if (c === 39) s.fg = null;
      else if (c >= 40 && c <= 47) s.bg = color256(c - 40);
      else if (c >= 100 && c <= 107) s.bg = color256(c - 100 + 8);
      else if (c === 49) s.bg = null;
      else if (c === 38 || c === 48) {
        var key = c === 38 ? 'fg' : 'bg';
        if (ps[i + 1] === 5) { s[key] = color256(ps[i + 2] || 0); i += 2; }
        else if (ps[i + 1] === 2) { s[key] = 'rgb(' + (ps[i + 2] || 0) + ',' + (ps[i + 3] || 0) + ',' + (ps[i + 4] || 0) + ')'; i += 4; }
      }
    }
  };

  // ── drawing ───────────────────────────────────────────────────────────
  Term.prototype.dirty = function () {
    var self = this;
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () { self._raf = 0; self.render(); });
  };

  Term.prototype.html = function (line, cursorX) {
    var out = '', run = '', cur = undefined;
    var flush = function () {
      if (!run) return;
      if (cur) {
        var fg = cur.fg, bg = cur.bg;
        if (cur.r) { var t = fg; fg = bg || 'var(--tbg)'; bg = t || 'var(--tfg)'; }
        var css = (fg ? 'color:' + fg + ';' : '') + (bg ? 'background:' + bg + ';' : '');
        var cls = (cur.b ? 'b ' : '') + (cur.d ? 'd ' : '') + (cur.i ? 'i ' : '') + (cur.u ? 'u ' : '') + (cur.x ? 'x' : '');
        out += '<span' + (cls ? ' class="' + cls.trim() + '"' : '') + (css ? ' style="' + css + '"' : '') + '>' + run + '</span>';
      } else out += run;
      run = '';
    };
    var end = line.length;
    if (cursorX < 0) { while (end > 0 && line[end - 1].ch === ' ' && !line[end - 1].s) end--; } // history: no trailing spaces
    for (var i = 0; i < end; i++) {
      var c = line[i];
      if (c.ch === '') continue;
      var ch = c.ch === '<' ? '&lt;' : c.ch === '>' ? '&gt;' : c.ch === '&' ? '&amp;' : c.ch;
      if (i === cursorX) { flush(); cur = undefined; out += '<span class="tcur">' + ch + '</span>'; continue; }
      if (cur === undefined || !sameStyle(cur, c.s)) { flush(); cur = c.s; }
      run += ch;
    }
    flush();
    return out || '';
  };

  Term.prototype.render = function () {
    var b = this.buf, rows = this.screenEl.children;
    while (rows.length < this.rows) { var d = document.createElement('div'); d.className = 'tl'; this.screenEl.appendChild(d); }
    while (rows.length > this.rows) this.screenEl.removeChild(this.screenEl.lastChild);
    var showCur = this.modes.cursor;
    for (var y = 0; y < this.rows; y++) {
      var line = b.lines[y];
      var isCur = showCur && y === b.y;
      if (!this.dirtyAll && !line.dirty && !isCur && rows[y]._cur !== true) continue;
      rows[y].innerHTML = this.html(line, isCur ? b.x : -2) || ' ';
      rows[y]._cur = isCur;
      line.dirty = false;
    }
    this.dirtyAll = false;
    // stay at the bottom while things are printed, unless you scrolled up to read
    var s = this.scroller;
    if (this._stick !== false) s.scrollTop = s.scrollHeight;
  };

  // ── your keys ─────────────────────────────────────────────────────────
  Term.prototype.send = function (s) {
    this._stick = true;
    if (this.hooks.send) this.hooks.send(s);
  };
  Term.prototype.paste = function (text) {
    text = String(text || '').replace(/\r?\n/g, '\r');
    if (!text) return;
    this.send(this.modes.paste ? '\x1b[200~' + text + '\x1b[201~' : text);
  };

  Term.prototype.key = function (e) {
    var k = e.key;
    // pasting arrives as a paste event (⌘V on a Mac, Ctrl+V or Ctrl+Shift+V elsewhere);
    // copying works on its own: select text with the mouse, then ⌘C or Ctrl+C
    if ((MAC ? e.metaKey : e.ctrlKey) && (k === 'v' || k === 'V')) return;
    if (MAC && e.metaKey && (k === 'k' || k === 'K')) { e.preventDefault(); this.clear(); return; }
    if (e.metaKey) return; // the rest of ⌘ belongs to den and the browser
    var app = this.modes.appCursor, seq = null;
    var m = (e.shiftKey ? 1 : 0) + (e.altKey ? 2 : 0) + (e.ctrlKey ? 4 : 0);
    var arrows = { ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D', Home: 'H', End: 'F' };
    var tilde = { Insert: 2, Delete: 3, PageUp: 5, PageDown: 6, F5: 15, F6: 17, F7: 18, F8: 19, F9: 20, F10: 21, F11: 23, F12: 24 };
    var fkeys = { F1: 'P', F2: 'Q', F3: 'R', F4: 'S' };
    if (arrows[k]) seq = m ? '\x1b[1;' + (m + 1) + arrows[k] : (app ? '\x1bO' : '\x1b[') + arrows[k];
    else if (tilde[k]) seq = '\x1b[' + tilde[k] + (m ? ';' + (m + 1) : '') + '~';
    else if (fkeys[k]) seq = m ? '\x1b[1;' + (m + 1) + fkeys[k] : '\x1bO' + fkeys[k];
    else if (k === 'Enter') seq = e.altKey && !MAC ? '\x1b\r' : '\r';
    else if (k === 'Backspace') seq = e.ctrlKey ? '\x08' : e.altKey ? '\x1b\x7f' : '\x7f';
    else if (k === 'Tab') seq = e.shiftKey ? '\x1b[Z' : '\t';
    else if (k === 'Escape') seq = '\x1b';
    else if (e.ctrlKey && !e.altKey && k.length === 1) {
      var c = k.toUpperCase().charCodeAt(0);
      if (c >= 64 && c <= 95) seq = String.fromCharCode(c - 64);
      else if (k === ' ' || k === '2') seq = '\x00';
      else if (k === '/') seq = '\x1f';
    } else if (e.altKey && !MAC && k.length === 1) seq = '\x1b' + k;
    if (seq === null) return; // ordinary typing arrives through the input event
    e.preventDefault();
    e.stopPropagation();
    this.send(seq);
  };

  Term.prototype.clear = function () {
    this.hist.innerHTML = '';
    this.histCount = 0;
    this.send('\x0c'); // ask the shell to redraw its prompt at the top
  };

  Term.prototype.onScroll = function () {
    var s = this.scroller;
    this._stick = s.scrollHeight - s.scrollTop - s.clientHeight < 8;
  };

  root.Term = Term;
})(this);
