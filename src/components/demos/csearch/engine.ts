// A small, honest re-implementation of csearch's query path, for one page.
//   chunk:   one chunk per top-level function (the real tool uses ast / tree-sitter)
//   lexical: BM25 the way SQLite FTS5 scores it (k1 = 1.2, b = 0.75), over the
//            same columns csearch writes: split name, split identifiers,
//            docstring, comments. Identifier splitting is ported from
//            csearch/core/index/lexical.py; queries drop stopwords and OR-join.
//   meaning: a STAND-IN for the 768-d embedding leg. A hand-made table of related
//            terms gives every chunk a vector over ~30 concepts; ranking is cosine
//            similarity. It is not a neural model and doesn't pretend to be.
//   fuse:    reciprocal rank fusion, score = sum of 1 / (60 + rank), normalized to
//            the best hit; "No confident match." below a raw floor of 1 / (60 + 40),
//            the same constants as csearch/core/search/fuse.py.
// Runs at build time (for the no-JS page) and in the browser.
import { SAMPLE, type SampleFile } from './sample';

export interface Chunk {
  id: number;
  file: string;
  lang: SampleFile['lang'];
  name: string;
  start: number;
  end: number;
  text: string;
  docstring: string;
  comments: string;
  nameTokens: string[];
  identTokens: string[];
  ftsTokens: string[];
}

/* ---------------- identifier splitting (port of lexical.py) ---------------- */
const CAMEL = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/;
const SEPARATORS = /[_\-.]+/;
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];
export function splitIdentifier(id: string): string[] {
  const out: string[] = [];
  for (const piece of id.split(SEPARATORS)) {
    if (!piece) continue;
    for (const part of piece.split(CAMEL)) if (part) out.push(part.toLowerCase());
  }
  return unique(out);
}
export const STOPWORDS = new Set('a an and are as at be by for from how in is it of on or that the to where with'.split(' '));

/** FTS5's unicode61 tokenizer, near enough: lowercase runs of letters and digits. */
const ftsTokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** Like prepare_fts_query: split, drop stopwords, OR-join. */
export function queryTerms(q: string): string[] {
  const toks: string[] = [];
  for (const raw of q.match(/[A-Za-z0-9]+/g) ?? []) {
    const split = splitIdentifier(raw);
    toks.push(...(split.length ? split : [raw.toLowerCase()]).filter((t) => !STOPWORDS.has(t)));
  }
  return unique(toks);
}

