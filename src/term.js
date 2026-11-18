'use strict';
// Real terminals inside den. On a Mac and on Linux each one is a proper
// terminal (a "pty", made with the `script` program every Mac and Linux
// computer has), so colours, arrow keys, `python3` on its own, `nano` and
// `top` all work. On Windows it's a simpler PowerShell window.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { StringDecoder } = require('string_decoder');
const EventEmitter = require('events');
const { which } = require('./run');

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const MAX = 6;
// the tiny script that starts each terminal: report which terminal device it is
// (so den can resize it later), set the size, then become your usual shell
const BOOT = 'printf "\\033]7770;%s\\007" "$(tty)"; stty rows "$DEN_ROWS" cols "$DEN_COLS" 2>/dev/null; exec "$DEN_SHELL" -l';
const TTY_RE = /\x1b\]7770;([^\x07]*)\x07/;

function shellOf() {
  const want = process.env.SHELL;
  if (want && fs.existsSync(want)) return want;
  return ['/bin/zsh', '/bin/bash', '/bin/sh'].find((s) => fs.existsSync(s)) || '/bin/sh';
}

class Terms extends EventEmitter {
  constructor(root) {
    super();
    this.root = root;
    this.list = new Map();
    this.n = 0;
  }

  /** Can den make real terminals here? */
  get pty() { return !WIN && !!which('script'); }

  open({ cols = 100, rows = 30, cwd = null } = {}) {
    if (this.list.size >= MAX) throw Object.assign(new Error(`That's ${MAX} terminals already. Close one first.`), { code: 'too_many' });
    cols = clamp(cols, 20, 400, 100);
    rows = clamp(rows, 5, 200, 30);
    const id = ++this.n;
    const dir = cwd && fs.existsSync(cwd) ? cwd : this.root;
    const env = {
      ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'den', DEN: '1',
      DEN_COLS: String(cols), DEN_ROWS: String(rows), COLUMNS: String(cols), LINES: String(rows),
    };
    if (!env.LANG || env.LANG === 'C') env.LANG = 'en_US.UTF-8';
    let proc;
    let label;
    if (this.pty) {
      const sh = shellOf();
      env.DEN_SHELL = sh;
      label = path.basename(sh);
      // macOS: script [-q] file command…   Linux (util-linux): script -q -f -c "command" file
      const args = MAC ? ['-q', '/dev/null', '/bin/sh', '-c', BOOT] : ['-q', '-f', '-c', `/bin/sh -c '${BOOT.replace(/'/g, "'\\''")}'`, '/dev/null'];
      proc = spawn('script', args, { cwd: dir, env, detached: true });
    } else {
      const ps = which('pwsh') || which('powershell') || process.env.ComSpec || 'cmd.exe';
      label = /pwsh|powershell/i.test(ps) ? 'PowerShell' : 'Command Prompt';
      proc = spawn(ps, /pwsh|powershell/i.test(ps) ? ['-NoLogo', '-NoProfile'] : [], { cwd: dir, env, windowsHide: true });
    }
    const t = { id, proc, label, tty: null, cols, rows, pty: this.pty, buf: '', timer: null, decoder: new StringDecoder('utf8'), early: '', replay: '' };
    this.list.set(id, t);
    const out = (chunk) => {
      let s = t.decoder.write(chunk);
      if (!t.tty && t.pty) {
        // the first thing the terminal says is which device it is; keep that to ourselves
        t.early += s;
        const m = t.early.match(TTY_RE);
        if (!m) { if (t.early.length < 4096) return; s = t.early; t.early = ''; t.tty = 'unknown'; }
        else { t.tty = m[1].trim(); s = t.early.replace(TTY_RE, ''); t.early = ''; }
      }
      if (!s) return;
      t.buf += s;
      if (!t.timer) t.timer = setTimeout(() => this._flush(t), 12);
    };
    proc.stdout.on('data', out);
    proc.stderr.on('data', out);
    proc.stdin.on('error', () => {});
    proc.on('error', (e) => { this._flush(t); this.emit('event', { t: 'term', id, d: `\r\n[den couldn't start a terminal: ${e.message}]\r\n` }); this._gone(t, null); });
    proc.on('close', (code) => { this._flush(t); this._gone(t, code); });
    return { id, label, pty: t.pty };
  }

  _flush(t) {
    clearTimeout(t.timer);
    t.timer = null;
    if (!t.buf) return;
    const d = t.buf;
    t.buf = '';
    // the last part is kept, so a page that reloads can show what was there
    t.replay = (t.replay + d).slice(-120000);
    this.emit('event', { t: 'term', id: t.id, d });
  }

  _gone(t, code) {
    if (!this.list.has(t.id)) return;
    this.list.delete(t.id);
    this.emit('event', { t: 'term-end', id: t.id, code });
  }

  input(id, data) {
    const t = this.list.get(Number(id));
    if (!t) return false;
    let d = String(data || '');
    // a simple (Windows) terminal: Enter is a newline, and it can't take arrow keys and the like
    if (!t.pty) d = d.replace(/\r/g, '\r\n').replace(/\x1b\[[0-9;]*[A-Za-z~]/g, '');
    try { t.proc.stdin.write(d); } catch { return false; }
    return true;
  }

  resize(id, cols, rows) {
    const t = this.list.get(Number(id));
    if (!t) return false;
    t.cols = clamp(cols, 20, 400, t.cols);
    t.rows = clamp(rows, 5, 200, t.rows);
    if (!t.pty || !t.tty || !/^\/dev\//.test(t.tty)) return false;
    // setting the size on the terminal device also tells the program inside (SIGWINCH)
    const r = spawnSync('stty', [MAC ? '-f' : '-F', t.tty, 'rows', String(t.rows), 'cols', String(t.cols)], { timeout: 2000 });
    return r.status === 0;
  }

  close(id) {
    const t = this.list.get(Number(id));
    if (!t) return false;
    kill(t.proc);
    this._gone(t, null);
    return true;
  }

  closeAll() {
    for (const t of this.list.values()) kill(t.proc);
    this.list.clear();
  }

  info() {
    return [...this.list.values()].map((t) => ({ id: t.id, label: t.label, pty: t.pty, replay: t.replay }));
  }
}

function kill(p) {
  try {
    if (WIN) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-p.pid, 'SIGHUP');
  } catch {
    try { p.kill('SIGHUP'); } catch { /* already gone */ }
  }
  const pid = p.pid;
  setTimeout(() => { try { if (!WIN) process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } }, 1500).unref();
}

function clamp(v, lo, hi, d) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
}

module.exports = { Terms, BOOT };
