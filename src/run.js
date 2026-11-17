'use strict';
// Running code, only when you press Run: the file you're on (with the right
// program for its kind), or a command you type in the console. One thing runs
// at a time; its output streams to the page, and you can type to it or stop it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const EventEmitter = require('events');

const WIN = process.platform === 'win32';
const OUT_MAX = 2 * 1024 * 1024; // after this much output, the rest is skipped

/** Is a program on this computer? Returns its full path or null. */
function which(name) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').concat(['']) : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const e of exts) {
      const full = path.join(dir, name + e.toLowerCase());
      try { if (fs.statSync(full).isFile()) return full; } catch { /* not here */ }
      if (e) {
        const up = path.join(dir, name + e);
        try { if (fs.statSync(up).isFile()) return up; } catch { /* not here */ }
      }
    }
  }
  return null;
}

const first = (...names) => names.find((n) => which(n)) || null;

// How to run each kind of file. get: what to run; need: what to say if it's missing.
const KINDS = {
  py: { name: 'Python', get: () => first(WIN ? 'py' : 'python3', 'python3', 'python'), args: (f) => [f], need: 'Python is not installed. Get it from https://www.python.org/downloads (the big yellow button), then press Run again.' },
  js: { name: 'JavaScript', get: () => first('node'), args: (f) => [f], need: 'Node.js is not installed. Get it from https://nodejs.org (the LTS button), then press Run again.' },
  mjs: { alias: 'js' },
  cjs: { alias: 'js' },
  ts: { name: 'TypeScript', get: () => (nodeMajor() >= 23 ? first('node') : null), args: (f) => [f], need: 'TypeScript runs with Node.js 23 or newer. Get it from https://nodejs.org, then press Run again.' },
  sh: { name: 'a shell script', get: () => (WIN ? null : first('bash', 'sh')), args: (f) => [f], need: 'Shell scripts run on Mac and Linux. On Windows, try a .ps1 (PowerShell) file instead.' },
  ps1: { name: 'PowerShell', get: () => first('pwsh', 'powershell'), args: (f) => ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f], need: 'PowerShell is not installed.' },
  rb: { name: 'Ruby', get: () => first('ruby'), args: (f) => [f], need: 'Ruby is not installed. Get it from https://www.ruby-lang.org' },
  php: { name: 'PHP', get: () => first('php'), args: (f) => [f], need: 'PHP is not installed. Get it from https://www.php.net' },
  lua: { name: 'Lua', get: () => first('lua', 'lua5.4'), args: (f) => [f], need: 'Lua is not installed. Get it from https://www.lua.org' },
  pl: { name: 'Perl', get: () => first('perl'), args: (f) => [f], need: 'Perl is not installed.' },
  r: { name: 'R', get: () => first('Rscript'), args: (f) => [f], need: 'R is not installed. Get it from https://cran.r-project.org' },
  go: { name: 'Go', get: () => first('go'), args: (f) => ['run', f], need: 'Go is not installed. Get it from https://go.dev/dl' },
  java: { name: 'Java', get: () => first('java'), args: (f) => [f], need: 'Java is not installed. Get it from https://adoptium.net' },
  swift: { name: 'Swift', get: () => first('swift'), args: (f) => [f], need: 'Swift comes with Xcode on a Mac (type xcode-select --install in a terminal).' },
  dart: { name: 'Dart', get: () => first('dart'), args: (f) => ['run', f], need: 'Dart is not installed. Get it from https://dart.dev/get-dart' },
  c: { name: 'C', compile: ['cc', 'gcc', 'clang'], need: 'A C compiler is not installed. On a Mac, type xcode-select --install in a terminal.' },
  cpp: { name: 'C++', compile: ['c++', 'g++', 'clang++'], need: 'A C++ compiler is not installed. On a Mac, type xcode-select --install in a terminal.' },
  cc: { alias: 'cpp' },
};

function nodeMajor() {
  try { return parseInt(String(spawnSync('node', ['--version'], { encoding: 'utf8' }).stdout).replace(/^v/, ''), 10) || 0; } catch { return 0; }
}

/** How den would run a file: { cmd, args } or { error }, or null for "not a program". */
function plan(file) {
  let e = path.extname(file).slice(1).toLowerCase();
  if (e === 'R') e = 'r';
  let k = KINDS[e];
  if (k && k.alias) k = KINDS[k.alias];
  if (!k) return null;
  if (k.compile) {
    const cc = first(...k.compile);
    if (!cc) return { error: k.need, name: k.name };
    const out = path.join(os.tmpdir(), `den-run-${process.pid}${WIN ? '.exe' : ''}`);
    return { name: k.name, compile: { cmd: cc, args: [file, '-o', out] }, cmd: out, args: [] };
  }
  const cmd = k.get();
  if (!cmd) return { error: k.need, name: k.name };
  return { name: k.name, cmd, args: k.args(file) };
}

