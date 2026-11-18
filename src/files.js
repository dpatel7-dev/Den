'use strict';
// The folder den has open: reading, saving, making and moving files, and never
// anything outside it. Deleting moves things to den's bin (so it can be undone),
// and every save keeps the version before it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const home = () => process.env.DEN_HOME || path.join(os.homedir(), '.den');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

const TEXT_MAX = 3 * 1024 * 1024; // bigger text files are shown, not edited
const HIDDEN = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.den-run']);
// shown in the tree, but too big and boring to search or list in quick open
const HEAVY = new Set(['node_modules', '.venv', 'venv', 'env', '__pycache__', '.next', '.nuxt', 'dist', 'build', '.cache', 'target', '.gradle', 'Pods', '.idea', '.vscode', 'coverage', '.pytest_cache', '.mypy_cache']);
const KEEP = 25; // earlier versions kept for each file

const KINDS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
  video: ['mp4', 'webm', 'mov', 'm4v'],
  pdf: ['pdf'],
};
const MIME = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  txt: 'text/plain', md: 'text/plain', csv: 'text/csv', xml: 'text/xml', wasm: 'application/wasm',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4', pdf: 'application/pdf',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
};

const ext = (p) => (path.extname(p).slice(1) || '').toLowerCase();
function kindOf(p) {
  const e = ext(p);
  for (const [k, list] of Object.entries(KINDS)) if (list.includes(e)) return k;
  return null;
}
const mimeOf = (p) => MIME[ext(p)] || 'application/octet-stream';

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** Text if the bytes are text (UTF-8, no zero bytes), else null. */
function asText(buf) {
  if (buf.subarray(0, 8000).includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

/** Write a file in one go: to a temporary file first, then swapped in, so a crash never leaves half a file. */
function writeAtomic(file, data, mode) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.den-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, data, mode ? { mode } : undefined);
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* gone */ }
    throw e;
  }
}

