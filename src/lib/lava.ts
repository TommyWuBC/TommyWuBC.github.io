// ---------------------------------------------------------------------------
// Fig. 1, "Move the gap": MiniGrid LavaCrossing drawn as a one-ink plate.
//
// Pure layout + rendering functions. They run twice: at build time (Astro
// renders a static SVG so the figure reads without JavaScript) and in the
// browser (src/scripts/lava-figure.ts re-renders on every new layout).
// ---------------------------------------------------------------------------

type Cell = [number, number];
type Move = 'R' | 'L' | 'D' | 'U';
export interface River {
  o: 'v' | 'h';
  at: number;
  gap: number;
}
export interface Layout {
  variant: number;
  rivers: River[];
  lava: Set<string>;
}
interface Route {
  cells: Cell[];
  moves: Move[];
}
interface Replay {
  cells: Cell[];
  /** Move on which the agent stepped into lava; 0 = reached the goal; -1 = ran out of moves. */
  fellAt: number;
}

const C = 100; // px per cell; the interior is 7 x 7 (cells 1..7)
const N = 7;
const START: Cell = [1, 1];
const GOAL: Cell = [N, N];
const OFF_GEN = 10; // parallel offsets so the two routes never sit on top of each other
const OFF_SPEC = -14;
export const MS_PER_STEP = 120;

const key = (x: number, y: number) => `${x},${y}`;

// A layout is a set of rivers (full-width lava lines) with one gap each.
function buildLava(rivers: River[]): Set<string> {
  const lava = new Set<string>();
  for (const r of rivers) {
    for (let i = 1; i <= N; i++) lava.add(r.o === 'v' ? key(r.at, i) : key(i, r.at));
  }
  for (const r of rivers) lava.delete(r.o === 'v' ? key(r.at, r.gap) : key(r.gap, r.at));
  return lava;
}

/** The layout the single-environment policy trained on. */
export const TRAINING: Layout = (() => {
  const rivers: River[] = [{ o: 'v', at: 4, gap: 6 }];
  return { variant: 0, rivers, lava: buildLava(rivers) };
})();

/** Shortest route with the fewest turns (Dijkstra over cell + heading). */
function bestRoute(lava: Set<string>): Route {
  const dirs: [number, number, Move][] = [
    [1, 0, 'R'],
    [0, 1, 'D'],
    [-1, 0, 'L'],
    [0, -1, 'U'],
  ];
  const dist: Record<string, number> = {};
  const prev: Record<string, string> = {};
  const s0 = `${key(...START)}|-`;
  const q: [number, number, number, number, string][] = [[0, START[0], START[1], -1, s0]];
  dist[s0] = 0;
  let end: string | null = null;
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [d, cx, cy, h, sk] = q.shift()!;
    if (d > dist[sk]) continue;
    if (cx === GOAL[0] && cy === GOAL[1]) {
      end = sk;
      break;
    }
    dirs.forEach(([dx, dy], i) => {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 1 || ny < 1 || nx > N || ny > N || lava.has(key(nx, ny))) return;
      const nd = d + 1 + (h !== -1 && h !== i ? 0.01 : 0);
      const nk = `${key(nx, ny)}|${i}`;
      if (dist[nk] === undefined || nd < dist[nk] - 1e-9) {
        dist[nk] = nd;
        prev[nk] = sk;
        q.push([nd, nx, ny, i, nk]);
      }
    });
  }
  const cells: Cell[] = [];
  for (let k = end; k; k = prev[k]) cells.unshift(k.split('|')[0].split(',').map(Number) as Cell);
  const moves: Move[] = [];
  for (let j = 1; j < cells.length; j++) {
    const [ax, ay] = cells[j - 1];
    const [bx, by] = cells[j];
    moves.push(bx > ax ? 'R' : bx < ax ? 'L' : by > ay ? 'D' : 'U');
  }
  return { cells, moves };
}

/** The memorizing policy: replay the training route's moves, blind to the layout. */
const MEMORIZED = bestRoute(TRAINING.lava).moves;

function replay(lava: Set<string>, moves: Move[]): Replay {
  let x = START[0];
  let y = START[1];
  const cells: Cell[] = [[x, y]];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    x += m === 'R' ? 1 : m === 'L' ? -1 : 0;
    y += m === 'D' ? 1 : m === 'U' ? -1 : 0;
    cells.push([x, y]);
    if (lava.has(key(x, y))) return { cells, fellAt: i + 1 };
    if (x === GOAL[0] && y === GOAL[1]) return { cells, fellAt: 0 };
  }
  return { cells, fellAt: -1 };
}