/* ---------------- chunking ---------------- */
const KEYWORDS = new Set(
  ('def return if not for in is None True False try except import from as and or else elif while with lambda async await ' +
    'class pass raise yield export function const let var new typeof extends unknown void string number boolean ' +
    'throw catch Promise Record ReturnType undefined null true false').split(' '),
);
function chunkFile(f: SampleFile, startId: number): Chunk[] {
  const lines = f.text.split('\n');
  const starts: number[] = [];
  const isStart = (l: string) => (f.lang === 'python' ? /^(async\s+)?def\s+\w+/.test(l) : /^export\s+(async\s+)?function\s+\w+/.test(l));
  lines.forEach((l, i) => { if (isStart(l)) starts.push(i); });
  return starts.map((s, k) => {
    // a chunk ends at the last non-blank line before the next definition (or its JSDoc)
    let e = (k + 1 < starts.length ? starts[k + 1] : lines.length) - 1;
    if (f.lang === 'typescript' && k + 1 < starts.length && /^\s*\/\*\*/.test(lines[starts[k + 1] - 1] ?? '')) e = starts[k + 1] - 2;
    while (e > s && !lines[e].trim()) e--;
    const body = lines.slice(s, e + 1).join('\n');
    const name = (body.match(f.lang === 'python' ? /def\s+(\w+)/ : /function\s+(\w+)/) ?? [])[1] ?? 'anonymous';
    let docstring = '';
    let comments = '';
    let code = body;
    if (f.lang === 'python') {
      docstring = ((body.match(/"""([\s\S]*?)"""/) ?? [])[1] ?? '').trim();
      code = code.replace(/"""[\s\S]*?"""/g, ' ');
      comments = [...code.matchAll(/^\s*#\s?(.*)$/gm)].map((m) => m[1].trim()).join(' ');
      code = code.replace(/#.*$/gm, ' ');
    } else {
      const prev = lines[s - 1] ?? '';
      docstring = ((prev.match(/\/\*\*\s*([\s\S]*?)\s*\*\//) ?? [])[1] ?? '').trim();
      comments = [...code.matchAll(/^\s*\/\/\s?(.*)$/gm)].map((m) => m[1].trim()).join(' ');
      code = code.replace(/\/\/.*$/gm, ' ');
    }
    code = code.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, ' '); // string literals are not identifiers
    const idents = unique((code.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter((w) => !KEYWORDS.has(w)));
    const nameTokens = splitIdentifier(name);
    const identTokens = unique([...idents.flatMap(splitIdentifier), ...nameTokens]);
    return {
      id: startId + k, file: f.path, lang: f.lang, name, start: s + 1, end: e + 1, text: body, docstring, comments,
      nameTokens, identTokens,
      ftsTokens: [...nameTokens, ...identTokens, ...ftsTokens(docstring), ...ftsTokens(comments)],
    };
  });
}
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (const f of SAMPLE) out.push(...chunkFile(f, out.length));
  return out;
})();

/* ---------------- BM25, scored like FTS5 ---------------- */
const N = CHUNKS.length;
const AVG = CHUNKS.reduce((a, c) => a + c.ftsTokens.length, 0) / N;
const TF = CHUNKS.map((c) => { const m = new Map<string, number>(); c.ftsTokens.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)); return m; });
const DF = new Map<string, number>();
TF.forEach((m) => m.forEach((_, t) => DF.set(t, (DF.get(t) ?? 0) + 1)));
const K1 = 1.2, B = 0.75;
const idf = (t: string) => { const n = DF.get(t) ?? 0; const v = Math.log((N - n + 0.5) / (n + 0.5)); return v <= 0 ? 1e-6 : v; };

export interface Hit { id: number; score: number; terms: string[] }
export function bm25(terms: string[]): Hit[] {
  const out: Hit[] = [];
  CHUNKS.forEach((c, i) => {
    let s = 0;
    const hitTerms: string[] = [];
    for (const t of terms) {
      const f = TF[i].get(t);
      if (!f) continue;
      hitTerms.push(t);
      s += idf(t) * (f * (K1 + 1)) / (f + K1 * (1 - B + (B * c.ftsTokens.length) / AVG));
    }
    if (s > 0) out.push({ id: c.id, score: s, terms: hitTerms });
  });
  return out.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 40);
}

/* ---------------- the meaning stand-in: a related-terms concept space ---------------- */
// "word*" matches by prefix; anything else must match exactly.
const CONCEPTS: Record<string, string> = {
  validation: 'validat* valid invalid check checks checked verify* malformed error* problem* required require* sanit* refuse*',
  form: 'form forms field* input* submit* street zip address postcode phone',
  checkout: 'checkout cart order* purchas* buy* basket',
  toggle: 'switch* flag* toggl* enabl* disabl* boolean bool on off true false yes casefold coerce*',
  settings: 'setting* config* environ* env variable* prefix option* preference*',
  database: 'database* db sql sqlite connect* url dsn',
  retry: 'retry* retries attempt* backoff again budget',
  fallback: 'fallback* default* safe',
  money: 'price* pric* discount* coupon* promo* reduc* cheaper total subtotal amount* cent* dollar* cost*',
  payment: 'pay* charg* token* authoriz* card*',
  receipt: 'receipt* summary invoice* confirm*',
  shipping: 'ship* courier* deliver* parcel* weight* express rate quote*',
  product: 'sku* product* item* identifier* catalog* goods',
  cleanup: 'normaliz* clean* canonical* strip* trim* tidy upper* format*',
  stock: 'stock* inventor* unit* available quantit*',
  reserve: 'reserv* hold* pending alloc*',
  expiry: 'expir* stale old* older cutoff timeout* ttl age* outdated passed',
  replenish: 'reorder* replenish* restock* low threshold soon refill*',
  session: 'session* login* logon sign* cookie* sid auth*',
  password: 'password* hash* salt* credential* secret* pbkdf2 digest*',
  email: 'email* mail* mailer send* notif* message* subject inbox',
  digest: 'digest* weekly newsletter* unsubscrib* subscri*',
  template: 'template* render* placeholder* fill*',
  typing: 'typ* keystroke* debounc* wait* timer* stops',
  busy: 'busy disabled lock* flight spinner* loading',
  time: 'time* date* datetime utc now clock timestamp*',
  user: 'user* customer* account* person',
};
const CONCEPT_TERMS = Object.entries(CONCEPTS).map(([k, v]) => ({
  k,
  exact: new Set(v.split(' ').filter((w) => !w.endsWith('*'))),
  prefix: v.split(' ').filter((w) => w.endsWith('*')).map((w) => w.slice(0, -1)),
}));
export const conceptsOf = (t: string): string[] => CONCEPT_TERMS.filter((c) => c.exact.has(t) || c.prefix.some((p) => t.startsWith(p))).map((c) => c.k);
const MEANING_STOP = new Set([...STOPWORDS, 'do', 'we', 'does', 'our', 'i', 'my', 'which', 'what', 'when', 'whether', 'should', 'can', 'need', 'needs', 'this', 'into', 'up', 'out', 'there', 'some', 'get', 'set', 'make']);
type Vec = Map<string, number>;
function vectorize(tokens: string[], wordWeight: number): Vec {
  const v: Vec = new Map();
  for (const t of tokens) {
    if (MEANING_STOP.has(t)) continue;
    const cs = conceptsOf(t);
    if (cs.length) cs.forEach((c) => v.set('c:' + c, (v.get('c:' + c) ?? 0) + 1));
    v.set('w:' + t, (v.get('w:' + t) ?? 0) + wordWeight);
  }
  for (const [k, x] of v) v.set(k, Math.sqrt(x));
  return v;
}
const cosine = (a: Vec, b: Vec) => {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, k) => { na += x * x; const y = b.get(k); if (y) dot += x * y; });
  b.forEach((y) => (nb += y * y));
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};
const CHUNK_VECS = CHUNKS.map((c) => vectorize([...c.nameTokens, ...c.identTokens, ...ftsTokens(c.docstring), ...ftsTokens(c.comments)], 0.25));