class Folder {
  constructor(root) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) throw fail('not_folder', `${root} is a file, not a folder.`);
    this.id = hash(this.root).slice(0, 16);
    this.name = path.basename(this.root) || this.root;
  }

  /** "src/app.py" -> its full path. Refuses anything that would leave the folder (.., links pointing out). */
  abs(rel) {
    const clean = String(rel == null ? '' : rel).replace(/\\/g, '/').replace(/^\/+/, '');
    if (clean.length > 4096 || clean.includes('\0') || clean.split('/').includes('..')) throw fail('outside', "That's outside the folder den has open.");
    const full = path.resolve(this.root, clean);
    const inside = (p) => p === this.root || p.startsWith(this.root + path.sep);
    if (!inside(full)) throw fail('outside', "That's outside the folder den has open.");
    let real;
    try {
      real = fs.realpathSync(full);
    } catch {
      try { real = path.join(fs.realpathSync(path.dirname(full)), path.basename(full)); } catch { real = full; }
    }
    if (!inside(real)) throw fail('outside', "That's outside the folder den has open.");
    return full;
  }

  rel(full) {
    return path.relative(this.root, full).split(path.sep).join('/');
  }

  /** One folder's contents: folders first, then files, A to Z. */
  list(rel = '') {
    const dir = this.abs(rel);
    let names;
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      throw fail('missing', e.code === 'ENOENT' ? "That folder isn't there any more." : `Couldn't open that folder (${e.code}).`);
    }
    const out = [];
    for (const d of names) {
      if (HIDDEN.has(d.name) || d.name.includes('.den-')) continue;
      const full = path.join(dir, d.name);
      let st;
      try { st = fs.statSync(full); } catch { continue; } // a broken link
      out.push({
        name: d.name, path: this.rel(full), dir: st.isDirectory(), size: st.isDirectory() ? 0 : st.size,
        mtime: st.mtimeMs, heavy: st.isDirectory() && HEAVY.has(d.name), link: d.isSymbolicLink(),
      });
    }
    return out.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  }

  /** Every file, for quick open (skips the heavy folders). */
  files(limit = 20000) {
    const out = [];
    const walk = (dir, depth) => {
      if (out.length >= limit || depth > 20) return;
      let names;
      try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const d of names) {
        if (HIDDEN.has(d.name) || HEAVY.has(d.name) || d.name.includes('.den-')) continue;
        const full = path.join(dir, d.name);
        if (d.isDirectory()) walk(full, depth + 1);
        else if (d.isFile()) out.push(this.rel(full));
        if (out.length >= limit) return;
      }
    };
    walk(this.root, 0);
    return out.sort();
  }

  /** A file, ready for the editor or a preview. */
  read(rel) {
    const file = this.abs(rel);
    let st;
    try { st = fs.statSync(file); } catch { throw fail('missing', "That file isn't there any more."); }
    if (st.isDirectory()) throw fail('is_folder', "That's a folder.");
    const base = { path: this.rel(file), name: path.basename(file), size: st.size, mtime: st.mtimeMs, kind: kindOf(file) };
    if (base.kind && base.kind !== 'image') return base;
    if (base.kind === 'image' && ext(file) !== 'svg') return base;
    if (st.size > TEXT_MAX) return { ...base, kind: base.kind || 'big' };
    const buf = fs.readFileSync(file);
    let text = asText(buf);
    if (text === null) return { ...base, kind: base.kind || 'binary' };
    const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf; // the decoder drops it, so look at the bytes
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const eol = /\r\n/.test(text.slice(0, 20000)) ? '\r\n' : '\n';
    if (eol === '\r\n') text = text.replace(/\r\n/g, '\n');
    return { ...base, kind: base.kind || 'text', text, eol, bom, version: hash(buf).slice(0, 20) };
  }

  /**
   * Save text. base: the version the editor started from. If the file changed
   * on disk since (someone else saved it), nothing is written and you're told.
   */
  save(rel, text, { base = null, eol = '\n', bom = false, force = false } = {}) {
    if (typeof text !== 'string') throw fail('bad', 'Nothing to save.');
    const file = this.abs(rel);
    let old = null;
    let mode;
    try {
      old = fs.readFileSync(file);
      mode = fs.statSync(file).mode;
    } catch { /* a new file */ }
    if (old && base && !force && hash(old).slice(0, 20) !== base) {
      throw fail('changed', 'This file was changed outside den since you opened it.');
    }
    let out = eol === '\r\n' ? text.replace(/\r?\n/g, '\r\n') : text;
    if (bom) out = '﻿' + out;
    const buf = Buffer.from(out, 'utf8');
    if (old && old.equals(buf)) return { version: hash(buf).slice(0, 20), mtime: fs.statSync(file).mtimeMs, size: buf.length, same: true };
    if (old && old.length) this._remember(rel, old);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, buf, mode);
    return { version: hash(buf).slice(0, 20), mtime: fs.statSync(file).mtimeMs, size: buf.length };
  }

  /** A new, empty file or folder. */
  create(rel, dir = false) {
    const clean = String(rel || '').trim();
    if (!clean || /[<>:"|?*]/.test(clean.replace(/^[A-Za-z]:/, ''))) throw fail('bad_name', 'Names can\'t use < > : " | ? *');
    const file = this.abs(clean);
    if (fs.existsSync(file)) throw fail('exists', `There's already something called ${path.basename(file)} there.`);
    if (dir) fs.mkdirSync(file, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '', { flag: 'wx' });
    }
    return { path: this.rel(file), dir };
  }

  rename(from, to) {
    const a = this.abs(from);
    const b = this.abs(String(to || '').trim());
    if (a === this.root) throw fail('root', "The folder den has open can't be renamed from here.");
    if (!fs.existsSync(a)) throw fail('missing', "That isn't there any more.");
    if (fs.existsSync(b) && a.toLowerCase() !== b.toLowerCase()) throw fail('exists', `There's already something called ${path.basename(b)} there.`);
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.renameSync(a, b);
    return { from: this.rel(a), to: this.rel(b) };
  }

  // ── the bin: "delete" moves things here, and they can come back ───────
  _binDir() {
    return path.join(home(), 'bin', this.id);
  }

  _binIndex() {
    try { return JSON.parse(fs.readFileSync(path.join(this._binDir(), 'index.json'), 'utf8')); } catch { return []; }
  }

  _binSave(list) {
    fs.mkdirSync(this._binDir(), { recursive: true });
    writeAtomic(path.join(this._binDir(), 'index.json'), JSON.stringify(list, null, 1));
  }

  trash(rel) {
    const file = this.abs(rel);
    if (file === this.root) throw fail('root', "den can't put the whole folder in the bin.");
    let st;
    try { st = fs.statSync(file); } catch { throw fail('missing', "That isn't there any more."); }
    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const dest = path.join(this._binDir(), id);
    fs.mkdirSync(dest, { recursive: true });
    const target = path.join(dest, path.basename(file));
    try {
      fs.renameSync(file, target);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      fs.cpSync(file, target, { recursive: true }); // another disk: copy, then remove
      fs.rmSync(file, { recursive: true, force: true });
    }
    const list = this._binIndex();
    list.unshift({ id, path: this.rel(file), name: path.basename(file), dir: st.isDirectory(), at: Date.now() });
    // the bin keeps the newest 200 things; older ones go for good
    for (const old of list.splice(200)) fs.rmSync(path.join(this._binDir(), old.id), { recursive: true, force: true });
    this._binSave(list);
    return { id, path: this.rel(file) };
  }

  bin() {
    return this._binIndex();
  }

  restore(id) {
    const list = this._binIndex();
    const item = list.find((x) => x.id === id);
    if (!item) throw fail('missing', "That's not in the bin any more.");
    let to = this.abs(item.path);
    if (fs.existsSync(to)) {
      const e = path.extname(to);
      to = to.slice(0, to.length - e.length) + ' (restored)' + e;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const from = path.join(this._binDir(), item.id, item.name);
    try {
      fs.renameSync(from, to);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      fs.cpSync(from, to, { recursive: true });
    }
    fs.rmSync(path.join(this._binDir(), item.id), { recursive: true, force: true });
    this._binSave(list.filter((x) => x.id !== id));
    return { path: this.rel(to) };
  }

  // ── earlier versions: every save keeps the one before ─────────────────
  _histDir(rel) {
    return path.join(home(), 'history', this.id, hash(this.rel(this.abs(rel))).slice(0, 24));
  }

  _remember(rel, buf, always = false) {
    const dir = this._histDir(rel);
    fs.mkdirSync(dir, { recursive: true });
    const last = this.history(rel)[0];
    // a burst of saves (autosave) keeps one version a minute
    if (!always && last && Date.now() - last.at < 60000) return;
    if (last && last.at >= Date.now()) return; // (two in the same millisecond)
    fs.writeFileSync(path.join(dir, `${Date.now()}.txt`), buf);
    fs.writeFileSync(path.join(dir, 'path.txt'), this.rel(this.abs(rel)));
    const all = fs.readdirSync(dir).filter((f) => /^\d+\.txt$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join(dir, f), { force: true });
  }

  /** Keep the file as it is right now among its earlier versions (before something replaces it). */
  remember(rel) {
    const buf = fs.readFileSync(this.abs(rel));
    if (buf.length) this._remember(rel, buf, true);
  }

  history(rel) {
    let names = [];
    const dir = this._histDir(rel);
    try { names = fs.readdirSync(dir).filter((f) => /^\d+\.txt$/.test(f)); } catch { return []; }
    return names.map((f) => ({ id: f.slice(0, -4), at: Number(f.slice(0, -4)), size: fs.statSync(path.join(dir, f)).size })).sort((a, b) => b.at - a.at);
  }

  version(rel, id) {
    if (!/^\d+$/.test(String(id))) throw fail('missing', "That version isn't there.");
    try {
      const buf = fs.readFileSync(path.join(this._histDir(rel), `${id}.txt`));
      return (asText(buf) || '').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    } catch {
      throw fail('missing', "That version isn't there.");
    }
  }

  // ── search ────────────────────────────────────────────────────────────
  /**
   * Find text in every text file. Options: caseSensitive, word (whole words
   * only), regex (q is a pattern), include ("*.py, src/**": only those files).
   * Results: [{ path, line, col, len, text, at }]
   */
  search(q, { limit = 400, caseSensitive = false, word = false, regex = false, include = '' } = {}) {
    const re = pattern(q, { caseSensitive, word, regex });
    if (!re) return { hits: [], files: 0, more: false };
    const only = globs(include);
    const hits = [];
    let files = 0;
    for (const rel of this.files(8000)) {
      if (kindOf(rel) || (only && !only.some((g) => g.test(rel)))) continue;
      const text = this._text(rel);
      if (text === null) continue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      files++;
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        const m = re.exec(lines[i]);
        if (!m) continue;
        const col = m.index;
        const from = Math.max(0, col - 40);
        hits.push({ path: rel, line: i + 1, col: col + 1, len: m[0].length, text: (from ? '…' : '') + lines[i].slice(from, from + 200).replace(/\r$/, ''), at: col - from + (from ? 1 : 0) });
        if (hits.length >= limit) return { hits, files, more: true };
      }
    }
    return { hits, files, more: false };
  }

  _text(rel) {
    try {
      const full = path.join(this.root, rel);
      if (fs.statSync(full).size > 1024 * 1024) return null;
      return asText(fs.readFileSync(full));
    } catch { return null; }
  }

  /** Replace in every file that matches (each file's old text is kept in its earlier versions). */
  replace(q, withText, { caseSensitive = false, word = false, regex = false, include = '', paths = null } = {}) {
    const re = pattern(q, { caseSensitive, word, regex });
    if (!re) throw fail('bad', 'Type what to find first.');
    const only = globs(include);
    const want = Array.isArray(paths) ? new Set(paths) : null;
    let count = 0;
    const changed = [];
    for (const rel of this.files(8000)) {
      if (kindOf(rel) || (only && !only.some((g) => g.test(rel))) || (want && !want.has(rel))) continue;
      const text = this._text(rel);
      if (text === null) continue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      let n = 0;
      re.lastIndex = 0;
      const crlf = /\r\n/.test(text);
      const body = crlf ? text.replace(/\r\n/g, '\n') : text;
      const out = body.replace(re, (...m) => { n++; return regex ? expand(String(withText), m) : String(withText); });
      if (!n) continue;
      this._remember(rel, fs.readFileSync(path.join(this.root, rel)), true);
      this.save(rel, out, { eol: crlf ? '\r\n' : '\n', bom: text.charCodeAt(0) === 0xfeff });
      count += n;
      changed.push(rel);
    }
    return { count, files: changed };
  }

  /** A file dropped onto den from your computer. Never replaces: a taken name gets (2). */
  upload(dir, name, base64) {
    const clean = String(name || '').replace(/[\\/]/g, '_').trim();
    if (!clean || clean === '.' || clean === '..' || /[<>:"|?*\u0000-\u001f]/.test(clean)) throw fail('bad_name', `${name} isn't a name den can use.`);
    const folder = this.abs(dir || '');
    let target = path.join(folder, clean);
    this.abs(this.rel(target));
    const e = path.extname(clean);
    for (let n = 2; fs.existsSync(target); n++) target = path.join(folder, `${path.basename(clean, e)} (${n})${e}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(target, Buffer.from(String(base64 || ''), 'base64'), { flag: 'wx' });
    return { path: this.rel(target) };
  }

  /** The git branch, if this folder is a git project. */
  branch() {
    try {
      const head = fs.readFileSync(path.join(this.root, '.git', 'HEAD'), 'utf8').trim();
      const m = head.match(/^ref: refs\/heads\/(.+)$/);
      return m ? m[1] : head.slice(0, 7);
    } catch {
      return null;
    }
  }
}

/** The search as a RegExp (global), or null when there's nothing to find. */
function pattern(q, { caseSensitive = false, word = false, regex = false } = {}) {
  const want = String(q || '');
  if (!want) return null;
  let src = regex ? want : want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (word) src = `(?<![\\w$])(?:${src})(?![\\w$])`;
  try { return new RegExp(src, caseSensitive ? 'g' : 'gi'); } catch (e) { throw fail('bad_pattern', `That pattern doesn't work: ${e.message.replace(/^Invalid regular expression: /, '')}`); }
}

/** "*.py, src/**" -> a list of RegExps for file paths. */
function globs(text) {
  const list = String(text || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!list.length) return null;
  return list.map((g) => {
    const body = g.replace(/^\.?\//, '').split('**').map((part) => part.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '[^/]')).join('[^/]*')).join('.*');
    return g.includes('/') ? new RegExp(`^${body}(/.*)?$`, 'i') : new RegExp(`(^|/)${body}$`, 'i');
  });
}

/** $1, $2… and $& in a replacement, for pattern searches. */
function expand(rep, m) {
  const groups = m.slice(0, -2).filter((x) => typeof x !== 'object');
  return rep.replace(/\$(\d+|&|\$)/g, (all, k) => (k === '$' ? '$' : k === '&' ? groups[0] : groups[+k] !== undefined ? groups[+k] : ''));
}

module.exports = { pattern, globs, Folder, home, kindOf, mimeOf, ext, asText, HEAVY, HIDDEN, TEXT_MAX };