/**
 * A random solvable layout with n rivers, built the way MiniGrid's CrossingEnv
 * builds them: choose river lines, then a monotone path that opens one gap in each.
 */
function randomLayoutOnce(n: number, rand: () => number): Layout | null {
  const cands: [River['o'], number][] = [
    ['v', 2],
    ['v', 4],
    ['v', 6],
    ['h', 2],
    ['h', 4],
    ['h', 6],
  ];
  const pool = cands.slice();
  const picked: [River['o'], number][] = [];
  while (picked.length < n) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const vs = picked.filter((p) => p[0] === 'v').map((p) => p[1]);
  const hs = picked.filter((p) => p[0] === 'h').map((p) => p[1]);
  let x = 1;
  let y = 1;
  const path: Cell[] = [[1, 1]];
  while (x < N || y < N) {
    const mustR = vs.includes(x);
    const mustD = hs.includes(y);
    if (mustR && mustD) return null;
    let step: 'R' | 'D';
    if (mustR) step = 'R';
    else if (mustD) step = 'D';
    else if (x === N) step = 'D';
    else if (y === N) step = 'R';
    else step = rand() < 0.5 ? 'R' : 'D';
    if (step === 'R') {
      if (x === N) return null;
      x++;
    } else {
      if (y === N) return null;
      y++;
    }
    path.push([x, y]);
  }
  const rivers: River[] = picked.map(([o, at]) => {
    const cell = path.find((c) => (o === 'v' ? c[0] === at : c[1] === at))!;
    return { o, at, gap: o === 'v' ? cell[1] : cell[0] };
  });
  const lava = buildLava(rivers);
  if (lava.has(key(...START)) || lava.has(key(...GOAL))) return null;
  return { variant: n, rivers, lava };
}

const sameAsTraining = (L: Layout) =>
  L.rivers.length === 1 && L.rivers.every((r, i) => {
    const t = TRAINING.rivers[i];
    return r.o === t.o && r.at === t.at && r.gap === t.gap;
  });

/**
 * A new layout for the figure. Rejects layouts where the memorizer dies within
 * its first few moves: a death on move 1 teaches nothing. The interesting
 * failure is the one where it walks confidently along its old route and then
 * steps into lava on a square that used to be safe.
 */
export function randomLayout(n: number, rand: () => number = Math.random): Layout {
  let fallback: Layout | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const L = randomLayoutOnce(n, rand);
    if (!L || sameAsTraining(L)) continue;
    fallback ??= L;
    const { fellAt } = replay(L.lava, MEMORIZED);
    if (fellAt === 0 || fellAt >= 4) return L;
  }
  return fallback ?? TRAINING;
}

const px = (v: number) => (v - 1 + 0.5) * C;
const pathD = (cells: Cell[], off: number) =>
  cells.map((c, i) => `${i ? 'L' : 'M'}${px(c[0]) + off} ${px(c[1]) + off}`).join(' ');

export interface Rendered {
  svg: string;
  gen: Route;
  spec: Replay;
}

