// Comparing two versions of a text, line by line: the coloured bars beside
// changed lines, the side-by-side view of what changed, and the preview of an
// edit Ember suggests. (Myers' diff, the same idea git uses.)
(function (root) {
  'use strict';

  /** Edit script between two arrays of lines: [{ t: '=', a, b, n } | { t: '-', a, n } | { t: '+', b, n }]. */
  function lines(A, B) {
    // the same lines at the start and end don't need comparing
    var pre = 0, n = A.length, m = B.length;
    while (pre < n && pre < m && A[pre] === B[pre]) pre++;
    var suf = 0;
    while (suf < n - pre && suf < m - pre && A[n - 1 - suf] === B[m - 1 - suf]) suf++;
    var a = A.slice(pre, n - suf), b = B.slice(pre, m - suf);
    var mid = core(a, b);
    var out = [];
    if (pre) out.push({ t: '=', a: 0, b: 0, n: pre });
    mid.forEach(function (op) {
      var o = { t: op.t, n: op.n };
      if (op.a !== undefined) o.a = op.a + pre;
      if (op.b !== undefined) o.b = op.b + pre;
      out.push(o);
    });
    if (suf) out.push({ t: '=', a: n - suf, b: m - suf, n: suf });
    return merge(out);
  }

  function core(a, b) {
    var n = a.length, m = b.length;
    if (!n && !m) return [];
    if (!n) return [{ t: '+', b: 0, n: m }];
    if (!m) return [{ t: '-', a: 0, n: n }];
    var max = n + m;
    if (n * m > 4e7 && max > 30000) return [{ t: '-', a: 0, n: n }, { t: '+', b: 0, n: m }]; // too big to compare nicely
    // lines to numbers, so comparing is quick
    var ids = Object.create(null), next = 1;
    var ai = a.map(function (s) { return ids[s] || (ids[s] = next++); });
    var bi = b.map(function (s) { return ids[s] || (ids[s] = next++); });
    var v = new Int32Array(2 * max + 2), trace = [], off = max + 1, d, k, x, y;
    var limit = Math.min(max, 6000);
    outer:
    for (d = 0; d <= limit; d++) {
      trace.push(v.slice());
      for (k = -d; k <= d; k += 2) {
        if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
        else x = v[off + k - 1] + 1;
        y = x - k;
        while (x < n && y < m && ai[x] === bi[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= n && y >= m) break outer;
      }
    }
    if (d > limit) return [{ t: '-', a: 0, n: n }, { t: '+', b: 0, n: m }];
    // walk back to find the steps
    var ops = [];
    x = n; y = m;
    for (var dd = trace.length - 1; dd >= 0; dd--) {
      var vv = trace[dd];
      k = x - y;
      var prevK = (k === -dd || (k !== dd && vv[off + k - 1] < vv[off + k + 1])) ? k + 1 : k - 1;
      var px = vv[off + prevK], py = px - prevK;
      while (x > px && y > py) { ops.push({ t: '=', a: x - 1, b: y - 1, n: 1 }); x--; y--; }
      if (dd > 0) {
        if (x === px) ops.push({ t: '+', b: y - 1, n: 1 });
        else ops.push({ t: '-', a: x - 1, n: 1 });
      }
      x = px; y = py;
    }
    return ops.reverse();
  }

  function merge(ops) {
    var out = [];
    ops.forEach(function (o) {
      var last = out[out.length - 1];
      if (last && last.t === o.t && (o.t !== '=' || (last.a + last.n === o.a && last.b + last.n === o.b)) &&
        (o.t !== '-' || last.a + last.n === o.a) && (o.t !== '+' || last.b + last.n === o.b)) last.n += o.n;
      else out.push({ t: o.t, a: o.a, b: o.b, n: o.n });
    });
    return out;
  }

  /**
   * The bars beside changed lines, for the new text: { line: 'add' | 'mod' } and
   * dels: [line before which something was removed].
   */
  function marks(oldText, newText) {
    var ops = lines(split(oldText), split(newText)), map = Object.create(null), dels = [], b = 0;
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      if (o.t === '=') { b = o.b + o.n; continue; }
      if (o.t === '-') {
        var nx = ops[i + 1];
        if (nx && nx.t === '+') { for (var j = 0; j < nx.n; j++) map[nx.b + j] = j < o.n ? 'mod' : 'add'; b = nx.b + nx.n; i++; }
        else dels.push(b);
        continue;
      }
      var nd = ops[i + 1];
      if (nd && nd.t === '-') { for (var r = 0; r < o.n; r++) map[o.b + r] = r < nd.n ? 'mod' : 'add'; b = o.b + o.n; i++; continue; }
      for (var q = 0; q < o.n; q++) map[o.b + q] = 'add';
      b = o.b + o.n;
    }
    return { map: map, dels: dels, changed: Object.keys(map).length + dels.length };
  }

  /** Rows for showing a change: [{ k: 'ctx'|'add'|'del'|'gap', a, b, text }], with `context` unchanged lines around each change. */
  function rows(oldText, newText, context) {
    context = context === undefined ? 3 : context;
    var A = split(oldText), B = split(newText), ops = lines(A, B), out = [], adds = 0, dels = 0;
    ops.forEach(function (o, idx) {
      if (o.t === '=') {
        var first = idx === 0, last = idx === ops.length - 1;
        if (o.n <= context * 2 + 1 || context < 0) { for (var i = 0; i < o.n; i++) out.push({ k: 'ctx', a: o.a + i, b: o.b + i, text: A[o.a + i] }); return; }
        if (!first) for (var j = 0; j < context; j++) out.push({ k: 'ctx', a: o.a + j, b: o.b + j, text: A[o.a + j] });
        out.push({ k: 'gap', n: o.n - (first ? 0 : context) - (last ? 0 : context) });
        if (!last) for (var z = o.n - context; z < o.n; z++) out.push({ k: 'ctx', a: o.a + z, b: o.b + z, text: A[o.a + z] });
        return;
      }
      if (o.t === '-') { dels += o.n; for (var d = 0; d < o.n; d++) out.push({ k: 'del', a: o.a + d, text: A[o.a + d] }); return; }
      adds += o.n;
      for (var p = 0; p < o.n; p++) out.push({ k: 'add', b: o.b + p, text: B[o.b + p] });
    });
    return { rows: out, adds: adds, dels: dels };
  }

  function split(t) {
    t = String(t == null ? '' : t);
    if (t === '') return [];
    var l = t.split('\n');
    if (l[l.length - 1] === '') l.pop();
    return l;
  }

  var api = { lines: lines, marks: marks, rows: rows, split: split };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DIFF = api;
})(this);
