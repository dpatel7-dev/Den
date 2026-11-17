'use strict';
// The `den` command: open a folder in den, in your browser.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const A = require('./ansi');
const Ember = require('./ember');
const { home } = require('./files');
const pkg = require('../package.json');

const out = (s = '') => process.stdout.write(s + '\n');
const fox = (s) => A.paint(s, { fg: Ember.INK.O, bold: true });
const dim = (s) => A.paint(s, { fg: '#9a8b7c' });
const ok = (s) => A.paint(s, { fg: '#9ccf7a' });

const HELP = `
  ${'den'}: a cozy place to write code. It opens in your browser.

  den                  open the folder you're in
  den <folder>         open that folder (den offers to make it if it isn't there)
  den <file>           open the folder a file is in, showing that file
  den update           get the newest version
  den version          which version this is
  den uninstall        remove den (add "all" to remove its bin and saved versions too)
  den help             this

  Options:  --tab       a browser tab instead of den's own window
            --no-open   don't open anything, just print the address
            --port <n>  use this port

  Keep the terminal window open while you code. Ctrl+C closes den.
`;

function parse(argv) {
  const o = { args: [], tab: false, open: true, port: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tab') o.tab = true;
    else if (a === '--no-open') o.open = false;
    else if (a === '--port') o.port = parseInt(argv[++i], 10) || 0;
    else if (a.startsWith('--port=')) o.port = parseInt(a.slice(7), 10) || 0;
    else o.args.push(a);
  }
  return o;
}

async function main(argv) {
  const o = parse(argv);
  const cmd = o.args[0];
  switch (cmd) {
    case 'help': case '--help': case '-h': return out(HELP);
    case 'version': case '--version': case '-v': return out(`den ${pkg.version}`);
    case 'update': case 'upgrade': return update();
    case 'uninstall': return uninstall(o.args[1] === 'all');
    default: return open(o.args.join(' ').trim() || '.', o);
  }
}

function ask(question) {
  if (!process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

async function open(target, o) {
  let where = target.replace(/^~(?=$|[/\\])/, os.homedir());
  where = path.resolve(where);
  let showFile = null;
  if (!fs.existsSync(where)) {
    const a = await ask(`  There's no folder called ${target}. Make it? (y/n) `);
    if (!/^y/i.test(a)) throw new Error(`Nothing opened. To open a folder that's already there: den <folder>`);
    fs.mkdirSync(where, { recursive: true });
  } else if (fs.statSync(where).isFile()) {
    showFile = path.basename(where);
    where = path.dirname(where);
  }
  if (path.resolve(where) === path.parse(where).root || path.resolve(where) === os.homedir()) {
    out(dim(`  Heads up: that's a big folder (${where === os.homedir() ? 'your whole home folder' : 'the whole disk'}). den works best with one project folder.`));
  }
  const { Den } = require('./server');
  const den = new Den(where);
  await den.start(o.port);
  const url = den.url() + (showFile ? `#open=${encodeURIComponent(showFile)}` : '');

  // Ember, with the details beside her
  const shown = where.startsWith(os.homedir()) ? '~' + where.slice(os.homedir().length) : where;
  const art = Ember.draw('idle');
  const text = [
    '', `${fox('den')} ${dim('v' + pkg.version)}`, '', `Open: ${A.paint(shown, { bold: true })}`,
    dim(url), '', dim('Keep this window open while you code.'), dim('Ctrl+C closes den.'), '',
  ];
  out('');
  for (let i = 0; i < Math.max(art.length, text.length); i++) out('  ' + (art[i] || ' '.repeat(26)) + '   ' + (text[i] || ''));

  let opened = false;
  if (o.open) {
    const { openWindow, openBrowser } = require('./open');
    opened = o.tab ? openBrowser(url) : openWindow(url);
  }
  out(opened ? `  ${ok('✓')} den is opening in your browser.` : `  Open this in your browser: ${A.paint(url, { bold: true })}`);
  out('');

  const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  den.on('log', (msg) => out(`  ${dim(clock())}  ${msg}`));
  let closedTimer = null;
  den.on('pages', (n) => {
    clearTimeout(closedTimer);
    if (n === 0) {
      closedTimer = setTimeout(() => out(`  ${dim(clock())}  ${dim('The den page is closed. Open it again with the address above, or press Ctrl+C to quit.')}`), 4000);
      closedTimer.unref();
    }
  });
  const quit = () => {
    den.close();
    out(`\n  ${fox('den')} closed. See you soon.\n`);
    process.exit(0);
  };
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
  process.on('SIGHUP', quit);
}

function installUrl(kind) {
  let site = '';
  try { site = fs.readFileSync(path.join(home(), 'hub'), 'utf8').trim(); } catch { /* installed from GitHub */ }
  if (/^https?:\/\//.test(site)) return `${site.replace(/\/+$/, '')}/den/install.${kind}`;
  return `https://raw.githubusercontent.com/dpatel7-dev/Den/main/install.${kind}`;
}

function update() {
  const { spawnSync } = require('child_process');
  const win = process.platform === 'win32';
  const url = installUrl(win ? 'ps1' : 'sh');
  out(`  Updating from ${url}`);
  const r = win
    ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `irm ${url} | iex`], { stdio: 'inherit' })
    : spawnSync('sh', ['-c', `curl -fsSL "${url}" | sh`], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('The update did not finish. Your current version still works.');
}

function uninstall(all) {
  const root = home();
  let launcher = '';
  try { launcher = fs.readFileSync(path.join(root, 'launcher'), 'utf8').trim(); } catch { /* not installed by the installer */ }
  for (const p of [path.join(root, 'app'), path.join(root, 'node')]) fs.rmSync(p, { recursive: true, force: true });
  if (launcher && /den(\.cmd)?$/.test(launcher)) fs.rmSync(launcher, { force: true });
  if (all) fs.rmSync(root, { recursive: true, force: true });
  out(`  den is uninstalled.${all ? '' : ` Its bin and saved versions are still in ${root}.`}`);
}

module.exports = { main, HELP, parse };