/** Render the inside of the figure's <svg>. `animated` adds reveal masks so the routes are walked, not faded. */
export function render(L: Layout, animated: boolean): Rendered {
  const gen = bestRoute(L.lava);
  const spec = replay(L.lava, MEMORIZED);
  const o: string[] = [];
  o.push(
    '<defs><pattern id="lv-hatch" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="13" height="13" fill="var(--paper)"/><line x1="3" y1="0" x2="3" y2="13" stroke="var(--ink)" stroke-width="4.5"/></pattern>',
  );
  if (animated) {
    const mask = (id: string, d: string, ms: number) =>
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="740" height="740"><path class="lv-reveal" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="square" stroke-linejoin="round" stroke-dasharray="1 1" stroke-dashoffset="1" style="--dur:${ms}ms"/></mask>`;
    o.push(mask('lv-m-gen', pathD(gen.cells, OFF_GEN), gen.moves.length * MS_PER_STEP));
    o.push(mask('lv-m-spec', pathD(spec.cells, OFF_SPEC), (spec.cells.length - 1) * MS_PER_STEP));
  }
  o.push('</defs>');
  for (let i = 1; i < N; i++) {
    o.push(`<line class="lv-grid" x1="${i * C}" y1="0" x2="${i * C}" y2="${N * C}"/>`);
    o.push(`<line class="lv-grid" x1="0" y1="${i * C}" x2="${N * C}" y2="${i * C}"/>`);
  }
  L.lava.forEach((k) => {
    const [x, y] = k.split(',').map(Number);
    o.push(`<rect class="lv-lava" x="${(x - 1) * C}" y="${(y - 1) * C}" width="${C}" height="${C}"/>`);
  });
  const g = (N - 1) * C;
  o.push(`<rect class="lv-goal-ring" x="${g + 16}" y="${g + 16}" width="${C - 32}" height="${C - 32}"/>`);
  o.push(`<rect class="lv-goal" x="${g + 30}" y="${g + 30}" width="${C - 60}" height="${C - 60}"/>`);
  const m = (id: string) => (animated ? ` mask="url(#${id})"` : '');
  o.push(`<path class="lv-route lv-route--gen"${m('lv-m-gen')} d="${pathD(gen.cells, OFF_GEN)}"/>`);
  o.push(`<path class="lv-route lv-route--spec"${m('lv-m-spec')} d="${pathD(spec.cells, OFF_SPEC)}"/>`);
  if (spec.fellAt > 0) {
    const f = spec.cells[spec.cells.length - 1];
    const fx = px(f[0]) + OFF_SPEC;
    const fy = px(f[1]) + OFF_SPEC;
    const s = 11;
    const delay = animated ? ` style="--delay:${spec.fellAt * MS_PER_STEP}ms"` : '';
    o.push(
      `<g class="lv-failmark"${delay}><circle class="lv-fail-bg" cx="${fx}" cy="${fy}" r="24"/>` +
        `<line class="lv-fail" x1="${fx - s}" y1="${fy - s}" x2="${fx + s}" y2="${fy + s}"/>` +
        `<line class="lv-fail" x1="${fx - s}" y1="${fy + s}" x2="${fx + s}" y2="${fy - s}"/></g>`,
    );
  }
  // The agent: MiniGrid's triangle, pointing along its first move.
  const first = gen.moves[0] ?? 'R';
  const cx = px(1);
  const cy = px(1);
  const r = 26;
  const tri =
    first === 'D'
      ? [[cx - r, cy - r * 0.8], [cx + r, cy - r * 0.8], [cx, cy + r]]
      : [[cx - r * 0.8, cy - r], [cx - r * 0.8, cy + r], [cx + r, cy]];
  o.push(`<polygon class="lv-agent" points="${tri.map((p) => p.join(',')).join(' ')}"/>`);
  o.push(`<rect class="lv-frame" x="0" y="0" width="${N * C}" height="${N * C}"/>`);
  return { svg: o.join(''), gen, spec };
}

const WALLS = ['', 'one lava wall', 'two lava walls', 'three lava walls'];

/** Plain-language description: the SVG's <desc> and the status line under the controls. */
export function describe(L: Layout, res: Rendered) {
  const walls = WALLS[L.rivers.length];
  const training = L === TRAINING;
  const where = training
    ? `The layout the single-layout policy trained on, with ${walls}.`
    : `A new layout with ${walls}.`;
  const gen = `The solid route, from the policy trained on many layouts, reaches the goal in ${res.gen.moves.length} moves.`;
  const spec =
    res.spec.fellAt > 0
      ? `The dotted route replays what it memorized and walks into lava on move ${res.spec.fellAt}.`
      : training
        ? 'The dotted route, from the single-layout policy, also reaches the goal: this is the layout it memorized.'
        : 'The dotted route gets lucky: the gaps happen to sit on the route it memorized.';
  let status: string;
  if (training) status = 'Both routes reach the goal. This is the layout the dotted policy trained on.';
  else if (res.spec.fellAt > 0)
    status = `Dotted walks into lava on move ${res.spec.fellAt}, on a square that was safe in the layout it memorized. Solid reaches the goal in ${res.gen.moves.length}.`;
  else status = 'Both make it this time: the gaps happen to sit on the memorized route.';
  return { desc: `${where} ${gen} ${spec}`, status };
}
