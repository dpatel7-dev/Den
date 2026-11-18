'use strict';
// Source control: what changed since the last save point (commit), saving a
// new one, and sending them to GitHub and back. den runs the real `git`
// program, so everything it does is exactly what git would do in a terminal.
//
// Safety: throwing away changes ("discard") first keeps a copy in den's own
// earlier versions, and new files go to den's bin instead of being deleted.

const { spawn } = require('child_process');
const { which } = require('./run');

const ENV = { GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', LANG: 'C', GIT_EDITOR: 'true', GIT_PAGER: 'cat' };

/** Run git in the folder. Resolves { code, out, err } (never rejects for a failed command). */
function git(cwd, args, { input = null, timeout = 20000, max = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn('git', args, { cwd, env: { ...process.env, ...ENV }, windowsHide: true });
    } catch (e) {
      return resolve({ code: -1, out: '', err: e.message });
    }
    const out = [];
    const err = [];
    let size = 0;
    proc.stdout.on('data', (d) => { size += d.length; if (size < max) out.push(d); });
    proc.stderr.on('data', (d) => { if (err.length < 200) err.push(d); });
    proc.on('error', (e) => resolve({ code: -1, out: '', err: e.code === 'ENOENT' ? 'git is not installed.' : e.message }));
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* gone */ } }, timeout);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8').trim() });
    });
    if (input != null) proc.stdin.end(input);
    else proc.stdin.end();
  });
}

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

/** The first line of what git said, in a friendlier form where we can. */
function explain(r, what) {
  const text = (r.err || r.out || '').trim();
  if (/Please tell me who you are|unable to auto-detect email/i.test(text)) return fail('identity', 'git needs your name and email before it can save a commit.');
  if (/could not read Username|Authentication failed|terminal prompts disabled|Permission denied \(publickey\)/i.test(text)) {
    return fail('login', 'GitHub needs you to sign in. Run the same thing once in den\'s Terminal (it will ask for your login), and git will remember it.');
  }
  if (/no upstream|has no upstream branch/i.test(text)) return fail('upstream', 'This branch isn\'t on GitHub yet.');
  if (/No configured push destination|does not appear to be a git repository|No such remote/i.test(text)) return fail('no_remote', 'This project isn\'t connected to GitHub (or another server) yet.');
  if (/Not possible to fast-forward|divergent branches|non-fast-forward|fetch first|rejected/i.test(text)) {
    return fail('diverged', 'Both your copy and the one online have new commits. Pull first; if that can\'t be done automatically, ask Ember or a teacher to help merge.');
  }
  if (/nothing to commit/i.test(text)) return fail('nothing', 'There is nothing new to commit.');
  if (/would be overwritten|Please commit your changes or stash them/i.test(text)) return fail('dirty', 'You have changes that would be lost. Commit them first.');
  const first = text.split('\n').filter((l) => l.trim() && !/^hint:/.test(l))[0] || `git couldn't ${what}.`;
  return fail('git', first.replace(/^(fatal|error):\s*/i, ''));
}

class Git {
  constructor(folder) {
    this.F = folder;
    this.root = folder.root;
    this._prefix = null;
  }

  available() { return !!which('git'); }

  async run(args, opts) { return git(this.root, args, opts); }

  /** Where den's folder sits inside the git project ("" when it's the top). */
  async prefix() {
    if (this._prefix !== null) return this._prefix;
    const r = await this.run(['rev-parse', '--show-prefix']);
    if (r.code !== 0) return null;
    this._prefix = r.out.trim();
    return this._prefix;
  }

