'use strict';
// Spotting mistakes as you type: den asks the language itself whether the code
// makes sense (Python's own parser, Node's own checker), without running it.
// Each check gives back problems: [{ line, col, msg }] (lines and columns from 1).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { which } = require('./run');

const PY = `import sys, json
src = sys.stdin.read()
try:
    compile(src, sys.argv[1], 'exec')
    print('[]')
except SyntaxError as e:
    print(json.dumps([{'line': e.lineno or 1, 'col': e.offset or 1, 'msg': e.msg}]))
except Exception as e:
    print('[]')
`;

const cache = new Map();

function runWith(cmd, args, input, timeout = 6000) {
  return new Promise((resolve) => {
    let p;
    try { p = spawn(cmd, args, { windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', NODE_OPTIONS: '' } }); } catch { return resolve(null); }
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => resolve(null));
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, timeout);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    p.stdin.on('error', () => {});
    p.stdin.end(input || '');
  });
}

async function python(text, name) {
  const py = which(process.platform === 'win32' ? 'py' : 'python3') || which('python3') || which('python');
  if (!py) return null;
  const r = await runWith(py, ['-c', PY, name], text);
  if (!r || r.code !== 0) return null;
  try { return JSON.parse(r.out.trim().split('\n').pop()); } catch { return null; }
}

async function javascript(text) {
  const mod = /^\s*(import\s[\w{*'"]|export\s)/m.test(text);
  const file = path.join(os.tmpdir(), `den-check-${process.pid}-${crypto.randomBytes(4).toString('hex')}.${mod ? 'mjs' : 'cjs'}`);
  fs.writeFileSync(file, text);
  try {
    const r = await runWith(process.execPath, ['--check', file], '');
    if (!r) return null;
    if (r.code === 0) return [];
    const lines = r.err.split('\n');
    const at = lines.findIndex((l) => l.startsWith(file + ':'));
    if (at < 0) return [];
    const line = Number(lines[at].slice(file.length + 1)) || 1;
    const caret = lines[at + 2] || '';
    const col = Math.max(1, caret.indexOf('^') + 1);
    const msgLine = lines.find((l) => /^\w*Error: /.test(l)) || 'Something here doesn\'t make sense to JavaScript.';
    return [{ line, col, msg: msgLine.replace(/^\w*Error: /, '') }];
  } finally {
    fs.rm(file, { force: true }, () => {});
  }
}

function json(text) {
  if (!text.trim()) return [];
  try { JSON.parse(text); return []; } catch (e) {
    const m = String(e.message).match(/line (\d+) column (\d+)/);
    if (m) return [{ line: +m[1], col: +m[2], msg: e.message.replace(/ in JSON at position \d+.*$/, '') }];
    const p = String(e.message).match(/position (\d+)/);
    const pos = p ? +p[1] : text.length;
    const before = text.slice(0, pos).split('\n');
    return [{ line: before.length, col: before[before.length - 1].length + 1, msg: e.message.replace(/ in JSON at position \d+.*$/, '') }];
  }
}

/** CSS: unclosed braces, comments and strings (the mistakes that break everything after them). */
function css(text) {
  const out = [];
  const stack = [];
  let line = 1;
  let col = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    col++;
    if (c === '\n') { line++; col = 0; continue; }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) { out.push({ line, col, msg: 'This comment is never closed (add */).' }); break; }
      const skipped = text.slice(i, end + 2);
      const nl = skipped.split('\n').length - 1;
      if (nl) { line += nl; col = skipped.length - skipped.lastIndexOf('\n') - 1; } else col += skipped.length - 1;
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      const nl = text.indexOf('\n', i + 1);
      if (end < 0 || (nl >= 0 && nl < end)) { out.push({ line, col, msg: 'This text in quotes is never closed.' }); continue; }
      col += end - i;
      i = end;
      continue;
    }
    if (c === '{') stack.push({ line, col });
    if (c === '}') { if (!stack.length) out.push({ line, col, msg: 'There\'s a } here without a { before it.' }); else stack.pop(); }
  }
  for (const s of stack.slice(0, 3)) out.push({ line: s.line, col: s.col, msg: 'This { is never closed (add a } after it).' });
  return out.slice(0, 20);
}

/** Check some code. lang: den's language name. Returns problems, or null when den can't check this kind. */
async function check(name, text, lang) {
  text = String(text || '');
  if (text.length > 600000) return null;
  const key = crypto.createHash('sha1').update(lang + '\0' + text).digest('hex');
  if (cache.has(key)) return cache.get(key);
  let r = null;
  if (lang === 'python') r = await python(text, path.basename(name || 'code.py'));
  else if (lang === 'javascript' && !/\.(jsx|ts|tsx)$/i.test(name || '')) r = await javascript(text);
  else if (lang === 'json' && !/\.jsonc$/i.test(name || '')) r = json(text);
  else if (lang === 'css' && /\.css$/i.test(name || '')) r = css(text);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, r);
  return r;
}

module.exports = { check, json, css };
