// den's side views (files, search, changes, outline), the problems list and
// the terminals. They plug into den.js through window.DENAPP.
(function () {
  'use strict';
  var app = window.DENAPP, ICONS = window.ICONS, DIFF = window.DIFF, HL = window.HL, C = app.C;
  var $ = function (id) { return document.getElementById(id); };
  var esc = app.esc, name = app.name, dirOf = app.dirOf, get = app.get, post = app.post, toast = app.toast, mem = app.mem;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; };
  var I = ICONS.ui;

  // ── the side bar's views ────────────────────────────────────────────
  var VIEWS = {}, current = null;
  var side = $('side'), body = $('sideBody'), acts = $('sideActs');
  function showView(nm, focus, quiet) {
    var v = VIEWS[nm];
    if (!v) return;
    if (!quiet) {
      if (current === nm && app.isOpen('side') && !focus) { app.toggle('side', false); drawRail(); return; }
      if (!app.isOpen('side')) app.toggle('side', true);
    }
    if (current !== nm) {
      if (current && VIEWS[current].hide) VIEWS[current].hide();
      current = nm;
      mem.view = nm; app.remember();
      side.setAttribute('data-view', nm);
      $('sideTitle').textContent = v.title;
      body.innerHTML = '';
      acts.innerHTML = (v.acts || []).map(function (a, i) { return '<button type="button" data-a="' + i + '" title="' + esc(a.title) + '">' + I(a.icon) + '</button>'; }).join('');
      v.show(body);
    }
    drawRail();
    if (focus && v.focus) v.focus();
  }
  app.showView = showView;
  acts.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (b) VIEWS[current].acts[+b.getAttribute('data-a')].run(b); });
  function drawRail() {
    each($('rail').querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === current && app.isOpen('side'))); });
  }
  $('rail').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) showView(b.getAttribute('data-view')); });
  app.on('layout', drawRail);

  // ════════════════════════════════════════════════════════════════════
  // Files
  // ════════════════════════════════════════════════════════════════════
  var kids = {}, opened = new Set(mem.open || []), sel = null, treeEl = null;
  function loadDir(dir) {
    return get('list', { path: dir }).then(function (r) { kids[dir] = r.ok ? r.items : []; return kids[dir]; });
  }
  app.treeKids = function (dir) { return kids[dir] || null; };
  app.treeSelectedDir = function () {
    if (sel && kids[sel] !== undefined) return sel;
    if (sel) { var it = findItem(sel); if (it && it.dir) return sel; return dirOf(sel); }
    var m = app.active();
    return m ? dirOf(m.path) : '';
  };
  function findItem(p) { var list = kids[dirOf(p)] || []; for (var i = 0; i < list.length; i++) if (list[i].path === p) return list[i]; return null; }
  function gitKindOf(p) {
    var g = app.git;
    if (!g || !g.files) return null;
    for (var i = 0; i < g.files.length; i++) if (g.files[i].path === p) return g.files[i].kind;
    return null;
  }
  function gitDirty(dir) {
    var g = app.git;
    if (!g || !g.files) return false;
    for (var i = 0; i < g.files.length; i++) if (g.files[i].path.indexOf(dir + '/') === 0) return true;
    return false;
  }
  function drawTree() {
    if (!treeEl) return;
    var html = '', act = app.active();
    var walk = function (dir, depth) {
      (kids[dir] || []).forEach(function (it) {
        var isOpen = it.dir && opened.has(it.path);
        var m = app.models[it.path], probs = m ? app.problemsOf(m).filter(function (p) { return !p.warn; }).length : 0;
        var gk = it.dir ? (gitDirty(it.path) ? 'changed' : null) : gitKindOf(it.path);
        var cls = 'node' + (it.dir ? ' dir' : '') + (act && act.path === it.path ? ' on' : '') + (sel === it.path ? ' focus' : '') + (it.name[0] === '.' ? ' dot' : '') + (it.heavy ? ' heavy' : '') + (gk ? ' g-' + gk : '') + (probs ? ' bad' : '');
        var tail = probs ? '<span class="pb" title="' + probs + ' mistake' + (probs === 1 ? '' : 's') + '">' + probs + '</span>' : m && m.dirty ? '<span class="dirty" title="Not saved yet"></span>' : gk && !it.dir ? '<span class="gs" title="' + ({ changed: 'Changed since the last commit', new: 'New: not in a commit yet', deleted: 'Deleted', renamed: 'Renamed' }[gk] || '') + '">' + ({ changed: 'M', new: 'U', deleted: 'D', renamed: 'R' }[gk] || '') + '</span>' : '';
        html += '<div class="' + cls + '" role="treeitem" aria-expanded="' + (it.dir ? isOpen : '') + '" data-p="' + esc(it.path) + '" data-d="' + (it.dir ? 1 : 0) + '" style="--d:' + depth + '" draggable="true">' +
          '<span class="tw">' + (it.dir ? I('chevron') : '') + '</span>' + (it.dir ? ICONS.folder(isOpen) : ICONS.file(it.name)) + '<span class="nm">' + esc(it.name) + '</span>' + tail + '</div>';
        if (isOpen) {
          if (kids[it.path]) walk(it.path, depth + 1);
          else html += '<div class="hint" style="padding-left:' + (24 + depth * 14) + 'px">…</div>';
        }
      });
    };
    walk('', 0);
    if (!(kids[''] || []).length) html = '<div class="hint">This folder is empty. Make your first file with the <b>+</b> above, start from an example, or drop files here from your computer.</div>';
    var top = treeEl.scrollTop;
    treeEl.innerHTML = html;
    treeEl.scrollTop = top;
  }
  function refreshTree() {
    var dirs = [''].concat(Array.from(opened));
    return Promise.all(dirs.map(function (d) { return loadDir(d).catch(function () { opened.delete(d); }); })).then(drawTree);
  }
  app.refreshTree = refreshTree;
  function toggleDir(p, force) {
    var willOpen = force === undefined ? !opened.has(p) : force;
    if (willOpen) opened.add(p); else opened.delete(p);
    mem.open = Array.from(opened); app.remember();
    if (willOpen && !kids[p]) loadDir(p).then(drawTree);
    drawTree();
  }
  function reveal(p) {
    var isDir = /\/$/.test(p);
    p = p.replace(/\/$/, '');
    var parts = p.split('/'), chain = Promise.resolve();
    showView('files', true);
    for (var i = 1; i < parts.length + (isDir ? 1 : 0); i++) {
      (function (d) { opened.add(d); chain = chain.then(function () { return kids[d] ? null : loadDir(d); }); })(parts.slice(0, i).join('/'));
    }
    mem.open = Array.from(opened); app.remember();
    chain.then(function () { sel = p; drawTree(); var f = treeEl && treeEl.querySelector('.focus'); if (f) f.scrollIntoView({ block: 'center' }); });
  }
  app.on('reveal', reveal);
  app.on('tree-refresh', function () { refreshTree(); });
  app.on('created', function (p, dir) {
    var parts = p.split('/');
    for (var i = 1; i < parts.length; i++) opened.add(parts.slice(0, i).join('/'));
    if (dir) opened.add(p);
    mem.open = Array.from(opened); app.remember();
    app.forgetFiles();
    refreshTree().then(function () { sel = p; drawTree(); });
  });
  app.on('renamed', function (from, to) { sel = to; app.forgetFiles(); refreshTree(); });
  app.on('trashed', function () { app.forgetFiles(); refreshTree(); });
  app.on('fs', debounce(function () { refreshTree(); }, 100));
  ['active', 'dirty', 'problems', 'saved'].forEach(function (ev) { app.on(ev, function () { drawTree(); }); });

  function treeMenu(e, n) {
    var p = n ? n.getAttribute('data-p') : '', isDir = n ? n.getAttribute('data-d') === '1' : true;
    sel = p || null; drawTree();
    var where = isDir ? p : dirOf(p);
    app.menu(e.clientX, e.clientY, [
      { label: 'New file here', run: function () { app.newFile(false, where); } },
      { label: 'New folder here', run: function () { app.newFile(true, where); } },
      n && !isDir && { label: 'Open on the other side', run: function () { app.open(p).then(function () { app.split(p); }); } },
      n && !isDir && HL.langOf(p) !== 'text' && { label: 'Run it', run: function () { app.open(p).then(function () { app.run(); }); } },
      { sep: true },
      n && { label: 'Rename', k: 'F2', run: function () { app.rename(p); } },
      n && { label: "Move to den's bin", k: 'Delete', run: function () { app.trash(p); } },
      { sep: true },
      { label: 'Open a terminal here', run: function () { app.fire('terminal-new', where); } },
      { label: 'Search in this folder', run: function () { searchIn(where); } },
      { label: 'Copy the path', run: function () { app.copy(p || '.'); } },
      { label: 'Show in ' + app.placeName, run: function () { post('reveal', { path: p }); } },
    ]);
  }

  function setupTree(el) {
    el.addEventListener('click', function (e) {
      var n = e.target.closest('.node');
      if (!n) return;
      var p = n.getAttribute('data-p');
      sel = p;
      if (n.getAttribute('data-d') === '1') toggleDir(p);
      else { app.open(p); document.getElementById('app').classList.remove('show-side'); }
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); treeMenu(e, e.target.closest('.node')); });
    el.addEventListener('keydown', function (e) {
      var nodes = Array.prototype.slice.call(el.querySelectorAll('.node'));
      if (!nodes.length) return;
      var i = nodes.findIndex(function (n) { return n.getAttribute('data-p') === sel; });
      var cur = nodes[i];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(0, Math.min(nodes.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); sel = nodes[i].getAttribute('data-p'); drawTree(); var f = el.querySelector('.focus'); if (f) f.scrollIntoView({ block: 'nearest' }); }
      else if (cur && e.key === 'ArrowRight' && cur.getAttribute('data-d') === '1') toggleDir(sel, true);
      else if (cur && e.key === 'ArrowLeft') { if (cur.getAttribute('data-d') === '1' && opened.has(sel)) toggleDir(sel, false); else { var up = dirOf(sel); if (up) { sel = up; drawTree(); } } }
      else if (cur && e.key === 'Enter') { if (cur.getAttribute('data-d') === '1') toggleDir(sel); else app.open(sel); }
      else if (cur && e.key === 'F2') app.rename(sel);
      else if (cur && (e.key === 'Delete' || (/Mac/.test(navigator.platform) && e.metaKey && e.key === 'Backspace'))) app.trash(sel);
    });
    // drag things around inside den: onto a folder moves them there
    el.addEventListener('dragstart', function (e) { var n = e.target.closest('.node'); if (!n) return; e.dataTransfer.setData('text/den-path', n.getAttribute('data-p')); e.dataTransfer.effectAllowed = 'move'; });
    var target = function (e) { var n = e.target.closest('.node'); if (!n) return ''; return n.getAttribute('data-d') === '1' ? n.getAttribute('data-p') : dirOf(n.getAttribute('data-p')); };
    el.addEventListener('dragover', function (e) {
      var internal = e.dataTransfer.types.indexOf('text/den-path') >= 0, files = e.dataTransfer.types.indexOf('Files') >= 0;
      if (!internal && !files) return;
      e.preventDefault();
      each(el.querySelectorAll('.drop'), function (x) { x.classList.remove('drop'); });
      var t = target(e), node = t ? el.querySelector('.node[data-p="' + cssEsc(t) + '"]') : null;
      if (node) node.classList.add('drop');
      if (files) { $('drop').hidden = false; $('dropWhere').textContent = t || C.name; }
    });
    el.addEventListener('dragleave', function (e) { if (!el.contains(e.relatedTarget)) each(el.querySelectorAll('.drop'), function (x) { x.classList.remove('drop'); }); });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      each(el.querySelectorAll('.drop'), function (x) { x.classList.remove('drop'); });
      $('drop').hidden = true;
      var dir = target(e), from = e.dataTransfer.getData('text/den-path');
      if (from) {
        var to = (dir ? dir + '/' : '') + name(from);
        if (to === from || (dir + '/').indexOf(from + '/') === 0) return;
        app.rename(from, to);
        if (dir) opened.add(dir);
        return;
      }
      uploadDrop(e.dataTransfer, dir);
    });
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  // files dropped from your computer
  document.addEventListener('dragover', function (e) {
    if (e.dataTransfer.types.indexOf('Files') < 0) return;
    e.preventDefault();
    if (!e.target.closest || !e.target.closest('.tree')) { $('drop').hidden = false; $('dropWhere').textContent = app.treeSelectedDir() || C.name; }
  });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) $('drop').hidden = true; });
  document.addEventListener('drop', function (e) {
    if (e.dataTransfer.types.indexOf('Files') < 0 || (e.target.closest && e.target.closest('.tree'))) return;
    e.preventDefault();
    $('drop').hidden = true;
    uploadDrop(e.dataTransfer, app.treeSelectedDir());
  });
  function uploadDrop(dt, dir) {
    var items = dt.items ? Array.prototype.slice.call(dt.items) : [], jobs = [];
    var add = function (file, sub) { jobs.push({ file: file, dir: [dir, sub].filter(Boolean).join('/') }); };
    var walk = function (entry, sub) {
      return new Promise(function (res) {
        if (entry.isFile) entry.file(function (f) { add(f, sub); res(); }, function () { res(); });
        else if (entry.isDirectory) {
          var reader = entry.createReader(), all = [];
          var read = function () {
            reader.readEntries(function (list) {
              if (!list.length) return Promise.all(all.map(function (x) { return walk(x, (sub ? sub + '/' : '') + entry.name); })).then(res);
              all = all.concat(list); read();
            }, function () { res(); });
          };
          read();
        } else res();
      });
    };
    var entries = items.map(function (it) { return it.webkitGetAsEntry && it.webkitGetAsEntry(); }).filter(Boolean);
    var ready = entries.length ? Promise.all(entries.map(function (en) { return walk(en, ''); })) : Promise.resolve(Array.prototype.forEach.call(dt.files || [], function (f) { add(f, ''); }));
    ready.then(function () {
      jobs = jobs.filter(function (j) { if (j.file.size > 28 * 1024 * 1024) { toast('<b>' + esc(j.file.name) + '</b> is too big to add from here (over 28 MB).'); return false; } return !/^(\.DS_Store|Thumbs\.db)$/.test(j.file.name); }).slice(0, 400);
      if (!jobs.length) return;
      var done = 0, chain = Promise.resolve(), first = null;
      jobs.forEach(function (j) {
        chain = chain.then(function () {
          return new Promise(function (res) {
            var fr = new FileReader();
            fr.onload = function () {
              post('upload', { dir: j.dir, name: j.file.name, data: String(fr.result).split(',')[1] || '' }).then(function (r) { if (r.ok) { done++; first = first || r.path; } else toast(esc(r.error)); res(); }, res);
            };
            fr.onerror = function () { res(); };
            fr.readAsDataURL(j.file);
          });
        });
      });
      chain.then(function () {
        if (dir) opened.add(dir);
        app.forgetFiles();
        refreshTree();
        if (done) { toast('Added ' + done + ' file' + (done === 1 ? '' : 's') + ' to <b>' + esc(dir || C.name) + '</b>.'); if (first) reveal(first); }
      });
    });
  }

  VIEWS.files = {
    title: C.name,
    acts: [
      { icon: 'fileplus', title: 'New file (Alt+N)', run: function () { app.newFile(false); } },
      { icon: 'folderplus', title: 'New folder', run: function () { app.newFile(true); } },
      { icon: 'refresh', title: 'Look again', run: function () { refreshTree(); } },
      { icon: 'collapse', title: 'Close all folders', run: function () { opened.clear(); mem.open = []; app.remember(); drawTree(); } },
      { icon: 'bin', title: "den's bin (things you deleted)", run: function () { app.bin(); } },
    ],
    show: function (el) {
      el.innerHTML = '<div class="tree" role="tree" tabindex="0" aria-label="Files"></div>';
      treeEl = el.firstChild;
      setupTree(treeEl);
      if (kids['']) drawTree();
      refreshTree();
    },
    hide: function () { treeEl = null; },
    focus: function () { if (treeEl) treeEl.focus(); },
  };

  // ════════════════════════════════════════════════════════════════════
  // Search (and replace) in every file
  // ════════════════════════════════════════════════════════════════════
  var S = { q: '', r: '', include: '', case: false, word: false, regex: false, showReplace: false, results: null, closed: {} };
  var sEl = null;
  function searchIn(dir) { S.include = dir ? dir + '/**' : ''; showView('search', true); if (sEl) { sEl.querySelector('.inc').value = S.include; sEl.querySelector('.moreopts').hidden = false; runSearch(); } }
  VIEWS.search = {
    title: 'Search',
    acts: [
      { icon: 'refresh', title: 'Search again', run: function () { runSearch(); } },
      { icon: 'collapse', title: 'Fold all results', run: function () { (S.results ? S.results.hits : []).forEach(function (h) { S.closed[h.path] = 1; }); drawResults(); } },
    ],
    show: function (el) {
      el.innerHTML = '<div class="sform">' +
        '<div class="row"><button type="button" class="mini-btn rtoggle" title="Replace too" aria-expanded="' + S.showReplace + '">' + I(S.showReplace ? 'down' : 'chevron') + '</button>' +
        '<div class="field grow"><input class="sq" placeholder="Search every file" aria-label="Search every file" autocomplete="off" spellcheck="false"><button type="button" class="flag" data-f="case" title="Match capital letters" aria-pressed="' + S.case + '">Aa</button><button type="button" class="flag" data-f="word" title="Whole words only" aria-pressed="' + S.word + '">ab</button><button type="button" class="flag" data-f="regex" title="Use a pattern (regular expression)" aria-pressed="' + S.regex + '">.*</button></div></div>' +
        '<div class="row rrow"' + (S.showReplace ? '' : ' hidden') + '><span style="width:24px"></span><div class="field grow"><input class="sr" placeholder="Replace with" aria-label="Replace with" autocomplete="off" spellcheck="false"></div><button type="button" class="mini-btn rall" title="Replace all">' + I('check') + '</button></div>' +
        '<button type="button" class="more">' + (S.include ? 'Only in: ' + esc(S.include) : 'Only in some files…') + '</button>' +
        '<div class="row moreopts"' + (S.include ? '' : ' hidden') + '><span style="width:24px"></span><div class="field grow"><input class="inc" placeholder="files to search, like *.py, src/" aria-label="Which files to search" autocomplete="off" spellcheck="false"></div></div>' +
        '</div><div class="summary"></div><div class="sres"></div>';
      sEl = el;
      var q = el.querySelector('.sq'), r = el.querySelector('.sr'), inc = el.querySelector('.inc');
      q.value = S.q; r.value = S.r; inc.value = S.include;
      var again = debounce(runSearch, 260);
      q.addEventListener('input', function () { S.q = q.value; again(); });
      r.addEventListener('input', function () { S.r = r.value; drawResults(); });
      inc.addEventListener('input', function () { S.include = inc.value; again(); });
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
      el.querySelector('.sform').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-f')) { var f = b.getAttribute('data-f'); S[f] = !S[f]; b.setAttribute('aria-pressed', String(S[f])); runSearch(); }
        if (b.classList.contains('rtoggle')) { S.showReplace = !S.showReplace; el.querySelector('.rrow').hidden = !S.showReplace; b.innerHTML = I(S.showReplace ? 'down' : 'chevron'); drawResults(); if (S.showReplace) r.focus(); }
        if (b.classList.contains('more')) { var mo = el.querySelector('.moreopts'); mo.hidden = !mo.hidden; if (!mo.hidden) inc.focus(); }
        if (b.classList.contains('rall')) replaceAll();
      });
      el.querySelector('.sres').addEventListener('click', function (e) {
        var h = e.target.closest('.hit'), f = e.target.closest('.file'), rb = e.target.closest('[data-rf]');
        if (rb) { e.stopPropagation(); replaceAll(rb.getAttribute('data-rf')); return; }
        if (h) { app.open(h.getAttribute('data-p'), { line: +h.getAttribute('data-l'), col: +h.getAttribute('data-c'), len: +h.getAttribute('data-n') }); return; }
        if (f) { var p = f.getAttribute('data-p'); S.closed[p] = !S.closed[p]; drawResults(); }
      });
      if (S.q) runSearch(); else drawResults();
    },
    hide: function () { sEl = null; },
    focus: function () {
      if (!sEl) return;
      var q = sEl.querySelector('.sq'), ed = app.editor();
      var s = ed && ed.doc ? ed.selection() : '';
      if (s && s.indexOf('\n') < 0) { q.value = S.q = s; runSearch(); }
      q.focus(); q.select();
    },
  };
  var searchN = 0;
  function runSearch() {
    if (!sEl) return;
    if (!S.q) { S.results = null; drawResults(); return; }
    var me = ++searchN;
    sEl.querySelector('.summary').textContent = 'Searching…';
    get('search', { q: S.q, case: S.case ? 1 : 0, word: S.word ? 1 : 0, regex: S.regex ? 1 : 0, include: S.include }).then(function (r) {
      if (me !== searchN) return;
      S.results = r.ok ? r : { hits: [], files: 0, error: r.error };
      drawResults();
    });
  }
  function previewRep(text) {
    if (!S.regex) return S.r;
    try { return text.replace(new RegExp(S.q, S.case ? '' : 'i'), S.r); } catch (e) { return S.r; }
  }
  function drawResults() {
    if (!sEl) return;
    var r = S.results, sum = sEl.querySelector('.summary'), out = sEl.querySelector('.sres');
    if (!r) { sum.textContent = ''; out.innerHTML = '<div class="hint">Type what to look for. den searches every file in <b>' + esc(C.name) + '</b> (except big folders like node_modules).</div>'; return; }
    if (r.error) { sum.textContent = ''; out.innerHTML = '<div class="hint err">' + esc(r.error) + '</div>'; return; }
    var hits = r.hits || [];
    if (!hits.length) { sum.textContent = ''; out.innerHTML = '<div class="hint">Nothing found.' + (S.include ? ' (Only looking in: ' + esc(S.include) + ')' : '') + '</div>'; return; }
    sum.textContent = hits.length + (r.more ? '+' : '') + ' result' + (hits.length === 1 ? '' : 's') + ' in ' + r.files + ' file' + (r.files === 1 ? '' : 's') + (r.more ? ' (the first ' + hits.length + ')' : '');
    var byFile = [], at = {};
    hits.forEach(function (h) { if (!(h.path in at)) { at[h.path] = byFile.length; byFile.push({ path: h.path, hits: [] }); } byFile[at[h.path]].hits.push(h); });
    var rep = S.showReplace && S.r !== '' ? S.r : null;
    out.innerHTML = byFile.map(function (f) {
      var shut = S.closed[f.path];
      return '<div class="file" data-p="' + esc(f.path) + '">' + I(shut ? 'chevron' : 'down') + ICONS.file(f.path) + '<span>' + esc(name(f.path)) + '</span><span class="where">' + esc(dirOf(f.path)) + '</span><span class="n">' + f.hits.length + '</span>' + (rep !== null ? '<button type="button" class="mini-btn" data-rf="' + esc(f.path) + '" title="Replace in this file">' + I('check') + '</button>' : '') + '</div>' +
        (shut ? '' : f.hits.map(function (h) {
          var t = h.text, a = h.at, n = h.len || S.q.length, match = t.slice(a, a + n);
          return '<span class="hit" data-p="' + esc(h.path) + '" data-l="' + h.line + '" data-c="' + h.col + '" data-n="' + n + '" title="Line ' + h.line + '">' + esc(t.slice(Math.max(0, a - 30), a)) + (rep !== null ? '<s>' + esc(match) + '</s><ins>' + esc(previewRep(match)) + '</ins>' : '<b>' + esc(match) + '</b>') + esc(t.slice(a + n, a + n + 80)) + '</span>';
        }).join(''));
    }).join('');
  }
  function replaceAll(only) {
    var r = S.results;
    if (!r || !r.hits.length) return;
    var files = only ? [only] : null, n = only ? r.hits.filter(function (h) { return h.path === only; }).length : r.hits.length;
    var count = only ? 1 : r.files;
    app.confirmBox('Replace everywhere?', 'Replace <b>' + n + (r.more && !only ? '+' : '') + '</b> match' + (n === 1 ? '' : 'es') + ' of <code>' + esc(S.q) + '</code> with <code>' + esc(S.r) + '</code> in ' + count + ' file' + (count === 1 ? '' : 's') + '? Each file\'s earlier version is kept, so you can bring it back.', [
      { label: 'Replace', go: true, run: function () {
        app.saveAll().then(function () {
          return post('replace', { q: S.q, with: S.r, case: S.case, word: S.word, regex: S.regex, include: S.include, paths: files });
        }).then(function (x) {
          if (!x.ok) { toast(esc(x.error)); return; }
          toast('Replaced ' + x.count + ' in ' + x.files.length + ' file' + (x.files.length === 1 ? '' : 's') + '.');
          x.files.forEach(function (p) { var m = app.models[p]; if (m) app.reload(m); });
          runSearch();
        });
      } },
      { label: 'Cancel' },
    ]);
  }

  // ════════════════════════════════════════════════════════════════════
  // Changes (git)
  // ════════════════════════════════════════════════════════════════════
  var gEl = null, gitBusy = false;
  app.git = null;
  function refreshGit() {
    return get('git/status').then(function (r) {
      app.git = r.ok ? r : null;
      app.gitBase = !!(app.git && app.git.repo);
      var n = app.git && app.git.files ? app.git.files.length : 0;
      $('gitCount').hidden = !n; $('gitCount').textContent = n > 99 ? '99+' : n;
      drawBranch();
      drawGit();
      drawTree();
      app.eachModel(function (m) { gitBaseFor(m); });
      return app.git;
    }).catch(function () {});
  }
  app.refreshGit = refreshGit;
  var gitSoon = debounce(refreshGit, 700);
  app.on('fs', gitSoon);
  app.on('saved', gitSoon);
  function drawBranch() {
    var g = app.git, b = $('stBranch'), s = $('stSync');
    if (!g || !g.repo) { b.hidden = true; s.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = I('branch') + esc(g.branch || 'no branch');
    b.title = 'Branch: ' + (g.branch || '') + ' (click to switch)';
    s.hidden = !g.upstream;
    s.innerHTML = I('sync') + g.behind + '↓ ' + g.ahead + '↑';
    s.title = g.ahead || g.behind ? (g.ahead ? g.ahead + ' commit' + (g.ahead === 1 ? '' : 's') + ' to push. ' : '') + (g.behind ? g.behind + ' to pull.' : '') : 'Up to date with ' + g.upstream;
  }
  $('stBranch').onclick = function (e) { branchMenu(e.currentTarget); };
  $('stSync').onclick = function () { var g = app.git; if (g && g.behind) gitDo('pull'); else gitDo('push'); };

  // the coloured bars beside changed lines
  function gitBaseFor(m) {
    if (!app.git || !app.git.repo || m.kind !== 'text') { setMarks(m, null); return; }
    get('git/base', { path: m.path }).then(function (r) {
      if (!r.ok) return;
      m.gitBase = r.text;
      m.gitNew = r.text === null && !!gitKindOf(m.path);
      marksFor(m);
    });
  }
  function marksFor(m) {
    if (m.gitBase === undefined) return;
    if (m.gitBase === null) { setMarks(m, m.gitNew ? DIFF.marks('', app.textOf(m)) : null); return; }
    setMarks(m, DIFF.marks(m.gitBase, app.textOf(m)));
  }
  function setMarks(m, marks) { app.forDocs(m, function (d, g) { if (g) g.editor.setChanges(d, marks); }); }
  app.on('opened', function (m) { if (app.git && app.git.repo) gitBaseFor(m); });
  var marksSoon = {};
  app.on('edit', function (m) { clearTimeout(marksSoon[m.path]); marksSoon[m.path] = setTimeout(function () { marksFor(m); }, 300); });
  app.on('active', function (m) { if (m) marksFor(m); });

  function gitDo(what, extra) {
    if (gitBusy) return Promise.resolve();
    gitBusy = true;
    drawGit();
    var label = { push: 'Sending your commits…', pull: 'Getting new commits…', commit: 'Committing…' }[what];
    if (label) app.status(label);
    return post('git/' + what, extra || {}).then(function (r) {
      gitBusy = false;
      app.status('');
      if (!r.ok) { gitError(r, what, extra); return refreshGit().then(function () { return r; }); }
      if (what === 'push') toast('Sent. Your commits are online now.');
      if (what === 'pull') { toast('Up to date.' + (r.said ? ' ' + esc(r.said.split('\n').pop()) : '')); app.eachModel(function (m) { app.reload(m); }); }
      if (what === 'commit') { logCache = null; toast('Committed <code>' + esc(r.hash) + '</code>' + (r.all ? ' (everything you changed)' : '') + '.'); app.ember.feel('happy', 2000); }
      return refreshGit().then(function () { return r; });
    }, function () { gitBusy = false; drawGit(); });
  }
  function gitError(r, what, extra) {
    if (r.code === 'identity') {
      var d = app.modal('<div class="in"><p style="margin:0">Each commit is signed with a name and email (they\'re saved in git\'s settings on this computer). Use the email you use for GitHub, if you have one.</p><input class="text" id="gName" placeholder="Your name" autocomplete="name"><input class="text" id="gMail" placeholder="Your email" autocomplete="email"><div class="row"><button class="btn go" type="button" id="gSave">Save and commit</button></div></div>', { title: 'Who is committing?' });
      d.querySelector('#gName').focus();
      d.querySelector('#gSave').onclick = function () {
        post('git/identity', { name: d.querySelector('#gName').value, email: d.querySelector('#gMail').value }).then(function (x) {
          if (!x.ok) { toast(esc(x.error)); return; }
          app.closeModal();
          gitDo(what, extra);
        });
      };
      return;
    }
    if (r.code === 'no_remote' && what === 'push') { connectBox(); return; }
    if (r.code === 'login') {
      toast(esc(r.error), { label: 'Open the terminal', run: function () { app.fire('terminal-new', '', 'git ' + what + '\r'); } }, 12000);
      return;
    }
    if (r.code === 'upstream' && what === 'pull') { toast(esc(r.error)); return; }
    toast(esc(r.error), null, 9000);
  }
  function connectBox() {
    var d = app.modal('<div class="in"><ol class="tips" style="color:var(--fg)"><li>On <b>github.com</b>, press <b>New</b> (top left) to make an empty repository. Don\'t add a README.</li><li>Copy the address it shows (it ends in <code>.git</code>).</li><li>Paste it here:</li></ol><input class="text" id="gUrl" placeholder="https://github.com/you/project.git" spellcheck="false"><div class="row"><button class="btn go" type="button" id="gConnect">Connect and push</button></div></div>', { title: 'Put this project on GitHub' });
    d.querySelector('#gUrl').focus();
    d.querySelector('#gConnect').onclick = function () {
      post('git/connect', { url: d.querySelector('#gUrl').value }).then(function (x) {
        if (!x.ok) { toast(esc(x.error)); return; }
        app.closeModal();
        gitDo('push');
      });
    };
  }
  function branchMenu(el) {
    get('git/branches').then(function (r) {
      if (!r.ok) { toast(esc(r.error)); return; }
      app.menuAt(el, r.list.map(function (b) { return { label: (b === r.current ? '● ' : '   ') + b, run: function () { if (b !== r.current) gitDo('checkout', { branch: b }).then(function () { app.eachModel(function (m) { app.reload(m); }); }); } }; })
        .concat([{ sep: true }, { label: 'New branch…', run: function () { app.ask('New branch', 'branch name, like try-new-colours', '', function (v) { gitDo('checkout', { branch: v.replace(/\s+/g, '-'), create: true }); }); } }]));
    });
  }
  function diffOf(p) {
    var m = app.models[p];
    var show = function (oldText, newText, lang) {
      var v = app.diffTab('What changed in ' + name(p) + ' since the last commit', oldText, newText, lang, '<button class="btn" type="button" data-openf="1">' + I('pencil') + 'Edit the file</button>');
      var b = v.querySelector('[data-openf]');
      if (b) b.onclick = function () { app.open(p); };
    };
    get('git/base', { path: p }).then(function (r) {
      var base = r.ok ? r.text || '' : '';
      if (m && m.kind === 'text') { show(base, app.textOf(m), m.lang); return; }
      get('read', { path: p }).then(function (f) {
        var text = f.ok && f.file.kind === 'text' ? f.file.text : '';
        if (app.G().tabs.length === 0 || !app.G().active) app.open(p, null, { quiet: true }).then(function () { show(base, text, HL.langOf(p)); });
        else show(base, text, HL.langOf(p));
      });
    });
  }
  app.on('diff', diffOf);

  VIEWS.git = {
    title: 'Changes',
    acts: [
      { icon: 'refresh', title: 'Look again', run: function () { refreshGit(); } },
      { icon: 'more', title: 'More', run: function (b) {
        app.menuAt(b, [
          { label: 'Get new commits (pull)', run: function () { gitDo('pull'); } },
          { label: 'Send my commits (push)', run: function () { gitDo('push'); } },
          { label: 'Switch branch…', run: function () { branchMenu(b); } },
          { label: 'Put this project on GitHub…', run: function () { connectBox(); } },
          { sep: true },
          { label: 'Open a terminal (for anything else git can do)', run: function () { app.fire('terminal-new'); } },
        ]);
      } },
    ],
    show: function (el) { gEl = el; drawGit(); refreshGit(); },
    hide: function () { gEl = null; },
    focus: function () { var t = gEl && gEl.querySelector('textarea'); if (t) t.focus(); },
  };
  var logCache = null;
  function drawGit() {
    if (!gEl) return;
    var g = app.git;
    if (!g) { gEl.innerHTML = '<div class="hint">Looking…</div>'; return; }
    if (!g.git) { gEl.innerHTML = '<div class="git-box"><div class="card"><h4>git isn\'t installed</h4><p>git keeps save points of your project (called commits) and puts it on GitHub.</p><p>' + (C.platform === 'darwin' ? 'On a Mac, open a terminal and type <code>xcode-select --install</code>, then come back.' : 'Get it from <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer">git-scm.com</a>, then come back.') + '</p></div></div>'; return; }
    if (!g.repo) {
      gEl.innerHTML = '<div class="git-box"><div class="card"><h4>Keep save points of your work</h4><p>git remembers your project at moments you choose (called <b>commits</b>), so you can see what changed, go back, and put it on GitHub.</p><div class="row"><button class="btn moss" type="button" data-g="init">' + I('commit') + 'Start tracking ' + esc(C.name) + '</button></div></div></div>';
      gEl.querySelector('[data-g="init"]').onclick = function () { post('git/init').then(function (r) { if (!r.ok) toast(esc(r.error)); else toast('den is tracking changes now. Make your first commit when you\'re ready.'); refreshGit(); }); };
      return;
    }
    var staged = g.files.filter(function (f) { return f.staged; }), changed = g.files.filter(function (f) { return f.changed || f.untracked; });
    var msgBox = gEl.querySelector('textarea'), keep = msgBox ? msgBox.value : '';
    var row = function (f, isStaged) {
      var st = { new: 'U', changed: 'M', deleted: 'D', renamed: 'R' }[f.kind] || 'M';
      if (isStaged && f.x === 'A') st = 'A';
      return '<div class="gfile" data-p="' + esc(f.path) + '" title="' + esc(f.path) + '">' + ICONS.file(f.path) + '<span class="nm">' + esc(name(f.path)) + '<span class="dir">' + esc(dirOf(f.path)) + '</span></span><span class="ga">' +
        (f.kind !== 'deleted' ? '<button type="button" class="mini-btn" data-ga="open" title="Open the file">' + I('pencil') + '</button>' : '') +
        (!isStaged ? '<button type="button" class="mini-btn" data-ga="discard" title="Undo these changes">' + I('undo') + '</button><button type="button" class="mini-btn" data-ga="stage" title="Add to the next commit (stage)">' + I('plus') + '</button>' : '<button type="button" class="mini-btn" data-ga="unstage" title="Take out of the next commit">' + I('minus') + '</button>') +
        '</span><span class="st ' + f.kind + '">' + st + '</span></div>';
    };
    gEl.innerHTML = '<div class="git-box">' +
      '<div class="git-branch">' + I('branch') + '<b>' + esc(g.branch || 'no branch') + '</b>' +
      (g.upstream ? '<button type="button" class="mini-btn" data-g="pull" title="Get new commits (pull)">' + I('downarrow') + '</button><span class="dim">' + g.behind + '</span><button type="button" class="mini-btn" data-g="push" title="Send your commits (push)">' + I('up') + '</button><span class="dim">' + g.ahead + '</span>' : g.remotes && g.remotes.length ? '<button type="button" class="btn" data-g="push">' + I('up') + 'Publish</button>' : '<button type="button" class="btn" data-g="connect">' + I('globe') + 'Put on GitHub</button>') + '</div>' +
      '<div class="commit"><textarea placeholder="What did you change? (like: add a score counter)" aria-label="Commit message"></textarea><div class="row"><button type="button" class="btn" data-g="msg" title="Ember writes a message from what changed">' + I('spark') + 'Write it for me</button><button type="button" class="btn moss wide" data-g="commit" title="' + (staged.length ? 'Commit the staged files' : 'Commit everything you changed') + ' (' + app.MOD + 'Enter)"' + (g.files.length && !gitBusy ? '' : ' disabled') + '>' + I('check') + 'Commit</button></div></div>' +
      (staged.length ? '<div class="gsec"><h3>Staged (in the next commit) <span class="n">' + staged.length + '</span><button type="button" class="mini-btn" data-g="unstageall" title="Take them all out">' + I('minus') + '</button></h3>' + staged.map(function (f) { return row(f, true); }).join('') + '</div>' : '') +
      '<div class="gsec"><h3>Changes <span class="n">' + changed.length + '</span>' + (changed.length ? '<button type="button" class="mini-btn" data-g="discardall" title="Undo all these changes">' + I('undo') + '</button><button type="button" class="mini-btn" data-g="stageall" title="Add them all to the next commit">' + I('plus') + '</button>' : '') + '</h3>' +
      (changed.length ? changed.map(function (f) { return row(f, false); }).join('') : '<div class="hint">' + (g.fresh ? 'No files yet. Make some, then commit them.' : 'Nothing changed since the last commit.') + '</div>') + '</div>' +
      '<div class="gsec log"><h3>Recent commits</h3><div class="loglist"></div></div></div>';
    var ta = gEl.querySelector('textarea');
    ta.value = keep;
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); gEl.querySelector('[data-g="commit"]').click(); } });
    gEl.querySelector('.git-box').addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'), a = e.target.closest('[data-ga]'), f = e.target.closest('.gfile');
      if (b) {
        var k = b.getAttribute('data-g');
        if (k === 'pull' || k === 'push') gitDo(k);
        if (k === 'connect') connectBox();
        if (k === 'commit') { var msg = ta.value.trim(); if (!msg) { ta.focus(); toast('Write a few words about what you changed (or press <b>Write it for me</b>).'); return; } app.saveAll().then(function () { return gitDo('commit', { message: msg }); }).then(function (r) { if (r && r.ok) ta.value = ''; logCache = null; drawLog(); }); }
        if (k === 'msg') { b.disabled = true; post('git/message').then(function (r) { b.disabled = false; if (r.ok) { ta.value = r.message; ta.focus(); } else toast(esc(r.error)); }); }
        if (k === 'stageall') post('git/stage', { paths: changed.map(function (x) { return x.path; }) }).then(refreshGit);
        if (k === 'unstageall') post('git/unstage', { paths: staged.map(function (x) { return x.path; }) }).then(refreshGit);
        if (k === 'discardall') discard(changed.map(function (x) { return x.path; }));
        return;
      }
      if (a && f) {
        var p = f.getAttribute('data-p'), ga = a.getAttribute('data-ga');
        if (ga === 'open') app.open(p);
        if (ga === 'stage') post('git/stage', { paths: [p] }).then(refreshGit);
        if (ga === 'unstage') post('git/unstage', { paths: [p] }).then(refreshGit);
        if (ga === 'discard') discard([p]);
        return;
      }
      if (f) diffOf(f.getAttribute('data-p'));
    });
    drawLog();
  }
  function drawLog() {
    if (!gEl) return;
    var box = gEl.querySelector('.loglist');
    if (!box) return;
    var paint = function (items) { box.innerHTML = items.length ? items.slice(0, 12).map(function (c) { return '<div class="it" title="' + esc(c.who) + ', ' + new Date(c.at).toLocaleString() + '"><code>' + esc(c.hash) + '</code><span>' + esc(c.subject) + '</span></div>'; }).join('') : '<div class="hint">No commits yet.</div>'; };
    if (logCache) { paint(logCache); return; }
    get('git/log', { n: 12 }).then(function (r) { logCache = r.items || []; paint(logCache); });
  }
  app.on('fs', function () { logCache = null; });
  function discard(paths) {
    app.confirmBox('Undo these changes?', (paths.length === 1 ? '<b>' + esc(name(paths[0])) + '</b> goes back' : paths.length + ' files go back') + ' to how they were at the last commit. New files go to den\'s bin, and den keeps a copy of the rest in their earlier versions, so nothing is lost.', [
      { label: 'Undo the changes', go: true, run: function () { post('git/discard', { paths: paths }).then(function (r) { if (!r.ok) toast(esc(r.error)); refreshGit(); paths.forEach(function (p) { var m = app.models[p]; if (m) app.reload(m, true); }); }); } },
      { label: 'Cancel' },
    ]);
  }

  // ════════════════════════════════════════════════════════════════════
  // Outline
  // ════════════════════════════════════════════════════════════════════
  var oEl = null, oList = [];
  var KIND = { fn: 'ƒ', cl: 'C', h: '#', v: '•', css: '{' };
  VIEWS.outline = {
    title: 'Outline',
    acts: [],
    show: function (el) { oEl = el; drawOutline(); },
    hide: function () { oEl = null; },
  };
  function drawOutline() {
    if (!oEl) return;
    var m = app.active(), ed = app.editor();
    if (!m || m.kind !== 'text') { oEl.innerHTML = '<div class="hint">Open a file to see its functions, classes and headings here.</div>'; return; }
    oList = app.symbols(app.textOf(m), m.lang);
    if (!oList.length) { oEl.innerHTML = '<div class="hint">den didn\'t find any functions, classes or headings in <b>' + esc(name(m.path)) + '</b>.</div>'; return; }
    var line = ed && ed.doc ? ed.pos().line : 0, chain = app.symbolChain(oList, line), here = chain[chain.length - 1];
    oEl.innerHTML = oList.map(function (s, i) { return '<div class="sym' + (s === here ? ' on' : '') + '" data-i="' + i + '" style="--d:' + s.depth + '"><span class="k ' + s.kind + '">' + KIND[s.kind] + '</span><span class="nm">' + esc(s.name) + '</span><span class="ln">' + s.line + '</span></div>'; }).join('');
    oEl.onclick = function (e) { var r = e.target.closest('.sym'); if (r) { var s = oList[+r.getAttribute('data-i')]; app.editor().go(s.line, 1); } };
  }
  app.on('active', drawOutline);
  app.on('edit', debounce(drawOutline, 400));
  app.on('cursor', debounce(drawOutline, 150));

  // ════════════════════════════════════════════════════════════════════
  // Problems
  // ════════════════════════════════════════════════════════════════════
  function drawProblemList() {
    var box = $('plist'), html = '';
    app.eachModel(function (m) {
      var list = app.problemsOf(m);
      if (!list.length) return;
      html += '<div class="pfile">' + ICONS.file(m.path) + esc(name(m.path)) + '<span class="n">' + esc(dirOf(m.path)) + '</span></div>' +
        list.slice().sort(function (a, b) { return a.line - b.line; }).map(function (p) { return '<div class="prob' + (p.warn ? ' w' : '') + '" data-p="' + esc(m.path) + '" data-l="' + p.line + '" data-c="' + (p.col || 1) + '">' + I(p.warn ? 'problem' : 'error') + '<span>' + esc(p.msg) + '</span><span class="at">line ' + p.line + '</span></div>'; }).join('');
    });
    box.innerHTML = html || '<div class="hint">No mistakes spotted in the files you have open. den checks Python, JavaScript, JSON and CSS as you type.</div>';
  }
  $('plist').addEventListener('click', function (e) { var p = e.target.closest('.prob'); if (p) app.open(p.getAttribute('data-p'), { line: +p.getAttribute('data-l'), col: +p.getAttribute('data-c') }); });
  app.on('problems-all', drawProblemList);

  // ════════════════════════════════════════════════════════════════════
  // Terminals
  // ════════════════════════════════════════════════════════════════════
  var terms = [], curTerm = null, tbox = $('tbox');
  function termById(id) { for (var i = 0; i < terms.length; i++) if (terms[i].id === id) return terms[i]; return null; }
  function drawTermTabs() {
    $('tterms').innerHTML = terms.length > 1 ? terms.map(function (t, i) { return '<button type="button" class="' + (t === curTerm ? 'on' : '') + '" data-t="' + i + '">' + I('terminal') + esc(t.label + ' ' + (i + 1)) + '<span class="x" data-tx="' + i + '" title="Close">' + I('close') + '</span></button>'; }).join('') : '';
    if (!terms.length) tbox.innerHTML = '<div class="tempty"><p>No terminal open.</p><p><button class="btn go" type="button" data-tn="1">' + I('terminal') + 'Open a terminal</button></p></div>';
  }
  $('tterms').addEventListener('click', function (e) {
    var x = e.target.closest('[data-tx]'), b = e.target.closest('[data-t]');
    if (x) { e.stopPropagation(); closeTerm(terms[+x.getAttribute('data-tx')]); return; }
    if (b) showTerm(terms[+b.getAttribute('data-t')]);
  });
  tbox.addEventListener('click', function (e) { if (e.target.closest('[data-tn]')) newTerm(); });
  function showTerm(t) {
    curTerm = t;
    terms.forEach(function (x) { x.el.hidden = x !== t; });
    drawTermTabs();
    if (t) setTimeout(function () { t.term.fit(); t.term.focus(); }, 0);
  }
  /** A terminal that was already open (the page was reloaded): pick it back up. */
  function adoptTerm(info) {
    var el = document.createElement('div');
    el.hidden = true;
    tbox.appendChild(el);
    var t = { id: info.id, el: el, label: info.label || 'terminal', queue: '', sending: false, ended: false };
    t.term = new window.Term(el, {
      send: function (s) { if (t.ended) { if (/\r/.test(s)) { closeTerm(t); newTerm(); } return; } t.queue += s; pump(t); },
      resize: function (cols, rows) { post('term/resize', { id: t.id, cols: cols, rows: rows }); },
    });
    terms.push(t);
    if (info.replay) t.term.write(info.replay);
    if (!curTerm) curTerm = t;
  }
  get('term/list').then(function (r) {
    if (!r.ok || !r.items.length) return;
    var empty = tbox.querySelector('.tempty'); if (empty) empty.remove();
    r.items.forEach(adoptTerm);
    showTerm(curTerm);
  });

  function newTerm(dir, type) {
    if (terms.length >= 6) { toast('That\'s six terminals already. Close one first.'); return; }
    var empty = tbox.querySelector('.tempty'); if (empty) empty.remove();
    var el = document.createElement('div');
    tbox.appendChild(el);
    var t = { id: null, el: el, label: 'terminal', queue: '', sending: false, ended: false };
    terms.push(t); // (before the panel opens, so opening it doesn't start another one)
    app.showPanel('terminal');
    t.term = new window.Term(el, {
      send: function (s) { if (t.ended) { if (/\r/.test(s)) { closeTerm(t); newTerm(dir); } return; } t.queue += s; pump(t); },
      resize: function (cols, rows) { if (t.id) post('term/resize', { id: t.id, cols: cols, rows: rows }); },
      title: function () {},
    });
    showTerm(t);
    t.term.fit();
    post('term/open', { cols: t.term.cols, rows: t.term.rows, path: dir || '' }).then(function (r) {
      if (!r.ok) { t.term.write('\r\n' + r.error + '\r\n'); t.ended = true; return; }
      t.id = r.id;
      t.label = r.label || 'terminal';
      if (!r.pty) t.term.write('\x1b[2m(A simple terminal: programs that take over the whole window won\'t work here.)\x1b[0m\r\n');
      drawTermTabs();
      if (type) { t.queue += type; }
      pump(t);
      post('term/resize', { id: t.id, cols: t.term.cols, rows: t.term.rows });
    });
  }
  function pump(t) {
    if (!t.id || t.sending || !t.queue) return;
    var data = t.queue;
    t.queue = '';
    t.sending = true;
    post('term/input', { id: t.id, data: data }).then(function () { t.sending = false; pump(t); }, function () { t.sending = false; });
  }
  function closeTerm(t) {
    if (!t) return;
    if (t.id && !t.ended) post('term/close', { id: t.id });
    t.el.remove();
    terms = terms.filter(function (x) { return x !== t; });
    if (curTerm === t) curTerm = null;
    if (terms.length) showTerm(terms[terms.length - 1]); else drawTermTabs();
  }
  app.on('term', function (ev) { var t = termById(ev.id); if (t) t.term.write(ev.d); });
  app.on('term-end', function (ev) {
    var t = termById(ev.id);
    if (!t) return;
    t.ended = true;
    t.term.write('\r\n\x1b[2m[This terminal has finished. Press Enter for a new one.]\x1b[0m\r\n');
  });
  app.on('terminal-new', function (dir, type) { newTerm(dir, type); });
  app.on('terminal-clear', function () { if (curTerm) curTerm.term.clear(); });
  app.on('panel', function (which, focus) {
    if (which !== 'terminal') return;
    if (!terms.length) newTerm();
    else if (curTerm) setTimeout(function () { curTerm.term.fit(); if (focus) curTerm.term.focus(); }, 0);
  });
  app.on('layout', function () { if (curTerm && !curTerm.el.hidden) curTerm.term.fit(); });

  // ── off we go ───────────────────────────────────────────────────────
  showView(mem.view && VIEWS[mem.view] ? mem.view : 'files', false, true);
  refreshTree().then(function () { app.ready(); });
  refreshGit();
  drawProblemList();
})();
