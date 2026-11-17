'use strict';
// Ember's help: den borrows Tree of Thought's AI (~/.tot), so there's nothing
// new to set up. It prefers Tree of Thought's free cloud models (nothing heavy
// runs on your computer), then a model on this computer (Ollama), then
// whatever Tree of Thought uses. The AI only ever answers: it never changes a
// file by itself.

const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('./providers');

const totHome = () => process.env.TOT_HOME || path.join(os.homedir(), '.tot');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const keyOf = (m) => `${m.provider}:${m.id}`;
const local = (m) => m && m.provider === 'ollama';

async function models() {
  const out = [];
  const tot = readJson(path.join(totHome(), 'config.json'), {});
  if (tot.customBase) P.setCustomBase(tot.customBase);
  const keys = readJson(path.join(totHome(), 'keys.json'), {});
  for (const m of tot.garden || []) {
    if (m.provider === 'auto' || out.some((x) => keyOf(x) === keyOf(m))) continue;
    if (!P.PROVIDERS[m.provider]) continue;
    if (!P.PROVIDERS[m.provider].noKey && !keys[m.provider]) continue;
    out.push({ provider: m.provider, id: m.id, name: m.name || m.id, free: !!m.free, power: m.power || 0 });
  }
  const mine = await P.ollamaModels().catch(() => null);
  for (const m of mine || []) {
    if (/embed/i.test(m.name) || out.some((x) => x.provider === 'ollama' && x.id === m.name)) continue;
    out.push({ provider: 'ollama', id: m.name, name: m.name, size: m.size || 0 });
  }
  return out;
}

/** The model to ask: free cloud first, then this computer, then Tree of Thought's current one. */
async function current(choice = null) {
  const all = await models();
  const picked = choice && all.find((m) => keyOf(m) === choice);
  if (picked) return { model: picked, all };
  const free = all.filter((m) => m.free && !local(m)).sort((a, b) => (b.power || 0) - (a.power || 0));
  if (free.length) return { model: free[0], all };
  const locals = all.filter(local).sort((a, b) => (b.size || 0) - (a.size || 0));
  if (locals.length) return { model: locals[0], all };
  const tot = readJson(path.join(totHome(), 'config.json'), {});
  const g = (tot.garden || [])[tot.current || 0];
  return { model: (g && all.find((m) => keyOf(m) === keyOf(g))) || all[0] || null, all };
}

const SYSTEM = `You are Ember, a friendly fox who helps people learn to code inside den, a simple code editor. Many of the people you help are beginners.
- Answer in plain, everyday words. Short sentences. Explain any jargon the first time you use it.
- Be brief: a few sentences or a short list, unless they ask for more.
- When you show code, put it in one fenced block with the language name (like \`\`\`python), and show the whole part that changes so it can be pasted in as it is.
- When something is broken, say what went wrong first, in one sentence, then how to fix it.
- Only talk about files you were shown. Never pretend to have run code.
- Encourage them. Mistakes are how everyone learns.`;

/** Put the question together with what's on screen. */
function prompt({ question, file = null, lang = '', text = '', selection = '', error = '', folder = '' }) {
  const parts = [];
  if (folder) parts.push(`Project folder: ${folder}`);
  if (file) {
    const body = text.length > 14000 ? text.slice(0, 14000) + '\n…(the rest of the file is cut off)' : text;
    parts.push(`The file they have open is ${file}${lang ? ` (${lang})` : ''}:\n\`\`\`${lang}\n${body}\n\`\`\``);
  }
  if (selection) parts.push(`They selected this part:\n\`\`\`${lang}\n${selection.slice(0, 6000)}\n\`\`\``);
  if (error) parts.push(`The last time they ran it, it printed this:\n\`\`\`\n${error.slice(-4000)}\n\`\`\``);
  parts.push(`Their question: ${question}`);
  return parts.join('\n\n');
}

/**
 * Ask, and stream the answer: onText(piece) as it's written.
 * history: earlier turns [{ role: 'user'|'assistant', content }].
 */
async function ask({ model, question, context = {}, history = [], onText, signal }) {
  const keys = readJson(path.join(totHome(), 'keys.json'), {});
  const messages = history.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 8000) }));
  messages.push({ role: 'user', content: prompt({ question, ...context }) });
  // a free model that's busy or over its limit hands over to another free one
  const all = model.free ? await models() : [];
  const others = all.filter((m) => m.free && !local(m) && keyOf(m) !== keyOf(model)).sort((a, b) => (b.power || 0) - (a.power || 0));
  let last;
  let said = false;
  for (const m of [model, ...others].slice(0, 4)) {
    try {
      const r = await P.chat({
        provider: m.provider, key: keys[m.provider], model: m.id, system: SYSTEM, messages, signal,
        onText: (t) => { said = true; onText(t); },
      });
      return { text: r.text, model: m };
    } catch (e) {
      last = e;
      const s = Number(e.status) || 0;
      if (said || e.name === 'AbortError' || !(s === 429 || s >= 500 || (!s && /couldn't reach|cut off/i.test(e.message)))) throw e;
    }
  }
  throw last;
}

module.exports = { models, current, ask, prompt, keyOf, local, SYSTEM, totHome };
