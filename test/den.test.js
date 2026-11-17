'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const dirs = [];
const mk = (p) => { const d = tmp(p); dirs.push(d); return d; };
process.env.DEN_HOME = mk('den-home-');
process.env.DEN_NO_BROWSER = '1';
process.env.TOT_HOME = mk('den-tot-');
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const { Folder } = require('../src/files');
const { Runner, plan, which } = require('../src/run');
const { Den, withListener } = require('../src/server');
const HL = require('../web/highlight.js');
const HELP = require('../web/help.js');
const { parse } = require('../src/cli');

function project() {
  const root = mk('den-proj-');
  fs.writeFileSync(path.join(root, 'app.py'), 'print("hi")\n');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'main.js'), 'console.log("main")\n');
  fs.writeFileSync(path.join(root, 'notes.md'), '# Notes\nfind me here\n');
  fs.mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'x', 'index.js'), 'find me here too\n');
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(root, 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  return root;
}

test('the folder: nothing outside it, ever', () => {
  const root = project();
  const F = new Folder(root);
  for (const bad of ['../x', '../../etc/passwd', 'src/../../x', 'a\0b']) assert.throws(() => F.abs(bad), /outside/, bad);
  assert.equal(F.abs('/app.py'), path.join(F.root, 'app.py')); // a leading slash means "from the top of the folder"
  const outside = mk('den-outside-');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'nope');
  fs.symlinkSync(outside, path.join(root, 'sneaky'));
  assert.throws(() => F.read('sneaky/secret.txt'), /outside/);
  assert.throws(() => F.save('sneaky/new.txt', 'x'), /outside/);
  assert.equal(F.branch(), 'main');
});

