// den's icons: small drawn pictures (SVG), never emoji, so they look the same
// on every computer. ICONS.ui(name) for buttons, ICONS.file(name) for files.
(function (root) {
  'use strict';
  var P = {
    files: '<path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v13A1.5 1.5 0 0 0 7.5 19h9a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 3v4h4"/><path d="M3 7v12.5A1.5 1.5 0 0 0 4.5 21H14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
    git: '<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 7.2v9.6"/><path d="M18 10.2c0 4-6 3.2-11.2 6.4"/>',
    outline: '<path d="M4 6h3M4 12h3M4 18h3"/><path d="M10 6h10M12.5 12h7.5M12.5 18h7.5"/>',
    spark: '<path d="M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6z"/><path d="M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z"/>',
    play: '<path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.3-7.2a1 1 0 0 0 0-1.8L8.5 3.9A1 1 0 0 0 7 4.8z"/>',
    stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    fileplus: '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19M12 12v6M9 15h6"/>',
    folderplus: '<path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7L10 5H5a2 2 0 0 0-2 2.5z"/><path d="M12 11v6M9 14h6"/>',
    folder: '<path d="M3 7V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7L10 5H5a2 2 0 0 0-2 2z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7 9.5 3 2.5-3 2.5M12.5 15H17"/>',
    console: '<path d="M4 6h16M4 10.5h11M4 15h14M4 19.5h8"/>',
    problem: '<path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
    error: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    refresh: '<path d="M20 11.5A8 8 0 0 0 5.6 7M4 12.5A8 8 0 0 0 18.4 17"/><path d="M5 3.5V7.5h4M19 20.5v-4h-4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    downarrow: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4M12 8v4.5l3 2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    wand: '<path d="m4 20 11-11M14 4v3M19.5 9.5h-3M17.9 5.6l-2 2M10 4.5v1M4.5 10h1"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/><circle cx="17" cy="10.5" r="1.2"/>',
    branch: '<circle cx="6" cy="5.5" r="2.3"/><circle cx="6" cy="18.5" r="2.3"/><circle cx="18" cy="5.5" r="2.3"/><path d="M6 7.8v8.4M18 7.8c0 5.5-12 3.2-12 8.4"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
    sync: '<path d="M8 4.5v13M4.5 14 8 17.5l3.5-3.5"/><path d="M16 19.5v-13M12.5 10 16 6.5l3.5 3.5"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 14.5h17"/>',
    helper: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/>',
    collapse: '<path d="m7 15 5-5 5 5"/><path d="M5 19.5h14"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.1M9.5 10h.1M13 10h.1M16.5 10h.1M7 14h10"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    minus: '<path d="M5 12h14"/>',
    maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.6 5.2 3.6 8.5s-1.1 6.2-3.6 8.5c-2.5-2.3-3.6-5.2-3.6-8.5S9.5 5.8 12 3.5z"/>',
    game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17.5" cy="13.5" r=".6"/>',
    snake: '<path d="M6 19c-2 0-2.5-3 0-3h9c3 0 3-5 0-5H9c-3 0-3-5 0-5h7"/><circle cx="17.5" cy="6" r="1.6"/>',
    note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6M9 14.5h6M9 18h4"/>',
    quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 17v.1"/>',
    bin: '<path d="M4 7h16M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9.5 7V4.5h5V7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    zap: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
  };
  var FILLED = { play: 1, stop: 1, zap: 1 };

  function ui(name, cls) {
    var body = P[name] || P.info;
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="' + (FILLED[name] ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  // files: a little coloured tile with a short label, by kind
  var T = {
    py: ['#5a9be0', 'py'], pyw: ['#5a9be0', 'py'], ipynb: ['#f0973d', 'nb'],
    js: ['#e9c84a', 'js'], mjs: ['#e9c84a', 'js'], cjs: ['#e9c84a', 'js'], jsx: ['#56c7e8', 'jsx'], ts: ['#4c8de6', 'ts'], tsx: ['#4c8de6', 'tsx'],
    html: ['#ef7547', '<>'], htm: ['#ef7547', '<>'], xml: ['#ef7547', '<>'], vue: ['#4fbf8a', 'vue'],
    css: ['#6f8cff', '#'], scss: ['#e070a8', '#'], less: ['#6f8cff', '#'],
    json: ['#d9b13b', '{}'], jsonc: ['#d9b13b', '{}'], webmanifest: ['#d9b13b', '{}'],
    md: ['#8fb3d9', 'md'], markdown: ['#8fb3d9', 'md'], txt: ['#a3a3b2', 'txt'], log: ['#a3a3b2', 'log'], rst: ['#a3a3b2', 'rst'],
    sh: ['#77c97a', '$'], bash: ['#77c97a', '$'], zsh: ['#77c97a', '$'], command: ['#77c97a', '$'], ps1: ['#5b8fd9', 'ps'], bat: ['#77c97a', 'bat'],
    c: ['#6d9ad9', 'c'], h: ['#9a8ad9', 'h'], cpp: ['#6d9ad9', 'c+'], cc: ['#6d9ad9', 'c+'], hpp: ['#9a8ad9', 'h+'], cs: ['#8a6fe0', 'c#'],
    java: ['#e2834a', 'jv'], kt: ['#b48cff', 'kt'], go: ['#55c6d9', 'go'], rs: ['#de9466', 'rs'], rb: ['#e2575d', 'rb'], php: ['#9aa3d6', 'php'],
    lua: ['#6a84e0', 'lua'], swift: ['#f27a4a', 'sw'], dart: ['#4fb3e0', 'dt'], r: ['#5a8fd9', 'R'], sql: ['#e8a94a', 'sql'],
    yml: ['#e06a6a', 'yml'], yaml: ['#e06a6a', 'yml'], toml: ['#b98e6e', 'tml'], ini: ['#b98e6e', 'ini'], cfg: ['#b98e6e', 'cfg'], env: ['#e6c45a', 'env'],
    csv: ['#57c08a', 'csv'], tsv: ['#57c08a', 'tsv'], xlsx: ['#57c08a', 'xls'],
    pdf: ['#ea5f5f', 'pdf'], zip: ['#b2a08f', 'zip'], gz: ['#b2a08f', 'gz'], tar: ['#b2a08f', 'tar'],
    lock: ['#9a9aa8', 'lck'], gitignore: ['#ef7547', 'git'], gitattributes: ['#ef7547', 'git'], dockerfile: ['#4fa8e0', 'dk'], makefile: ['#c99a4a', 'mk'],
    ttf: ['#c58ad9', 'Aa'], otf: ['#c58ad9', 'Aa'], woff: ['#c58ad9', 'Aa'], woff2: ['#c58ad9', 'Aa'],
  };
  var PICS = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, bmp: 1, ico: 1, avif: 1, svg: 1, heic: 1 };
  var SOUND = { mp3: 1, wav: 1, ogg: 1, m4a: 1, aac: 1, flac: 1 };
  var FILM = { mp4: 1, webm: 1, mov: 1, m4v: 1 };

  function tile(color, inner) {
    return '<svg class="fi" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1" y="1.5" width="14" height="13" rx="4" fill="' + color + '" fill-opacity=".2" stroke="' + color + '" stroke-opacity=".55"/>' + inner + '</svg>';
  }
  function label(color, text) {
    var size = text.length >= 3 ? 5.2 : text.length === 2 ? 6.4 : 8;
    return tile(color, '<text x="8" y="' + (8 + size * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' + size + '" font-weight="800" fill="' + color + '" font-family="ui-rounded, system-ui, sans-serif">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</text>');
  }

  function file(name) {
    var base = String(name || '').split('/').pop().toLowerCase();
    var ext = base.indexOf('.') >= 0 ? base.slice(base.lastIndexOf('.') + 1) : base;
    if (base === 'readme.md' || base === 'readme') return tile('#7cc4a0', '<path d="M4.5 4.5h3c.8 0 1.5.6 1.5 1.4V12c0-.6-.6-1-1.2-1H4.5zM11.5 4.5h-1c-.8 0-1.5.6-1.5 1.4V12c0-.6.6-1 1.2-1h1.3z" fill="none" stroke="#7cc4a0" stroke-width="1.1" stroke-linejoin="round"/>');
    if (base === 'license' || base === 'licence' || base === 'license.md') return label('#c9b45a', '§');
    if (base === 'package.json') return label('#77c97a', 'npm');
    if (base === 'requirements.txt') return label('#5a9be0', 'req');
    if (PICS[ext]) return tile('#c08ae0', '<circle cx="6" cy="6.5" r="1.4" fill="#c08ae0"/><path d="M3.5 12.2 6.8 9l2 1.8 2.4-2.6 1.8 2.2v1.8z" fill="#c08ae0"/>');
    if (SOUND[ext]) return tile('#e8679f', '<path d="M7 11.2V5l4.5-1v6" fill="none" stroke="#e8679f" stroke-width="1.2" stroke-linecap="round"/><circle cx="5.8" cy="11.3" r="1.3" fill="#e8679f"/><circle cx="10.3" cy="10.1" r="1.3" fill="#e8679f"/>');
    if (FILM[ext]) return tile('#e87a67', '<path d="M6 5.5v5l4.3-2.5z" fill="#e87a67"/>');
    var t = T[ext];
    if (t) return label(t[0], t[1]);
    return tile('#9a9aa8', '<path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="#9a9aa8" stroke-width="1.1" stroke-linecap="round"/>');
  }

  /** The colour a file kind is drawn in (for tab underlines and the like). */
  function color(name) {
    var base = String(name || '').split('/').pop().toLowerCase();
    var ext = base.indexOf('.') >= 0 ? base.slice(base.lastIndexOf('.') + 1) : base;
    if (PICS[ext]) return '#c08ae0';
    return (T[ext] || ['#9a9aa8'])[0];
  }

  function folder(open) {
    return '<svg class="fi" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + (open
      ? '<path d="M1.5 4.2c0-.7.5-1.2 1.2-1.2h3.2l1.4 1.5h5.8c.7 0 1.2.5 1.2 1.2v.8H4.1c-.6 0-1 .3-1.2.9L1.5 11.6z" fill="#f2b45a" fill-opacity=".55"/><path d="M3 7.1c.2-.6.6-.9 1.2-.9h10.1c.5 0 .9.5.7 1l-1.5 5.1c-.2.5-.6.8-1.1.8H2.6c-.5 0-.9-.5-.7-1z" fill="#f2b45a"/>'
      : '<path d="M1.5 4.2c0-.7.5-1.2 1.2-1.2h3.2l1.4 1.5h5.8c.7 0 1.2.5 1.2 1.2v6.6c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2z" fill="#f2b45a" fill-opacity=".85"/><path d="M1.5 6.3h13" stroke="#000" stroke-opacity=".12"/>') + '</svg>';
  }

  root.ICONS = { ui: ui, file: file, folder: folder, color: color, names: Object.keys(P) };
})(this);