class Runner extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.job = null;
    this.n = 0;
  }

  get busy() {
    return !!this.proc;
  }

  /** Run a file (cwd: its folder) or a command line (cwd: the folder den has open). */
  start({ file = null, command = null, cwd }) {
    if (this.proc) throw Object.assign(new Error('Something is still running. Stop it first (the ■ button).'), { code: 'busy' });
    const id = ++this.n;
    let steps;
    let label;
    if (file) {
      const p = plan(file);
      if (!p) throw Object.assign(new Error(`den doesn't know how to run ${path.extname(file) || 'this kind of'} file.`), { code: 'unknown' });
      if (p.error) throw Object.assign(new Error(p.error), { code: 'missing_tool' });
      steps = p.compile ? [{ ...p.compile, quiet: true }, { cmd: p.cmd, args: p.args }] : [{ cmd: p.cmd, args: p.args }];
      label = path.basename(file);
      cwd = path.dirname(file);
    } else {
      const line = String(command || '').trim();
      if (!line) throw Object.assign(new Error('Type a command first.'), { code: 'empty' });
      steps = [WIN ? { cmd: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', line], verbatim: true } : { cmd: process.env.SHELL && /bash|zsh/.test(process.env.SHELL) ? process.env.SHELL : '/bin/sh', args: ['-c', line] }];
      label = line;
    }
    this.job = { id, label, file: !!file, started: Date.now(), bytes: 0, cut: false };
    this.emit('event', { t: 'start', id, label, file: !!file });
    this._step(steps, 0, cwd);
    return { id };
  }

  _step(steps, i, cwd) {
    const job = this.job;
    const s = steps[i];
    const env = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', FORCE_COLOR: '0', NO_COLOR: '1', DEN: '1' };
    let proc;
    try {
      proc = spawn(s.cmd, s.args, { cwd, env, detached: !WIN, windowsHide: true, windowsVerbatimArguments: !!s.verbatim });
    } catch (e) {
      return this._end(job, null, null, e.message);
    }
    this.proc = proc;
    const out = (err) => (chunk) => {
      if (job.cut) return;
      job.bytes += chunk.length;
      if (job.bytes > OUT_MAX) {
        job.cut = true;
        this.emit('event', { t: 'out', id: job.id, err: true, text: '\n[den: that was a lot of output, so the rest is hidden. The program is still running.]\n' });
        return;
      }
      this.emit('event', { t: 'out', id: job.id, err, text: chunk.toString('utf8') });
    };
    proc.stdout.on('data', out(false));
    proc.stderr.on('data', out(true));
    proc.stdin.on('error', () => {});
    proc.on('error', (e) => {
      this.proc = null;
      this._end(job, null, null, e.code === 'ENOENT' ? `Couldn't find ${s.cmd}.` : e.message);
    });
    proc.on('close', (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = null;
      if (code === 0 && i + 1 < steps.length) return this._step(steps, i + 1, cwd);
      this._end(job, code, signal, null, s.quiet && code !== 0 ? 'compile' : null);
    });
  }

  _end(job, code, signal, error, stage = null) {
    if (!job || job.ended) return;
    job.ended = true;
    this.job = null;
    this.emit('event', { t: 'end', id: job.id, code, signal: signal || null, error, stage, ms: Date.now() - job.started, stopped: !!job.stopped });
  }

  /** Type something to the program (it gets a newline at the end). */
  input(text) {
    if (!this.proc) return false;
    try { this.proc.stdin.write(String(text) + '\n'); } catch { return false; }
    return true;
  }

  stop() {
    const p = this.proc;
    if (!p) return false;
    if (this.job) this.job.stopped = true;
    try {
      if (WIN) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
      else process.kill(-p.pid, 'SIGTERM');
    } catch {
      try { p.kill('SIGTERM'); } catch { /* already gone */ }
    }
    const pid = p.pid;
    setTimeout(() => {
      if (this.proc && this.proc.pid === pid) {
        try { if (!WIN) process.kill(-pid, 'SIGKILL'); else p.kill('SIGKILL'); } catch { /* gone */ }
      }
    }, 2000).unref();
    return true;
  }
}

module.exports = { Runner, plan, which, KINDS };