test('the folder: listing, reading, saving, conflicts', () => {
  const F = new Folder(project());
  const top = F.list('');
  assert.deepEqual(top.map((x) => x.name), ['node_modules', 'src', 'app.py', 'notes.md', 'pic.png']);
  assert.equal(top[0].heavy, true);
  assert.ok(!top.some((x) => x.name === '.git'));
  assert.deepEqual(F.files(), ['app.py', 'notes.md', 'pic.png', 'src/main.js']);

  const f = F.read('app.py');
  assert.equal(f.kind, 'text');
  assert.equal(f.text, 'print("hi")\n');
  assert.equal(F.read('pic.png').kind, 'image');

  // Windows line endings and a BOM come back the way they were
  fs.writeFileSync(path.join(F.root, 'win.txt'), '﻿one\r\ntwo\r\n');
  const w = F.read('win.txt');
  assert.equal(w.text, 'one\ntwo\n');
  F.save('win.txt', w.text + 'three\n', { base: w.version, eol: w.eol, bom: w.bom });
  assert.equal(fs.readFileSync(path.join(F.root, 'win.txt'), 'utf8'), '﻿one\r\ntwo\r\nthree\r\n');

  // someone else changes the file: den won't overwrite it without asking
  const r = F.save('app.py', 'print("one")\n', { base: f.version });
  fs.writeFileSync(path.join(F.root, 'app.py'), 'print("from elsewhere")\n');
  assert.throws(() => F.save('app.py', 'print("two")\n', { base: r.version }), (e) => e.code === 'changed');
  F.save('app.py', 'print("two")\n', { base: r.version, force: true });
  assert.equal(fs.readFileSync(path.join(F.root, 'app.py'), 'utf8'), 'print("two")\n');

  // earlier versions: the one before the first save is kept
  const h = F.history('app.py');
  assert.equal(h.length, 1);
  assert.equal(F.version('app.py', h[0].id), 'print("hi")\n');
  assert.throws(() => F.version('app.py', '../../x'), /isn't there/);
});

test('the bin: deleting can be undone, even when the name is taken again', () => {
  const F = new Folder(project());
  const t = F.trash('notes.md');
  assert.ok(!fs.existsSync(path.join(F.root, 'notes.md')));
  assert.equal(F.bin()[0].path, 'notes.md');
  fs.writeFileSync(path.join(F.root, 'notes.md'), 'a new one');
  const back = F.restore(t.id);
  assert.equal(back.path, 'notes (restored).md');
  assert.match(fs.readFileSync(path.join(F.root, 'notes (restored).md'), 'utf8'), /find me here/);
  assert.equal(F.bin().length, 0);
  const d = F.trash('src');
  F.restore(d.id);
  assert.ok(fs.existsSync(path.join(F.root, 'src', 'main.js')));
  assert.throws(() => F.trash(''), /whole folder/);
});

test('making, renaming and searching', () => {
  const F = new Folder(project());
  F.create('games/snake.py');
  assert.ok(fs.existsSync(path.join(F.root, 'games', 'snake.py')));
  assert.throws(() => F.create('games/snake.py'), /already/);
  assert.throws(() => F.create('bad|name.txt'), /can't use/);
  F.rename('games/snake.py', 'games/worm.py');
  assert.ok(fs.existsSync(path.join(F.root, 'games', 'worm.py')));
  const s = F.search('FIND ME');
  assert.deepEqual(s.hits.map((h) => [h.path, h.line]), [['notes.md', 2]]); // node_modules is skipped
  assert.equal(F.search('find me', { caseSensitive: true }).hits.length, 1);
});

test('running: a program, typing to it, an error, stopping, a command', async () => {
  const root = project();
  const py = which('python3') || which('python');
  const node = which('node');
  const r = new Runner();
  const events = [];
  r.on('event', (e) => events.push(e));
  const ended = () => new Promise((resolve) => { const f = (e) => { if (e.t === 'end') { r.off('event', f); resolve(e); } }; r.on('event', f); });

  if (py) {
    fs.writeFileSync(path.join(root, 'ask.py'), 'name = input("name? ")\nprint("hi " + name)\n');
    const done = ended();
    r.start({ file: path.join(root, 'ask.py') });
    await new Promise((res) => setTimeout(res, 300));
    assert.ok(r.input('maya'));
    const e = await done;
    assert.equal(e.code, 0);
    assert.match(events.filter((x) => x.t === 'out').map((x) => x.text).join(''), /hi maya/);
  }
  fs.writeFileSync(path.join(root, 'bad.js'), 'console.log(nope)\n');
  let done = ended();
  r.start({ file: path.join(root, 'bad.js') });
  const bad = await done;
  assert.notEqual(bad.code, 0);
  const said = events.filter((x) => x.t === 'out' && x.err).map((x) => x.text).join('');
  assert.match(said, /ReferenceError: nope is not defined/);
  assert.equal(HELP.explain(said).title, "JavaScript doesn't know that name");

  fs.writeFileSync(path.join(root, 'forever.js'), 'setInterval(() => {}, 1000)\n');
  done = ended();
  r.start({ file: path.join(root, 'forever.js') });
  assert.throws(() => r.start({ command: 'echo hi', cwd: root }), /still running/);
  await new Promise((res) => setTimeout(res, 200));
  assert.ok(r.stop());
  const stopped = await done;
  assert.equal(stopped.stopped, true);

  done = ended();
  r.start({ command: process.platform === 'win32' ? 'echo hello there' : 'echo hello there', cwd: root });
  assert.equal((await done).code, 0);
  assert.match(events.filter((x) => x.t === 'out').map((x) => x.text).join(''), /hello there/);

  assert.equal(plan(path.join(root, 'notes.md')), null);
  assert.ok(node);
  assert.equal(plan(path.join(root, 'x.js')).name, 'JavaScript');
});

function req(port, p, { method = 'GET', body = null, host = null, origin = null, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (body !== null) headers['content-type'] = type;
    if (host) headers.host = host;
    if (origin) headers.origin = origin;
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    });
    r.on('error', reject);
    r.end(body === null ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
}

test('the server: only this computer, only den\'s own page, files in a sandbox', async () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>\n<html><head><title>x</title></head><body>hi</body></html>\n');
  const den = new Den(root);
  await den.start(0);
  const T = `/${den.token}`;
  try {
    const page = await req(den.port, `${T}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(page.text, /window\.DEN = \{/);
    assert.equal((await req(den.port, `${T}/static/den.js`)).status, 200);
    assert.equal((await req(den.port, `${T}/static/../server.js`)).status, 404);
    assert.equal((await req(den.port, '/wrong-token/api/state')).status, 404);
    assert.equal((await req(den.port, `${T}/api/state`, { host: 'evil.example:80' })).status, 403);

    const read = (await req(den.port, `${T}/api/read?path=app.py`)).json();
    assert.equal(read.file.text, 'print("hi")\n');
    assert.equal(read.runnable && read.runnable.name, 'Python');
    // another website can't save, even if it guessed the address
    assert.equal((await req(den.port, `${T}/api/save`, { method: 'POST', body: { path: 'app.py', text: 'x' }, origin: 'https://evil.example' })).status, 403);
    assert.equal((await req(den.port, `${T}/api/save`, { method: 'POST', body: '{"path":"app.py","text":"x"}', type: 'text/plain' })).status, 403);
    const saved = (await req(den.port, `${T}/api/save`, { method: 'POST', body: { path: 'app.py', text: 'print("saved")\n', base: read.file.version } })).json();
    assert.equal(saved.ok, true);
    assert.equal(fs.readFileSync(path.join(root, 'app.py'), 'utf8'), 'print("saved")\n');
    const outside = (await req(den.port, `${T}/api/save`, { method: 'POST', body: { path: '../escape.txt', text: 'x' } })).json();
    assert.equal(outside.ok, false);
    assert.ok(!fs.existsSync(path.join(root, '..', 'escape.txt')));

    // files on den's own address are sandboxed
    const raw = await req(den.port, `${T}/raw/index.html`);
    assert.match(raw.headers['content-security-policy'], /^sandbox/);
    assert.ok(!/den:1/.test(raw.text));
    // the preview address: the page as it is, plus den's listener, and nothing else
    const C = JSON.parse(page.text.match(/window\.DEN = (\{.*\});/)[1]);
    const pv = new URL(C.preview);
    assert.notEqual(Number(pv.port), den.port);
    const prev = await req(Number(pv.port), `${pv.pathname}index.html`);
    assert.equal(prev.status, 200);
    assert.equal(prev.headers['content-security-policy'], undefined);
    assert.match(prev.text, /<head><script>\(function\(\)\{var s=function/);
    assert.equal((await req(Number(pv.port), `${T}/api/state`)).status, 404);
    assert.equal((await req(Number(pv.port), `${pv.pathname}index.html`, { host: 'evil.example' })).status, 403);

    // the event stream carries a program's output
    const got = [];
    await new Promise((resolve) => {
      const es = http.get({ host: '127.0.0.1', port: den.port, path: `${T}/api/events` }, (res) => {
        res.setEncoding('utf8');
        let buf = '';
        res.on('data', (c) => {
          buf += c;
          for (let i; (i = buf.indexOf('\n\n')) >= 0;) { const line = buf.slice(0, i); buf = buf.slice(i + 2); if (line.startsWith('data: ')) got.push(JSON.parse(line.slice(6))); }
          if (got.some((e) => e.t === 'end')) { es.destroy(); resolve(); }
          if (got.length === 1) req(den.port, `${T}/api/run`, { method: 'POST', body: { path: 'src/main.js' } });
        });
      });
    });
    assert.equal(got[0].t, 'hello');
    assert.ok(got.some((e) => e.t === 'out' && /main/.test(e.text)));
    assert.equal(got.find((e) => e.t === 'end').code, 0);

    const s = (await req(den.port, `${T}/api/settings`, { method: 'POST', body: { theme: 'light', size: 99, nonsense: 1 } })).json();
    assert.deepEqual(s.settings, { theme: 'light' });
  } finally {
    den.close();
  }
});

test('asking Ember: no AI yet, then a streamed answer', async () => {
  const den = new Den(project());
  await den.start(0);
  const T = `/${den.token}`;
  // a pretend AI service
  let seen = null;
  const fake = http.createServer((rq, rs) => {
    let b = '';
    rq.on('data', (c) => { b += c; });
    rq.on('end', () => {
      seen = JSON.parse(b);
      rs.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const w of ['It ', 'prints ', '`hi`.']) rs.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`);
      rs.end('data: [DONE]\n\n');
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  try {
    const none = (await req(den.port, `${T}/api/ask`, { method: 'POST', body: { question: 'what?' } })).json();
    assert.equal(none.code, 'no_ai');
    assert.equal((await req(den.port, `${T}/api/ai`)).json().ready, false);

    fs.writeFileSync(path.join(process.env.TOT_HOME, 'config.json'), JSON.stringify({ garden: [{ provider: 'groq', id: 'fast', name: 'Fast Free', free: true, power: 5 }] }));
    fs.writeFileSync(path.join(process.env.TOT_HOME, 'keys.json'), JSON.stringify({ groq: 'gsk_test' }));
    process.env.TOT_URL_GROQ = `http://127.0.0.1:${fake.address().port}`;
    const ai = (await req(den.port, `${T}/api/ai`)).json();
    assert.equal(ai.ready, true);
    assert.equal(ai.model.name, 'Fast Free');
    const r = await req(den.port, `${T}/api/ask`, { method: 'POST', body: { question: 'What does this do?', context: { file: 'app.py', lang: 'Python', text: 'print("hi")', selection: 'print' } } });
    assert.equal(r.text, 'It prints `hi`.');
    assert.match(seen.messages[0].content, /You are Ember/);
    assert.match(seen.messages[1].content, /app\.py \(Python\)[\s\S]*print\("hi"\)[\s\S]*They selected[\s\S]*What does this do\?/);
  } finally {
    delete process.env.TOT_URL_GROQ;
    fake.close();
    den.close();
  }
});

test('colouring code', () => {
  const py = HL.highlight('def hi(name):\n    """doc\nstring"""\n    print(f"hi {name}")  # say it\n', 'python');
  assert.equal(py.length, 5);
  assert.match(py[0], /<span class="kw">def<\/span> <span class="fn">hi<\/span>/);
  assert.match(py[1], /<span class="str">"""doc<\/span>/);
  assert.match(py[2], /<span class="str">string"""<\/span>/);
  assert.match(py[3], /<span class="com"># say it<\/span>/);
  const html = HL.highlight('<p class="a">x &amp; y</p>\n<script>let n = 1</script>\n<style>p { color: red }</style>', 'html');
  assert.match(html[1], /<span class="kw">let<\/span>/);
  assert.match(html[2], /<span class="prop">color<\/span>/);
  assert.ok(!/<script>/.test(html.join('')), 'everything is escaped');
  assert.deepEqual(HL.highlight('a\nb\n', 'nonsense'), ['a', 'b', '']);
  assert.equal(HL.langOf('src/App.TSX'), 'typescript');
  assert.equal(HL.langOf('Makefile'), 'shell');
});

test('errors in plain words', () => {
  const nameErr = HELP.explain('Traceback (most recent call last):\n  File "/x/game.py", line 4, in <module>\n    print(scroe)\nNameError: name \'scroe\' is not defined\n');
  assert.equal(nameErr.title, "Python doesn't know that name");
  assert.deepEqual(nameErr.where, { path: '/x/game.py', line: 4 });
  const mod = HELP.explain("ModuleNotFoundError: No module named 'cv2'", 'darwin');
  assert.equal(mod.fix.command, 'python3 -m pip install opencv-python');
  assert.equal(HELP.explain("ModuleNotFoundError: No module named 'requests'", 'win32').fix.command, 'py -m pip install requests');
  assert.equal(HELP.explain("Error: Cannot find module 'express'\nRequire stack:").fix.command, 'npm install express');
  assert.equal(HELP.explain("Error: Cannot find module './util'").fix, null);
  assert.equal(HELP.explain('IndentationError: expected an indented block after \'if\' statement on line 3').title, 'The spaces at the start of a line are off');
  assert.equal(HELP.explain('everything is fine'), null);
  assert.equal(HELP.place('/home/me/app.js:12\n  foo()\n').line, 12);
  assert.ok(HELP.GLOSSARY.python.for[0].length > 10);
});

test('the preview listener keeps line numbers, and the command line', () => {
  const page = '<!doctype html>\n<html>\n<head>\n<title>t</title>\n</head>\n<body>\n<script>oops()</script>\n';
  assert.equal(withListener(page).split('\n').length, page.split('\n').length);
  assert.ok(withListener('<p>no head</p>').startsWith('<script>'));
  assert.deepEqual(parse(['my folder', '--tab', '--port', '9000']), { args: ['my folder'], tab: true, open: true, port: 9000 });
  assert.equal(parse(['--no-open']).open, false);
});