  /** Everything the Source Control view shows. */
  async status() {
    if (!this.available()) return { git: false };
    const top = await this.run(['rev-parse', '--show-toplevel']);
    if (top.code !== 0) { this._prefix = null; return { git: true, repo: false }; }
    const prefix = await this.prefix();
    const r = await this.run(['status', '--porcelain=v1', '-b', '-z', '-uall', '--', '.']);
    if (r.code !== 0) throw explain(r, 'look at the changes');
    const parts = r.out.split('\0');
    let branch = null;
    let upstream = null;
    let ahead = 0;
    let behind = 0;
    let fresh = false;
    const files = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p) continue;
      if (p.startsWith('## ')) {
        const head = p.slice(3);
        const m = head.match(/^No commits yet on (.+)$/) || head.match(/^Initial commit on (.+)$/);
        if (m) { branch = m[1]; fresh = true; continue; }
        const b = head.match(/^([^.\s]+(?:\.[^.\s]+)*?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/);
        if (b) {
          branch = b[1] === 'HEAD (no branch)' ? null : b[1];
          upstream = b[2] || null;
          const a = (b[3] || '').match(/ahead (\d+)/);
          const z = (b[3] || '').match(/behind (\d+)/);
          ahead = a ? +a[1] : 0;
          behind = z ? +z[1] : 0;
        }
        continue;
      }
      const x = p[0];
      const y = p[1];
      let file = p.slice(3);
      let from = null;
      if (x === 'R' || x === 'C') from = parts[++i];
      if (prefix && !file.startsWith(prefix)) continue;
      file = file.slice(prefix.length);
      if (from && prefix) from = from.slice(prefix.length);
      files.push({
        path: file, from, x, y,
        staged: x !== ' ' && x !== '?' && x !== '!',
        changed: y !== ' ',
        untracked: x === '?',
        conflict: x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D'),
        kind: x === '?' || x === 'A' ? 'new' : x === 'D' || y === 'D' ? 'deleted' : x === 'R' ? 'renamed' : 'changed',
      });
    }
    const remote = await this.run(['remote']);
    return { git: true, repo: true, branch, upstream, ahead, behind, fresh, remotes: remote.out.split('\n').filter(Boolean), files };
  }

  /** The file as it was at the last commit (null if it's new). */
  async base(rel) {
    const prefix = await this.prefix();
    if (prefix === null) return null;
    const clean = this.F.rel(this.F.abs(rel));
    const r = await this.run(['show', `HEAD:${prefix}${clean}`], { max: 4 * 1024 * 1024 });
    if (r.code !== 0) return null;
    if (r.out.includes('\0')) return null;
    return r.out.replace(/\r\n/g, '\n');
  }

  _paths(list) {
    const out = (Array.isArray(list) ? list : [list]).map((p) => this.F.rel(this.F.abs(p))).filter(Boolean);
    if (!out.length) throw fail('bad', 'Which files?');
    return out;
  }

  async stage(paths) {
    const r = await this.run(['add', '-A', '--', ...this._paths(paths)]);
    if (r.code !== 0) throw explain(r, 'stage that');
    return {};
  }

  async unstage(paths) {
    const list = this._paths(paths);
    let r = await this.run(['restore', '--staged', '--', ...list]);
    if (r.code !== 0) r = await this.run(['reset', '-q', 'HEAD', '--', ...list]);
    if (r.code !== 0) r = await this.run(['rm', '--cached', '-q', '-r', '--', ...list]); // a repo with no commits yet
    if (r.code !== 0) throw explain(r, 'unstage that');
    return {};
  }

  /** Throw away changes: new files go to den's bin, changed ones are kept in earlier versions first. */
  async discard(paths) {
    const st = await this.status();
    const list = this._paths(paths);
    const binned = [];
    const back = [];
    for (const p of list) {
      const f = (st.files || []).find((x) => x.path === p);
      if (!f) continue;
      if (f.untracked || (f.x === 'A' && !f.changed)) {
        if (f.x === 'A') await this.run(['rm', '--cached', '-q', '--', p]);
        binned.push(this.F.trash(p).id);
        continue;
      }
      try { this.F.remember(p); } catch { /* a deleted file has nothing to keep */ }
      back.push(p);
    }
    if (back.length) {
      let r = await this.run(['restore', '--staged', '--worktree', '--source=HEAD', '--', ...back]);
      if (r.code !== 0) r = await this.run(['checkout', 'HEAD', '--', ...back]);
      if (r.code !== 0) throw explain(r, 'undo those changes');
    }
    return { binned, restored: back };
  }

  /** Save a commit. Nothing staged: everything is committed (the beginner-friendly way). */
  async commit(message) {
    const msg = String(message || '').trim();
    if (!msg) throw fail('empty', 'Write a few words about what you changed first.');
    const st = await this.status();
    if (!st.repo) throw fail('no_repo', 'This folder isn\'t tracked with git yet.');
    const staged = st.files.some((f) => f.staged);
    if (!staged) {
      if (!st.files.length) throw fail('nothing', 'There is nothing new to commit.');
      const a = await this.run(['add', '-A', '--', '.']);
      if (a.code !== 0) throw explain(a, 'stage the changes');
    }
    const r = await this.run(['commit', '-q', '-F', '-'], { input: msg });
    if (r.code !== 0) throw explain(r, 'commit');
    const h = await this.run(['log', '-1', '--pretty=format:%h']);
    return { hash: h.out.trim(), all: !staged };
  }

  async identity(name, email) {
    name = String(name || '').trim().slice(0, 120);
    email = String(email || '').trim().slice(0, 200);
    if (!name || !/^[^\s@]+@[^\s@]+$/.test(email)) throw fail('bad', 'Type your name and an email address.');
    for (const [k, v] of [['user.name', name], ['user.email', email]]) {
      const r = await this.run(['config', '--global', k, v]);
      if (r.code !== 0) throw explain(r, 'save that');
    }
    return {};
  }

  async push() {
    const st = await this.status();
    if (!st.remotes || !st.remotes.length) throw fail('no_remote', 'This project isn\'t connected to GitHub (or another server) yet.');
    const args = st.upstream ? ['push'] : ['push', '-u', st.remotes.includes('origin') ? 'origin' : st.remotes[0], st.branch || 'HEAD'];
    const r = await this.run(args, { timeout: 120000 });
    if (r.code !== 0) throw explain(r, 'push');
    return { said: (r.err || r.out).trim().split('\n').slice(-2).join('\n') };
  }

  async pull() {
    const st = await this.status();
    if (!st.remotes || !st.remotes.length) throw fail('no_remote', 'This project isn\'t connected to GitHub (or another server) yet.');
    if (!st.upstream) throw fail('upstream', 'This branch isn\'t on GitHub yet, so there is nothing to pull. Push it first.');
    const r = await this.run(['pull', '--ff-only'], { timeout: 120000 });
    if (r.code !== 0) throw explain(r, 'pull');
    return { said: (r.out || r.err).trim().split('\n').slice(-2).join('\n') };
  }

  async connect(url) {
    url = String(url || '').trim();
    if (!/^(https:\/\/|git@)[\w.@:/~-]+$/.test(url)) throw fail('bad', 'Paste the address GitHub shows for the repository (it starts with https://).');
    const st = await this.status();
    const r = await this.run(st.remotes.includes('origin') ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url]);
    if (r.code !== 0) throw explain(r, 'connect it');
    return {};
  }

  async branches() {
    const r = await this.run(['branch', '--format=%(refname:short)']);
    if (r.code !== 0) throw explain(r, 'list the branches');
    const cur = await this.run(['rev-parse', '--abbrev-ref', 'HEAD']);
    return { current: cur.out.trim(), list: r.out.split('\n').filter(Boolean) };
  }

  async checkout(branch, create = false) {
    branch = String(branch || '').trim();
    if (!/^[\w./-]{1,100}$/.test(branch) || branch.startsWith('-') || branch.includes('..')) throw fail('bad', 'Branch names can use letters, numbers, - _ . and /.');
    let r = await this.run(create ? ['switch', '-c', branch] : ['switch', branch]);
    if (r.code !== 0) r = await this.run(create ? ['checkout', '-b', branch] : ['checkout', branch]);
    if (r.code !== 0) throw explain(r, 'switch branches');
    return { branch };
  }

  async log(n = 30) {
    const r = await this.run(['log', `-n${Math.min(200, n)}`, '--pretty=format:%h%x1f%an%x1f%at%x1f%s']);
    if (r.code !== 0) return { items: [] };
    return { items: r.out.split('\n').filter(Boolean).map((l) => { const [hash, who, at, subject] = l.split('\x1f'); return { hash, who, at: +at * 1000, subject }; }) };
  }

  async init() {
    let r = await this.run(['init', '-b', 'main']);
    if (r.code !== 0) r = await this.run(['init']);
    if (r.code !== 0) throw explain(r, 'start tracking this folder');
    this._prefix = null;
    return {};
  }

  /** What changed, for writing a commit message (cut down to a size an AI can read). */
  async changes(limit = 12000) {
    let r = await this.run(['diff', '--cached', '--stat', '--patch', '--', '.']);
    let text = r.out;
    if (!text.trim()) {
      r = await this.run(['diff', '--stat', '--patch', '--', '.']);
      text = r.out;
      const st = await this.status();
      const fresh = (st.files || []).filter((f) => f.untracked).map((f) => f.path);
      if (fresh.length) text += `\nNew files: ${fresh.slice(0, 40).join(', ')}`;
    }
    return text.length > limit ? text.slice(0, limit) + '\n…(more changes not shown)' : text;
  }
}

module.exports = { Git, git, explain };