export function meaning(q: string): Hit[] {
  const toks = (q.match(/[A-Za-z0-9]+/g) ?? []).flatMap((w) => splitIdentifier(w));
  const qv = vectorize(toks, 0.25);
  const concepts = [...qv.keys()].filter((k) => k.startsWith('c:'));
  const out: Hit[] = [];
  CHUNK_VECS.forEach((cv, i) => {
    const shared = concepts.filter((k) => cv.has(k));
    if (!shared.length) return; // the stand-in only returns chunks sharing at least one concept
    out.push({ id: CHUNKS[i].id, score: cosine(qv, cv), terms: shared.map((k) => k.slice(2)) });
  });
  return out.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 40);
}
export const queryConcepts = (q: string) =>
  unique((q.match(/[A-Za-z0-9]+/g) ?? []).flatMap((w) => splitIdentifier(w)).filter((t) => !MEANING_STOP.has(t)).flatMap(conceptsOf));

/* ---------------- reciprocal rank fusion ---------------- */
export const RRF_K = 60;
export const FLOOR = 1 / (RRF_K + 40);
export interface Fused { id: number; raw: number; score: number; lexRank?: number; denseRank?: number }
export function fuse(lex: Hit[], dense: Hit[]): Fused[] {
  const m = new Map<number, Fused>();
  const add = (list: Hit[], key: 'lexRank' | 'denseRank') => list.forEach((h, i) => {
    const e = m.get(h.id) ?? { id: h.id, raw: 0, score: 0 };
    e[key] = i + 1;
    e.raw += 1 / (RRF_K + i + 1);
    m.set(h.id, e);
  });
  add(dense, 'denseRank');
  add(lex, 'lexRank');
  const out = [...m.values()].sort((a, b) => b.raw - a.raw || a.id - b.id);
  const best = out[0]?.raw ?? 1;
  out.forEach((e) => (e.score = e.raw / best));
  return out;
}

export interface Result { q: string; terms: string[]; concepts: string[]; lex: Hit[]; dense: Hit[]; fused: Fused[]; confident: boolean; ms: number }
export function search(q: string): Result {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const terms = queryTerms(q);
  const lex = bm25(terms);
  const dense = meaning(q);
  const fused = fuse(lex, dense);
  const confident = fused.length > 0 && fused[0].raw >= FLOOR;
  const ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  return { q, terms, concepts: queryConcepts(q), lex, dense, fused, confident, ms };
}

export const loc = (c: Chunk) => `${c.file}:${c.start}-${c.end}`;
export const FILES = SAMPLE.length;
