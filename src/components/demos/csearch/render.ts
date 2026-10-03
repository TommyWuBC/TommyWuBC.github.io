// HTML for the search demo, shared by the build (no-JS page) and the browser.
import { CHUNKS, FLOOR, RRF_K, loc, splitIdentifier, type Result, type Chunk } from './engine';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const f4 = (x: number) => x.toFixed(4);
export const SHOW = 5;

function row(c: Chunk, rank: number, score: string, extra = '') {
  return `<li><button type="button" class="cs-row" data-id="${c.id}" aria-label="${esc(`${c.name}, ${loc(c)}, rank ${rank}`)}">` +
    `<span class="cs-rk">${rank}</span><span class="cs-nm">${esc(c.name)}</span>` +
    `<span class="cs-loc">${esc(loc(c))}</span><span class="cs-sc">${score}</span>${extra}</button></li>`;
}
const more = (n: number) => (n > SHOW ? `<li class="cs-more">${n - SHOW} more matched</li>` : '');

export function lexHTML(r: Result) {
  if (!r.lex.length) return `<li class="cs-none">No chunk shares a word with <code>${esc(r.terms.join(' OR ') || '(nothing left after stopwords)')}</code>.</li>`;
  return r.lex.slice(0, SHOW).map((h, i) => row(CHUNKS[h.id], i + 1, h.score.toFixed(2))).join('') + more(r.lex.length);
}
export function denseHTML(r: Result) {
  if (!r.dense.length) return `<li class="cs-none">No chunk shares a concept with this query.</li>`;
  return r.dense.slice(0, SHOW).map((h, i) => row(CHUNKS[h.id], i + 1, h.score.toFixed(2))).join('') + more(r.dense.length);
}
export function fusedHTML(r: Result) {
  if (!r.fused.length) return `<li class="cs-none">Nothing to fuse: both lists are empty.</li>`;
  return r.fused.slice(0, SHOW).map((h, i) => {
    const parts: string[] = [];
    if (h.lexRank) parts.push(`1/${RRF_K + h.lexRank}`);
    if (h.denseRank) parts.push(`1/${RRF_K + h.denseRank}`);
    const sum = `<span class="cs-math">${parts.join(' + ')} = ${f4(h.raw)}</span>`;
    return row(CHUNKS[h.id], i + 1, h.score.toFixed(2), sum);
  }).join('') + more(r.fused.length);
}

/** The bottom line, the way the CLI prints it. */
export function answerHTML(r: Result) {
  const top = r.fused[0];
  const best = top ? f4(top.raw) : '0.0000';
  if (!r.confident || !top) {
    return `<p class="cs-out cs-out-none">No confident match.</p>` +
      `<p class="cs-floor">Best fused score ${best}, below the floor of 1/(60 + 40) = ${f4(FLOOR)}. csearch says so instead of guessing.</p>`;
  }
  return `<p class="cs-out">${esc(loc(CHUNKS[top.id]))}</p>` +
    `<p class="cs-floor">Best fused score ${best}, above the floor of 1/(60 + 40) = ${f4(FLOOR)}, so it prints the top hit.</p>`;
}

/** A short, true note about what happened, when there's something worth saying. */
export function noteHTML(r: Result) {
  const top = r.fused[0];
  if (!top || !r.confident) return '';
  const d1 = r.dense[0];
  if (d1 && d1.id !== top.id && !r.lex.some((h) => h.id === d1.id)) {
    const c = CHUNKS[d1.id];
    const at = r.fused.findIndex((h) => h.id === d1.id) + 1;
    return `The meaning leg&rsquo;s first pick, <code>${esc(c.name)}</code>, shares no words with the query, so the keyword leg never saw it. ` +
      `Found by one leg, it scores at most 1/61 = 0.0164; a chunk both legs half-like scores over 0.03. It finishes #${at}. ` +
      `Fusion rewards agreement, and it can&rsquo;t tell which leg is right. This is the vocabulary-gap case the eval measures separately.`;
  }
  if (top.lexRank === 1 && top.denseRank === 1) return `Both legs put <code>${esc(CHUNKS[top.id].name)}</code> first, so it wins with the highest score fusion allows: 1/61 + 1/61.`;
  return '';
}

/** The chunk's source, line-numbered, with keyword hits highlighted and concept hits underlined. */
export function codeHTML(c: Chunk, terms: string[], conceptWords: (w: string) => boolean) {
  const T = new Set(terms);
  const lines = c.text.split('\n');
  const mark = (line: string) => line.replace(/[A-Za-z_][A-Za-z0-9_]*|[^A-Za-z_]+/g, (w) => {
    if (!/^[A-Za-z_]/.test(w)) return esc(w);
    const parts = splitIdentifier(w);
    if (parts.some((p) => T.has(p))) return `<mark class="cs-kw">${esc(w)}</mark>`;
    if (parts.some((p) => conceptWords(p))) return `<span class="cs-cn">${esc(w)}</span>`;
    return esc(w);
  });
  return lines.map((l, i) => `<span class="cs-ln"><span class="cs-n" aria-hidden="true">${c.start + i}</span>${mark(l) || ' '}</span>`).join('');
}

export function splitHTML(c: Chunk, terms: string[]) {
  const T = new Set(terms);
  return `<code>${esc(c.name)}</code> is indexed as ` +
    c.nameTokens.map((t) => (T.has(t) ? `<mark class="cs-kw">${esc(t)}</mark>` : `<span>${esc(t)}</span>`)).join(' ');
}
