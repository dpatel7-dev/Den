'use strict';
// den's little web server: the page in your browser talks to it to read and
// save files, run code and ask Ember. It only listens on this computer
// (127.0.0.1), every address carries a random secret, and requests from other
// web pages are refused, so websites you visit can't reach your files.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const { Folder, mimeOf, kindOf, home } = require('./files');
const { Runner, plan } = require('./run');
const { Git } = require('./git');
const { Terms } = require('./term');
const { check } = require('./check');
const AI = require('./ai');
const Ember = require('./ember');
const pkg = require('../package.json');

const WEB = path.join(__dirname, '..', 'web');
const PAGE = path.join(WEB, 'den.html');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const THEMES = ['ember', 'dusk', 'moss', 'daylight', 'frost'];
const SETTINGS = {
  theme: THEMES.concat(['dark', 'light']), autosave: ['on', 'off'], wrap: ['auto', 'on', 'off'], tab: ['auto', '2', '4', '8'], size: null, ai: null,
  minimap: ['on', 'off'], guides: ['on', 'off'], check: ['on', 'off'], glass: ['on', 'off'],
};

const config = {
  file: () => path.join(home(), 'config.json'),
  load() { return readJson(this.file(), {}); },
  save(c) {
    fs.mkdirSync(home(), { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify(c, null, 2));
  },
};

class Den extends EventEmitter {
  constructor(root, { token = null } = {}) {
    super();
    this.folder = new Folder(root);
    this.token = token || crypto.randomBytes(18).toString('base64url');
    this.runner = new Runner();
    this.git = new Git(this.folder);
    this.terms = new Terms(this.folder.root);
    this.terms.on('event', (ev) => this.push(ev));
    this.pages = new Set();
    this.server = null;
    this.port = 0;
    this.preview = null; // a second, separate address that only shows files (for page previews)
    this.previewPort = 0;
    this.watcher = null;
    this.saving = new Map(); // path -> when den itself last wrote it (so it isn't reported as "changed outside")
    this.runner.on('event', (ev) => {
      this.push(ev);
      if (ev.t === 'end') this.emit('log', `${ev.code === 0 ? 'ran' : 'stopped'} ${this.lastRun || 'a command'}${ev.code === 0 ? '' : ev.stopped ? ' (you stopped it)' : ` (exit code ${ev.code})`}`);
    });
  }

  url(rest = '') {
    return `http://127.0.0.1:${this.port}/${this.token}/${rest}`;
  }

  push(ev) {
    const line = `data: ${JSON.stringify(ev)}\n\n`;
    for (const res of this.pages) res.write(line);
  }

  // ── starting and stopping ─────────────────────────────────────────────
  async start(port = 0) {
    const remembered = Number(config.load().port) || 0;
    const tries = port ? [port] : remembered ? [remembered, 0] : [0];
    for (const p of tries) {
      try {
        await this._listen(p);
        break;
      } catch (e) {
        if (p === tries[tries.length - 1]) throw e;
      }
    }
    if (!port && this.port !== remembered) {
      try { config.save({ ...config.load(), port: this.port }); } catch { /* fine */ }
    }
    await this._listenPreview();
    this._watch();
    return this.port;
  }

  /**
   * Previews of your web pages come from their own address (another port), so
   * a page can't reach den's controls, while its scripts, errors and saved data
   * work just like on a real website.
   */
  _listenPreview() {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const host = String(req.headers.host || '');
        if (host !== `127.0.0.1:${this.previewPort}` && host !== `localhost:${this.previewPort}`) return this._send(res, 403, 'no\n', 'text/plain');
        const u = new URL(req.url, `http://${host}`);
        const parts = u.pathname.split('/');
        if (parts[1] !== this.token || parts[2] !== 'raw' || !(req.method === 'GET' || req.method === 'HEAD')) return this._send(res, 404, 'not found\n', 'text/plain');
        let rel;
        try { rel = decodeURIComponent(parts.slice(3).join('/')); } catch { return this._send(res, 400, 'bad address\n', 'text/plain'); }
        return this._raw(req, res, rel, true);
      });
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        this.preview = server;
        this.previewPort = server.address().port;
        resolve();
      });
    });
  }

  _listen(port) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this._handle(req, res).catch((e) => this._send(res, 500, { ok: false, error: e.message })));
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        this.server = server;
        this.port = server.address().port;
        resolve();
      });
    });
  }

  close() {
    this.runner.stop();
    this.terms.closeAll();
    if (this.watcher) this.watcher.close();
    for (const res of this.pages) res.end();
    this.pages.clear();
    if (this.server) this.server.close();
    if (this.preview) this.preview.close();
  }

  /** Tell the page when files change on disk (another editor, git, a program you ran). */
  _watch() {
    const pending = new Set();
    let timer = null;
    const flush = () => {
      timer = null;
      const now = Date.now();
      const paths = [...pending].filter((p) => !(this.saving.get(p) > now - 1500));
      pending.clear();
      if (paths.length) this.push({ t: 'fs', paths: paths.slice(0, 200) });
    };
    try {
      this.watcher = fs.watch(this.folder.root, { recursive: true }, (ev, name) => {
        if (!name) return;
        const rel = String(name).split(path.sep).join('/');
        const top = rel.split('/')[0];
        if (top === '.git' || /(^|\/)(node_modules|__pycache__|\.venv)(\/|$)/.test(rel) || rel.includes('.den-')) return;
        pending.add(rel);
        if (!timer) timer = setTimeout(flush, 200);
      });
      this.watcher.on('error', () => {});
    } catch { /* this computer can't watch whole folders: the page refreshes when you come back to it */ }
  }

  // ── requests ──────────────────────────────────────────────────────────
  _send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
    if (res.headersSent) { try { res.end(); } catch { /* gone */ } return; }
    res.writeHead(code, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra,
    });
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  }

  async _body(req) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > 40 * 1024 * 1024) throw new Error('That is too much to save at once.');
      chunks.push(c);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
  }

  async _handle(req, res) {
    // Only this computer, only our own address (this stops "DNS rebinding" tricks).
    const host = String(req.headers.host || '');
    if (host !== `127.0.0.1:${this.port}` && host !== `localhost:${this.port}`) return this._send(res, 403, 'no\n', 'text/plain');
    const u = new URL(req.url, `http://${host}`);
    const parts = u.pathname.split('/');
    if (parts[1] !== this.token) return this._send(res, 404, 'not found\n', 'text/plain');
    const route = parts.slice(2).join('/');
    const origin = req.headers.origin;
    const fromUs = !origin || origin === `http://${host}`;

    // the files themselves, for pictures (in a sandbox: they can't use den's controls)
    if (route.startsWith('raw/') && (req.method === 'GET' || req.method === 'HEAD')) {
      let rel;
      try { rel = decodeURIComponent(route.slice(4)); } catch { return this._send(res, 400, 'bad address\n', 'text/plain'); }
      return this._raw(req, res, rel, false);
    }
    if (route === '' && req.method === 'GET') return this._page(res);
    if (route.startsWith('static/') && req.method === 'GET') {
      const name = route.slice(7);
      if (!/^[a-z]+\.(js|css)$/.test(name)) return this._send(res, 404, 'not found\n', 'text/plain');
      let body;
      try { body = fs.readFileSync(path.join(WEB, name)); } catch { return this._send(res, 404, 'not found\n', 'text/plain'); }
      return this._send(res, 200, body, name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    }
    if (!route.startsWith('api/')) return this._send(res, 404, { ok: false, error: 'not found' });
    // everything that reads or changes your files has to come from den's own page
    if (!fromUs || (req.method === 'POST' && !/^application\/json/.test(String(req.headers['content-type'] || '')))) {
      return this._send(res, 403, { ok: false, error: 'not allowed' });
    }
    const name = route.slice(4);
    const q = Object.fromEntries(u.searchParams);
    const F = this.folder;
    try {
      if (req.method === 'GET') {
        switch (name) {
          case 'state': return this._send(res, 200, this.state());
          case 'list': return this._send(res, 200, { ok: true, items: F.list(q.path || '') });
          case 'files': return this._send(res, 200, { ok: true, files: F.files() });
          case 'read': return this._send(res, 200, { ok: true, file: F.read(q.path), runnable: this.runnable(q.path) });
          case 'search': return this._send(res, 200, { ok: true, ...F.search(q.q, { caseSensitive: q.case === '1', word: q.word === '1', regex: q.regex === '1', include: q.include || '' }) });
          case 'git/status': return this._send(res, 200, { ok: true, ...(await this.git.status()) });
          case 'git/base': return this._send(res, 200, { ok: true, text: await this.git.base(q.path) });
          case 'git/branches': return this._send(res, 200, { ok: true, ...(await this.git.branches()) });
          case 'git/log': return this._send(res, 200, { ok: true, ...(await this.git.log(Number(q.n) || 30)) });
          case 'term/list': return this._send(res, 200, { ok: true, pty: this.terms.pty, items: this.terms.info() });
          case 'bin': return this._send(res, 200, { ok: true, items: F.bin() });
          case 'history': return this._send(res, 200, { ok: true, items: F.history(q.path) });
          case 'version': return this._send(res, 200, { ok: true, text: F.version(q.path, q.id) });
          case 'ai': return this._send(res, 200, { ok: true, ...(await this.aiState()) });
          case 'events': return this._stream(req, res);
          default: return this._send(res, 404, { ok: false, error: 'not found' });
        }
      }
      if (req.method !== 'POST') return this._send(res, 405, { ok: false, error: 'not allowed' });
      const m = await this._body(req);
      switch (name) {
        case 'save': {
          const p = F.rel(F.abs(m.path));
          this.saving.set(p, Date.now());
          const r = F.save(p, m.text, { base: m.base, eol: m.eol, bom: !!m.bom, force: !!m.force });
          this.saving.set(p, Date.now());
          if (!r.same) this.emit('log', `saved ${p}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'create': {
          const r = F.create(m.path, !!m.dir);
          this.emit('log', `made ${r.path}${m.dir ? '/' : ''}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'rename': {
          const r = F.rename(m.from, m.to);
          this.emit('log', `renamed ${r.from} to ${r.to}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'trash': {
          const r = F.trash(m.path);
          this.emit('log', `moved ${r.path} to den's bin`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'restore': {
          const r = F.restore(m.id);
          this.emit('log', `put back ${r.path}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'run': {
          if (m.path) {
            const full = F.abs(m.path);
            this.lastRun = F.rel(full);
            return this._send(res, 200, { ok: true, ...this.runner.start({ file: full }) });
          }
          this.lastRun = String(m.command || '').slice(0, 60);
          return this._send(res, 200, { ok: true, ...this.runner.start({ command: m.command, cwd: F.root }) });
        }
        case 'input': return this._send(res, 200, { ok: this.runner.input(String(m.text || '').slice(0, 10000)) });
        case 'stop': return this._send(res, 200, { ok: this.runner.stop() });
        case 'settings': {
          const c = config.load();
          const s = { ...(c.settings || {}) };
          for (const [k, v] of Object.entries(m || {})) {
            if (!(k in SETTINGS)) continue;
            if (SETTINGS[k] && !SETTINGS[k].includes(String(v))) continue;
            if (k === 'size' && !(Number(v) >= 10 && Number(v) <= 28)) continue;
            s[k] = k === 'size' ? Number(v) : String(v).slice(0, 200);
          }
          config.save({ ...c, settings: s });
          return this._send(res, 200, { ok: true, settings: s });
        }
        case 'reveal': {
          const full = F.abs(m.path || '');
          reveal(full);
          return this._send(res, 200, { ok: true });
        }
        case 'ask': return this._ask(req, res, m);
        case 'replace': {
          const r = F.replace(m.q, m.with, { caseSensitive: !!m.case, word: !!m.word, regex: !!m.regex, include: m.include || '', paths: m.paths || null });
          if (r.count) this.emit('log', `replaced ${r.count} in ${r.files.length} file${r.files.length === 1 ? '' : 's'}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'upload': {
          const r = F.upload(m.dir, m.name, m.data);
          this.emit('log', `added ${r.path}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'check': {
          if ((config.load().settings || {}).check === 'off') return this._send(res, 200, { ok: true, problems: null });
          const problems = await check(String(m.path || ''), m.text, String(m.lang || ''));
          return this._send(res, 200, { ok: true, problems });
        }
        case 'git/stage': return this._send(res, 200, { ok: true, ...(await this.git.stage(m.paths)) });
        case 'git/unstage': return this._send(res, 200, { ok: true, ...(await this.git.unstage(m.paths)) });
        case 'git/discard': {
          const r = await this.git.discard(m.paths);
          this.emit('log', `undid changes to ${(m.paths || []).length} file${(m.paths || []).length === 1 ? '' : 's'}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'git/commit': {
          const r = await this.git.commit(m.message);
          this.emit('log', `committed ${r.hash}`);
          return this._send(res, 200, { ok: true, ...r });
        }
        case 'git/identity': return this._send(res, 200, { ok: true, ...(await this.git.identity(m.name, m.email)) });
        case 'git/push': { const r = await this.git.push(); this.emit('log', 'pushed'); return this._send(res, 200, { ok: true, ...r }); }
        case 'git/pull': { const r = await this.git.pull(); this.emit('log', 'pulled'); return this._send(res, 200, { ok: true, ...r }); }
        case 'git/connect': return this._send(res, 200, { ok: true, ...(await this.git.connect(m.url)) });
        case 'git/checkout': return this._send(res, 200, { ok: true, ...(await this.git.checkout(m.branch, !!m.create)) });
        case 'git/init': { const r = await this.git.init(); this.emit('log', 'started tracking changes with git'); return this._send(res, 200, { ok: true, ...r }); }
        case 'git/message': return this._send(res, 200, await this._commitMessage());
        case 'term/open': {
          const cwd = m.path ? F.abs(m.path) : null;
          return this._send(res, 200, { ok: true, ...this.terms.open({ cols: m.cols, rows: m.rows, cwd: cwd && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory() ? cwd : null }) });
        }
        case 'term/input': return this._send(res, 200, { ok: this.terms.input(m.id, String(m.data || '').slice(0, 100000)) });
        case 'term/resize': return this._send(res, 200, { ok: this.terms.resize(m.id, m.cols, m.rows) });
        case 'term/close': return this._send(res, 200, { ok: this.terms.close(m.id) });
        default: return this._send(res, 404, { ok: false, error: 'not found' });
      }
    } catch (e) {
      return this._send(res, 200, { ok: false, code: e.code || null, error: e.message });
    }
  }

  async _commitMessage() {
    const choice = (config.load().settings || {}).ai || null;
    const { model } = await AI.current(choice);
    if (!model) return { ok: false, code: 'no_ai', error: 'Writing commit messages needs Ember\'s AI (set it up in the Ask tab).' };
    const diff = await this.git.changes();
    if (!diff.trim()) return { ok: false, code: 'nothing', error: 'There is nothing new to describe.' };
    const r = await AI.complete({ model, system: AI.COMMIT, user: `The changes:\n${diff}` });
    const line = r.text.replace(/```[\s\S]*?```/g, '').split('\n').map((x) => x.trim().replace(/^["'`]+|["'`.]+$/g, '').replace(/^(feat|fix|chore|docs|refactor|style|test)(\([^)]*\))?:\s*/i, '')).find(Boolean) || '';
    return { ok: !!line, message: line.slice(0, 100), error: line ? null : 'No message came back. Try again.' };
  }

  runnable(rel) {
    try {
      const p = plan(this.folder.abs(rel));
      if (!p) return null;
      return p.error ? { name: p.name, missing: p.error } : { name: p.name };
    } catch {
      return null;
    }
  }

  state() {
    const c = config.load();
    const homeDir = require('os').homedir();
    const shown = this.folder.root.startsWith(homeDir) ? '~' + this.folder.root.slice(homeDir.length) : this.folder.root;
    return {
      ok: true, version: pkg.version, name: this.folder.name, where: shown, branch: this.folder.branch(),
      preview: `http://127.0.0.1:${this.previewPort}/${this.token}/raw/`,
      platform: process.platform, settings: c.settings || {}, running: this.runner.job ? { label: this.runner.job.label } : null, pty: this.terms.pty,
      home: shown.startsWith('~') ? '~' : null, root: this.folder.root,
      ember: Ember.web(),
    };
  }

  async aiState() {
    const choice = (config.load().settings || {}).ai || null;
    const { model, all } = await AI.current(choice);
    const tot = fs.existsSync(path.join(AI.totHome(), 'config.json'));
    return {
      ready: !!model, tot,
      model: model ? { key: AI.keyOf(model), name: model.name, free: !!model.free, local: AI.local(model) } : null,
      models: all.map((m) => ({ key: AI.keyOf(m), name: m.name, free: !!m.free, local: AI.local(m) })),
    };
  }

  _page(res) {
    const html = fs.readFileSync(PAGE, 'utf8').replace('__CONFIG__', () => JSON.stringify({ base: `/${this.token}/`, ...this.state() }).replace(/</g, '\\u003c'));
    return this._send(res, 200, html, 'text/html; charset=utf-8', {
      'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' http://127.0.0.1:${this.previewPort}; object-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
  }

  _raw(req, res, rel, preview = false) {
    let file;
    try { file = this.folder.abs(rel); } catch { return this._send(res, 403, 'no\n', 'text/plain'); }
    let st;
    try { st = fs.statSync(file); } catch { return this._send(res, 404, 'not found\n', 'text/plain'); }
    if (st.isDirectory()) {
      // a folder: its index.html, so page previews can link to folders
      const index = path.join(file, 'index.html');
      if (fs.existsSync(index)) return this._raw(req, res, this.folder.rel(index), preview);
      return this._send(res, 404, 'not found\n', 'text/plain');
    }
    const type = mimeOf(file);
    const headers = {
      'Content-Type': /^text\/|json|javascript|svg/.test(type) ? `${type}; charset=utf-8` : type,
      'Content-Length': st.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Access-Control-Allow-Origin': '*', // so a page you're previewing can load its own data files
    };
    // On den's own address, files from the folder run in a sandbox: they can't reach den's controls.
    // (Page previews come from the separate preview address instead.)
    if (!preview && kindOf(file) !== 'pdf') headers['Content-Security-Policy'] = 'sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads';
    if (preview) delete headers['Access-Control-Allow-Origin'];
    if (preview && type === 'text/html' && st.size < 8 * 1024 * 1024) {
      // den's preview: the page's console.log and errors also show in den's console
      const body = Buffer.from(withListener(fs.readFileSync(file, 'utf8')), 'utf8');
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.end()).pipe(res);
    return undefined;
  }

  _stream(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify({ t: 'hello', running: this.runner.job ? { id: this.runner.job.id, label: this.runner.job.label } : null })}\n\n`);
    this.pages.add(res);
    clearTimeout(this._orphans);
    this.emit('pages', this.pages.size);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      this.pages.delete(res);
      // with no page open for a while, its terminals are closed (a reload picks them back up)
      if (!this.pages.size) { clearTimeout(this._orphans); this._orphans = setTimeout(() => this.terms.closeAll(), 3 * 60 * 1000); this._orphans.unref(); }
      this.emit('pages', this.pages.size);
    });
  }

  /** Ember answers, streamed as plain text as it's written. */
  async _ask(req, res, m) {
    const question = String(m.question || '').trim().slice(0, 4000);
    if (!question) return this._send(res, 200, { ok: false, error: 'Ask something first.' });
    const choice = (config.load().settings || {}).ai || null;
    const { model } = await AI.current(choice);
    if (!model) return this._send(res, 200, { ok: false, code: 'no_ai', error: 'No AI is set up yet.' });
    const c = m.context || {};
    const context = {
      file: typeof c.file === 'string' ? c.file.slice(0, 300) : null, lang: typeof c.lang === 'string' ? c.lang.slice(0, 30) : '',
      text: typeof c.text === 'string' ? c.text : '', selection: typeof c.selection === 'string' ? c.selection : '',
      error: typeof c.error === 'string' ? c.error : '', folder: this.folder.name,
    };
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ac.abort(); });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Den-Model': encodeURIComponent(model.name) });
    try {
      await AI.ask({ model, question, context, history: Array.isArray(m.history) ? m.history : [], signal: ac.signal, onText: (t) => res.write(t) });
      this.emit('log', 'Ember answered a question');
    } catch (e) {
      if (e.name !== 'AbortError') res.write(`\n\n\u0000${e.message}`); // \0 marks "this part is an error" for the page
    }
    res.end();
    return undefined;
  }
}

// Added to a page in den's preview (on the same line, so line numbers don't move):
// passes the page's console messages and errors to den.
const LISTENER = '<script>(function(){var s=function(k,a){try{parent.postMessage({den:1,k:k,t:[].map.call(a,function(x){try{return x&&typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}};["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){s(k,arguments);return o.apply(console,arguments)}});addEventListener("error",function(e){s("error",[(e.error&&e.error.name?e.error.name+": ":"")+String(e.message).replace(/^Uncaught (\\w+: )?/,"")+(e.filename?" ("+e.filename.split("/").pop().split("?")[0]+":"+e.lineno+")":"")])});addEventListener("unhandledrejection",function(e){s("error",["Uncaught (in promise) "+String(e.reason)])})})();</script>';

function withListener(html) {
  const m = html.match(/<head[^>]*>/i) || html.match(/<html[^>]*>/i) || html.match(/<!doctype[^>]*>/i);
  if (!m) return LISTENER + html;
  const at = m.index + m[0].length;
  return html.slice(0, at) + LISTENER + html.slice(at);
}

/** Show a file or folder in Finder / Explorer / the file manager. */
function reveal(full) {
  const { spawn } = require('child_process');
  let cmd;
  if (process.platform === 'darwin') cmd = ['open', ['-R', full]];
  else if (process.platform === 'win32') cmd = ['explorer', [`/select,${full}`]];
  else cmd = ['xdg-open', [fs.statSync(full).isDirectory() ? full : path.dirname(full)]];
  if (process.env.DEN_NO_BROWSER === '1') return;
  try {
    const child = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch { /* nothing to open it with */ }
}

module.exports = { Den, config, withListener, LISTENER };
