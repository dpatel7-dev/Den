// Colouring code. One small scanner per kind of language, no libraries.
// highlight(text, lang) -> one string of HTML per line.
(function (root) {
  'use strict';

  var EXT = {
    py: 'python', pyw: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', jsonc: 'json', webmanifest: 'json', html: 'html', htm: 'html', xml: 'html', svg: 'html', vue: 'html', xhtml: 'html',
    css: 'css', scss: 'css', less: 'css', md: 'markdown', markdown: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell', command: 'shell',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', java: 'java', cs: 'csharp', go: 'go', rs: 'rust', swift: 'swift',
    kt: 'kotlin', kts: 'kotlin', php: 'php', rb: 'ruby', lua: 'lua', sql: 'sql', yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'toml',
    cfg: 'toml', conf: 'toml', env: 'shell', ps1: 'powershell', r: 'r', dart: 'dart', txt: 'text', csv: 'text', log: 'text',
  };
  var NAMES = {
    python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', json: 'JSON', html: 'HTML', css: 'CSS', markdown: 'Markdown',
    shell: 'Shell', c: 'C', cpp: 'C++', java: 'Java', csharp: 'C#', go: 'Go', rust: 'Rust', swift: 'Swift', kotlin: 'Kotlin', php: 'PHP',
    ruby: 'Ruby', lua: 'Lua', sql: 'SQL', yaml: 'YAML', toml: 'Settings file', powershell: 'PowerShell', r: 'R', dart: 'Dart', text: 'Plain text',
  };

  function langOf(name) {
    var base = String(name || '').split('/').pop();
    var lower = base.toLowerCase();
    if (/^(makefile|dockerfile|\.gitignore|\.dockerignore|\.bashrc|\.zshrc|\.profile|procfile)$/.test(lower)) return 'shell';
    var i = lower.lastIndexOf('.');
    if (i < 0) return 'text';
    return EXT[lower.slice(i + 1)] || 'text';
  }

  var words = function (s) { var o = Object.create(null); s.split(/\s+/).forEach(function (w) { if (w) o[w] = 1; }); return o; };

  var C_KW = 'if else for while do switch case default break continue return goto sizeof struct union enum typedef static const extern volatile register inline void char short int long float double signed unsigned bool true false NULL nullptr auto';
  var L = {
    python: {
      line: ['#'], strings: ['"""', "'''", '"', "'"], strPrefix: /[rRbBfFuU]{1,2}(?=["'])/y, deco: true, defs: true,
      kw: words('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self'),
      builtin: words('print input len range int str float bool list dict set tuple open abs min max sum sorted reversed enumerate zip map filter type isinstance round any all super object Exception ValueError TypeError KeyError IndexError help dir id chr ord format hex bin pow divmod iter next'),
    },
    javascript: {
      line: ['//'], block: [['/*', '*/']], strings: ['`', '"', "'"], defs: true, types: true,
      kw: words('break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await true false null undefined'),
      builtin: words('console document window Math JSON Promise Array Object String Number Boolean Date RegExp Map Set Error fetch setTimeout setInterval clearTimeout clearInterval require module exports process localStorage alert prompt confirm parseInt parseFloat isNaN Symbol globalThis'),
    },
    json: { json: true },
    css: { css: true },
    html: { html: true },
    markdown: { md: true },
    shell: {
      line: ['#'], strings: ['"', "'"], vars: true,
      kw: words('if then else elif fi for while until do done case esac in function return export local readonly select'),
      builtin: words('echo cd ls pwd mkdir rm cp mv cat grep sed awk curl sudo exit source alias read printf test chmod touch npm node python python3 pip pip3 git brew'),
    },
    powershell: {
      line: ['#'], block: [['<#', '#>']], strings: ['"', "'"], vars: true, ci: true,
      kw: words('if else elseif foreach for while do switch function return param begin process end try catch finally throw break continue in'),
      builtin: words('write-host write-output get-childitem set-location get-content set-content new-item remove-item'),
    },
    c: { line: ['//'], block: [['/*', '*/']], strings: ['"', "'"], pre: true, defs: false, types: true, kw: words(C_KW), builtin: words('printf scanf malloc free strlen strcpy memcpy puts fopen fclose main') },
    cpp: { line: ['//'], block: [['/*', '*/']], strings: ['"', "'"], pre: true, types: true, kw: words(C_KW + ' class public private protected virtual override template typename namespace using new delete this throw try catch operator friend constexpr'), builtin: words('std cout cin endl string vector map printf main') },
    java: { line: ['//'], block: [['/*', '*/']], strings: ['"', "'"], types: true, deco: true, kw: words('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws try void volatile while true false null var record'), builtin: words('System String Math Integer List ArrayList Map HashMap Scanner out println') },
    csharp: { line: ['//'], block: [['/*', '*/']], strings: ['"', "'"], types: true, kw: words('abstract as base bool break byte case catch char class const continue decimal default delegate do double else enum event false finally float for foreach if in int interface internal is lock long namespace new null object out override private protected public readonly ref return sealed short static string struct switch this throw true try typeof uint using var virtual void while async await get set'), builtin: words('Console WriteLine ReadLine Math List Dictionary') },
    go: { line: ['//'], block: [['/*', '*/']], strings: ['`', '"', "'"], types: true, kw: words('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil'), builtin: words('fmt Println Printf Sprintf len cap make new append panic recover error string int float64 bool byte rune') },
    rust: { line: ['//'], block: [['/*', '*/']], strings: ['"'], types: true, macros: true, kw: words('as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while dyn'), builtin: words('String Vec Option Some None Result Ok Err Box i32 i64 u32 u64 f32 f64 usize bool str') },
    swift: { line: ['//'], block: [['/*', '*/']], strings: ['"""', '"'], types: true, deco: true, kw: words('class deinit enum extension func import init let protocol struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as false is nil self Self super throws throw true try catch async await private public internal static'), builtin: words('print String Int Double Bool Array Dictionary') },
    kotlin: { line: ['//'], block: [['/*', '*/']], strings: ['"""', '"', "'"], types: true, deco: true, kw: words('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias val var when while by catch constructor finally get import init private public protected internal override open data sealed suspend'), builtin: words('println print listOf mutableListOf mapOf String Int Double Boolean') },
    php: { line: ['//', '#'], block: [['/*', '*/']], strings: ['"', "'"], vars: true, ci: true, kw: words('abstract and array as break case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global if implements include include_once instanceof interface isset list namespace new or print private protected public require require_once return static switch throw trait try unset use var while true false null'), builtin: words('strlen count array_push explode implode json_encode json_decode') },
    ruby: { line: ['#'], strings: ['"', "'"], symbols: true, ivars: true, kw: words('alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield attr_accessor require puts'), builtin: words('print gets p puts each map select require_relative') },
    lua: { line: ['--'], block: [['--[[', ']]']], strings: ['"', "'"], kw: words('and break do else elseif end false for function goto if in local nil not or repeat return then true until while'), builtin: words('print pairs ipairs table string math require tostring tonumber type') },
    sql: { line: ['--'], block: [['/*', '*/']], strings: ["'", '"'], ci: true, kw: words('select from where insert into values update set delete create table drop alter add primary key foreign references join left right inner outer on group by order having limit offset and or not null is in as distinct count sum avg min max like between union all index view default unique asc desc case when then else end exists integer text varchar real boolean') },
    yaml: { yaml: true },
    toml: { toml: true },
    r: { line: ['#'], strings: ['"', "'"], kw: words('if else repeat while function for in next break TRUE FALSE NULL Inf NaN NA return library'), builtin: words('print cat paste c list data.frame vector length sum mean plot') },
    dart: { line: ['//'], block: [['/*', '*/']], strings: ["'''", '"""', '"', "'"], types: true, deco: true, kw: words('abstract as assert async await break case catch class const continue default do dynamic else enum export extends extension external factory false final finally for get if implements import in is late library mixin new null on operator part required rethrow return set static super switch sync this throw true try typedef var void while with yield'), builtin: words('print main String int double bool List Map') },
  };
  L.typescript = Object.assign({}, L.javascript, { kw: Object.assign(words('interface type enum implements private public protected readonly abstract declare namespace keyof as is any unknown never number string boolean'), L.javascript.kw) });

  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  // Tokens are [class, text] pairs; class '' is plain.
  function Tok() { this.t = []; }
  Tok.prototype.add = function (cls, text) { if (text) this.t.push(cls, text); };

  var NUM = /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[a-zA-Z]{0,3}/y;
  var ID = /[A-Za-z_$][\w$]*/y;
  var WS = /\s+/y;

  function at(re, s, i) { re.lastIndex = i; var m = re.exec(s); return m ? m[0] : null; }

  function scanString(s, i, q) {
    var j = i + q.length;
    var multi = q.length === 3 || q === '`';
    while (j < s.length) {
      var c = s[j];
      if (c === '\\') { j += 2; continue; }
      if (!multi && c === '\n') return j;
      if (s.startsWith(q, j)) return j + q.length;
      j++;
    }
    return j;
  }

  function code(s, l, tk) {
    var i = 0, n = s.length, prev = '';
    while (i < n) {
      var c = s[i], m, k;
      // block comments
      if (l.block) {
        var hit = null;
        for (k = 0; k < l.block.length; k++) if (s.startsWith(l.block[k][0], i)) { hit = l.block[k]; break; }
        if (hit) {
          var e = s.indexOf(hit[1], i + hit[0].length);
          e = e < 0 ? n : e + hit[1].length;
          tk.add('com', s.slice(i, e)); i = e; continue;
        }
      }
      if (l.line) {
        var lc = null;
        for (k = 0; k < l.line.length; k++) if (s.startsWith(l.line[k], i)) { lc = l.line[k]; break; }
        // in shell, # only starts a comment at the start of a word
        if (lc && !(l.vars && lc === '#' && i > 0 && !/\s/.test(s[i - 1]))) {
          var le = s.indexOf('\n', i);
          le = le < 0 ? n : le;
          tk.add('com', s.slice(i, le)); i = le; continue;
        }
      }
      if (l.pre && c === '#' && (i === 0 || s[i - 1] === '\n' || /^\s*$/.test(s.slice(s.lastIndexOf('\n', i - 1) + 1, i)))) {
        var pe = s.indexOf('\n', i); pe = pe < 0 ? n : pe;
        tk.add('deco', s.slice(i, pe)); i = pe; continue;
      }
      // strings
      if (l.strings) {
        var pre = l.strPrefix ? at(l.strPrefix, s, i) : null;
        var start = i + (pre ? pre.length : 0);
        var q = null;
        for (k = 0; k < l.strings.length; k++) if (s.startsWith(l.strings[k], start)) { q = l.strings[k]; break; }
        if (q && (pre || start === i)) {
          var se = scanString(s, start, q);
          tk.add('str', s.slice(i, se)); i = se; prev = 'str'; continue;
        }
      }
      if ((l.deco && c === '@') || (l.ivars && c === '@')) {
        m = at(/@[\w.]+/y, s, i);
        if (m) { tk.add(l.ivars ? 'builtin' : 'deco', m); i += m.length; continue; }
      }
      if (l.vars && c === '$') {
        m = at(/\$(\{[^}\n]*\}|[\w]+|.)/y, s, i);
        if (m) { tk.add('builtin', m); i += m.length; continue; }
      }
      if (l.symbols && c === ':' && /[A-Za-z_]/.test(s[i + 1] || '') && s[i - 1] !== ':') {
        m = at(/:[A-Za-z_]\w*[?!]?/y, s, i);
        tk.add('num', m); i += m.length; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        if (!/[\w$]/.test(s[i - 1] || '')) {
          m = at(NUM, s, i);
          if (m) { tk.add('num', m); i += m.length; continue; }
        }
      }
      if (/[A-Za-z_$]/.test(c)) {
        m = at(ID, s, i);
        var w = l.ci ? m.toLowerCase() : m;
        var after = s[i + m.length];
        var cls = '';
        if (l.kw && l.kw[w]) cls = 'kw';
        else if (prev === 'def') cls = 'fn';
        else if (prev === 'class') cls = 'type';
        else if (l.macros && after === '!') cls = 'fn';
        else if (l.builtin && l.builtin[w]) cls = 'builtin';
        else if (after === '(') cls = 'fn';
        else if (l.types && /^[A-Z][a-z0-9]/.test(m)) cls = 'type';
        else if (s[i - 1] === '.' ) cls = 'prop';
        tk.add(cls, m);
        prev = (w === 'def' || w === 'function' || w === 'fn' || w === 'func' || w === 'fun') ? 'def' : (w === 'class' || w === 'struct' || w === 'interface' || w === 'enum' || w === 'trait') ? 'class' : '';
        i += m.length;
        continue;
      }
      if (/\s/.test(c)) { m = at(WS, s, i); tk.add('', m); i += m.length; continue; }
      tk.add('punct', c);
      prev = '';
      i++;
    }
  }

  function json(s, tk) {
    var i = 0, n = s.length;
    while (i < n) {
      var c = s[i], m;
      if (c === '"') {
        var e = scanString(s, i, '"');
        var rest = s.slice(e, e + 40).match(/^\s*:/);
        tk.add(rest ? 'prop' : 'str', s.slice(i, e)); i = e; continue;
      }
      if (s.startsWith('//', i)) { var le = s.indexOf('\n', i); le = le < 0 ? n : le; tk.add('com', s.slice(i, le)); i = le; continue; }
      if (/[-0-9]/.test(c)) { m = at(/-?\d+\.?\d*(?:[eE][+-]?\d+)?/y, s, i); if (m) { tk.add('num', m); i += m.length; continue; } }
      if (/[a-z]/.test(c)) { m = at(/[a-z]+/y, s, i); tk.add(/^(true|false|null)$/.test(m) ? 'kw' : '', m); i += m.length; continue; }
      if (/\s/.test(c)) { m = at(WS, s, i); tk.add('', m); i += m.length; continue; }
      tk.add('punct', c); i++;
    }
  }

  var CSS_VALUES = words('none auto block inline inline-block flex grid absolute relative fixed sticky center left right top bottom solid dashed dotted bold normal italic hidden visible scroll inherit initial transparent space-between space-around column row wrap nowrap pointer important');
  function css(s, tk) {
    var i = 0, n = s.length, depth = 0, inValue = false, m;
    while (i < n) {
      var c = s[i];
      if (s.startsWith('/*', i)) { var e = s.indexOf('*/', i + 2); e = e < 0 ? n : e + 2; tk.add('com', s.slice(i, e)); i = e; continue; }
      if (s.startsWith('//', i) && (i === 0 || /\s/.test(s[i - 1]))) { var le = s.indexOf('\n', i); le = le < 0 ? n : le; tk.add('com', s.slice(i, le)); i = le; continue; }
      if (c === '"' || c === "'") { var se = scanString(s, i, c); tk.add('str', s.slice(i, se)); i = se; continue; }
      if (c === '{') { depth++; inValue = false; tk.add('punct', c); i++; continue; }
      if (c === '}') { depth = Math.max(0, depth - 1); inValue = false; tk.add('punct', c); i++; continue; }
      if (c === ';') { inValue = false; tk.add('punct', c); i++; continue; }
      if (c === '@') { m = at(/@[\w-]+/y, s, i); tk.add('kw', m); i += m.length; continue; }
      if (c === '#' && (inValue || depth > 0) && /[0-9a-fA-F]/.test(s[i + 1] || '')) { m = at(/#[0-9a-fA-F]{3,8}\b/y, s, i); if (m) { tk.add('num', m); i += m.length; continue; } }
      if (/\s/.test(c)) { m = at(WS, s, i); tk.add('', m); i += m.length; continue; }
      var decl = depth > 0 && !inValue;
      if (decl) {
        m = at(/--?[A-Za-z_][\w-]*(?=\s*:)/y, s, i) || at(/[A-Za-z_][\w-]*(?=\s*:)/y, s, i);
        if (m && !/^(hover|focus|active|before|after|root|not|nth-child|first-child|last-child)$/.test(m)) { tk.add('prop', m); i += m.length; m = at(/\s*:/y, s, i); tk.add('punct', m); i += m.length; inValue = true; continue; }
      }
      if (inValue) {
        if (/[-0-9.]/.test(c)) { m = at(/-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|ex|pt|cm|mm|in)?/y, s, i); if (m && m !== '-') { tk.add('num', m); i += m.length; continue; } }
        m = at(/[A-Za-z_-][\w-]*/y, s, i);
        if (m) { tk.add(s[i + m.length] === '(' ? 'fn' : CSS_VALUES[m] ? 'builtin' : '', m); i += m.length; continue; }
        tk.add('punct', c); i++; continue;
      }
      // selectors
      m = at(/[.#][\w-]+/y, s, i);
      if (m) { tk.add(m[0] === '.' ? 'fn' : 'type', m); i += m.length; continue; }
      m = at(/::?[\w-]+/y, s, i);
      if (m) { tk.add('deco', m); i += m.length; continue; }
      m = at(/[A-Za-z][\w-]*/y, s, i);
      if (m) { tk.add('tag', m); i += m.length; continue; }
      tk.add('punct', c); i++;
    }
  }

  function html(s, tk) {
    var i = 0, n = s.length, m;
    while (i < n) {
      if (s.startsWith('<!--', i)) { var e = s.indexOf('-->', i + 4); e = e < 0 ? n : e + 3; tk.add('com', s.slice(i, e)); i = e; continue; }
      if (s[i] === '<' && /[A-Za-z!?/]/.test(s[i + 1] || '')) {
        m = at(/<\/?[!?]?[\w:-]*/y, s, i);
        var tag = m.replace(/^<\/?/, '').toLowerCase();
        var closing = m[1] === '/';
        tk.add('tag', m); i += m.length;
        // attributes
        while (i < n && s[i] !== '>') {
          if (s.startsWith('/>', i)) break;
          var c = s[i];
          if (/\s/.test(c)) { m = at(WS, s, i); tk.add('', m); i += m.length; continue; }
          if (c === '"' || c === "'") { var q = s.indexOf(c, i + 1); q = q < 0 ? n : q + 1; tk.add('str', s.slice(i, q)); i = q; continue; }
          if (c === '=') { tk.add('punct', c); i++; continue; }
          m = at(/[^\s=>"'/]+/y, s, i);
          if (m) { tk.add(s[i - 1] === '=' ? 'str' : 'attr', m); i += m.length; continue; }
          tk.add('punct', c); i++;
        }
        if (s.startsWith('/>', i)) { tk.add('tag', '/>'); i += 2; continue; }
        if (s[i] === '>') { tk.add('tag', '>'); i++; }
        // what's inside <script> and <style> is JavaScript and CSS
        if (!closing && (tag === 'script' || tag === 'style')) {
          var endAt = s.toLowerCase().indexOf('</' + tag, i);
          if (endAt < 0) endAt = n;
          var inner = s.slice(i, endAt);
          if (tag === 'script') code(inner, L.javascript, tk); else css(inner, tk);
          i = endAt;
        }
        continue;
      }
      if (s[i] === '&') { m = at(/&#?\w+;/y, s, i); if (m) { tk.add('num', m); i += m.length; continue; } }
      var next = s.slice(i).search(/[<&]/);
      var stop = next < 0 ? n : i + Math.max(1, next);
      tk.add('', s.slice(i, stop)); i = stop;
    }
  }

  function inlineMd(line, tk) {
    var i = 0, n = line.length, m;
    while (i < n) {
      var r = line.slice(i);
      if ((m = r.match(/^`[^`]+`/))) { tk.add('str', m[0]); i += m[0].length; continue; }
      if ((m = r.match(/^\*\*[^*]+\*\*|^__[^_]+__/))) { tk.add('b', m[0]); i += m[0].length; continue; }
      if ((m = r.match(/^\*[^*\s][^*]*\*|^_[^_\s][^_]*_/))) { tk.add('i', m[0]); i += m[0].length; continue; }
      if ((m = r.match(/^!?\[[^\]]*\]\([^)]*\)/))) {
        var cut = m[0].indexOf('](');
        tk.add('fn', m[0].slice(0, cut + 1)); tk.add('com', m[0].slice(cut + 1)); i += m[0].length; continue;
      }
      var next = r.slice(1).search(/[`*_!\[]/);
      var stop = next < 0 ? n : i + 1 + next;
      tk.add('', line.slice(i, stop)); i = stop;
    }
  }

  function markdown(s, tk) {
    var lines = s.split('\n'), fence = null;
    for (var k = 0; k < lines.length; k++) {
      var line = lines[k], m;
      if (k) tk.add('', '\n');
      if (fence !== null) {
        tk.add('str', line);
        if (/^\s*(```|~~~)/.test(line)) fence = null;
        continue;
      }
      if ((m = line.match(/^\s*(```|~~~)/))) { fence = m[1]; tk.add('str', line); continue; }
      if (/^#{1,6}\s/.test(line)) { tk.add('h', line); continue; }
      if (/^\s*>/.test(line)) { tk.add('com', line); continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { tk.add('punct', line); continue; }
      if ((m = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)/))) { tk.add('', m[1]); tk.add('kw', m[2]); tk.add('', m[3]); inlineMd(line.slice(m[0].length), tk); continue; }
      inlineMd(line, tk);
    }
  }

  function keyed(s, tk, sep) {
    var lines = s.split('\n');
    for (var k = 0; k < lines.length; k++) {
      var line = lines[k], m;
      if (k) tk.add('', '\n');
      if ((m = line.match(/^(\s*)([#;].*)$/))) { tk.add('', m[1]); tk.add('com', m[2]); continue; }
      if (sep === '=' && (m = line.match(/^(\s*)(\[\[?[^\]]*\]\]?)(.*)$/))) { tk.add('', m[1]); tk.add('kw', m[2]); tk.add('', m[3]); continue; }
      var re = sep === ':' ? /^(\s*(?:-\s+)?)([\w.$"' -]+?)(\s*:)(?=\s|$)(.*)$/ : /^(\s*)([\w.$"' -]+?)(\s*=)(.*)$/;
      m = line.match(re);
      var rest = line;
      if (m) { tk.add('', m[1]); tk.add('prop', m[2]); tk.add('punct', m[3]); rest = m[4]; }
      else if (sep === ':' && (m = line.match(/^(\s*)(-)(\s.*|)$/))) { tk.add('', m[1]); tk.add('punct', m[2]); rest = m[3]; }
      value(rest, tk);
    }
  }
  function value(s, tk) {
    var m = s.match(/^(\s*)(.*?)(\s+#.*)?$/);
    if (!m) { tk.add('', s); return; }
    tk.add('', m[1]);
    var v = m[2];
    if (/^["'].*["']$/.test(v)) tk.add('str', v);
    else if (/^-?\d+(\.\d+)?$/.test(v)) tk.add('num', v);
    else if (/^(true|false|null|yes|no|on|off|~)$/i.test(v)) tk.add('kw', v);
    else tk.add('', v);
    if (m[3]) tk.add('com', m[3]);
  }

  /** text -> [html of line 1, html of line 2, ...] */
  function highlight(text, lang) {
    var tk = new Tok();
    var l = L[lang];
    if (!l || text.length > 1500000) tk.add('', text);
    else if (l.json) json(text, tk);
    else if (l.css) css(text, tk);
    else if (l.html) html(text, tk);
    else if (l.md) markdown(text, tk);
    else if (l.yaml) keyed(text, tk, ':');
    else if (l.toml) keyed(text, tk, '=');
    else code(text, l, tk);
    var lines = [], cur = '', t = tk.t;
    for (var k = 0; k < t.length; k += 2) {
      var cls = t[k], parts = t[k + 1].split('\n');
      for (var p = 0; p < parts.length; p++) {
        if (p) { lines.push(cur); cur = ''; }
        if (parts[p]) cur += cls ? '<span class="' + cls + '">' + esc(parts[p]) + '</span>' : esc(parts[p]);
      }
    }
    lines.push(cur);
    return lines;
  }

  var COMMENT = {
    python: '#', shell: '#', ruby: '#', yaml: '#', toml: '#', r: '#', powershell: '#', perl: '#',
    javascript: '//', typescript: '//', c: '//', cpp: '//', java: '//', csharp: '//', go: '//', rust: '//', swift: '//', kotlin: '//', php: '//', dart: '//', json: '//',
    lua: '--', sql: '--', html: ['<!--', '-->'], markdown: ['<!--', '-->'], css: ['/*', '*/'],
  };
  var INDENT = { python: 4, java: 4, csharp: 4, c: 4, cpp: 4, rust: 4, php: 4, kotlin: 4, swift: 4, go: 4 };

  /** The words a language uses, for suggestions as you type. */
  function keywords(lang) {
    var l = L[lang];
    if (!l) return [];
    return Object.keys(l.kw || {}).concat(Object.keys(l.builtin || {}));
  }

  var api = { highlight: highlight, langOf: langOf, NAMES: NAMES, COMMENT: COMMENT, INDENT: INDENT, keywords: keywords, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HL = api;
})(this);
