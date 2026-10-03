// LavaCrossing, small enough to run in a page. Shared by the server-rendered
// fallback (LavaRace.astro, Rooms.astro) and the live race (race.js).
//
// Layouts follow MiniGrid's CrossingEnv: a 9x9 room with walls around it,
// rivers of lava on even rows or columns, one opening per river, and the
// openings placed along a staircase so a path always exists.
//
// The two agents are sketches of behavior, not the trained networks:
//   many   plans on the real map (stands in for domain-randomized PPO).
//   hollow knows how to cross one river, the only kind of room it trained in,
//          and walks the rest of the room as if it were open floor.

export const S = 9;
export const C = 40;

/** Paper numbers. PPO rows: success over 42, 249 and 276 layouts. */
export const PAPER = {
  one: { 1: '95.2%', 2: '20%', 3: '10%' },
  many: { 1: '100%', 2: '98.4%', 3: '97.8%' },
  layouts: { 1: 42, 2: 249, 3: 276 },
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Which rows and columns hold lava. */
export function pickRivers(n, r) {
  const rivers = shuffle([[2, 'v'], [4, 'v'], [6, 'v'], [2, 'h'], [4, 'h'], [6, 'h']], r).slice(0, n);
  return {
    rv: rivers.filter((q) => q[1] === 'v').map((q) => q[0]).sort((a, b) => a - b),
    rh: rivers.filter((q) => q[1] === 'h').map((q) => q[0]).sort((a, b) => a - b),
  };
}

/** Lay the rivers down and cut one opening in each, in staircase order. */
export function build(n, rv, rh, r) {
  const randint = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const g = [];
  for (let y = 0; y < S; y++) { g.push([]); for (let x = 0; x < S; x++) g[y].push(x === 0 || y === 0 || x === S - 1 || y === S - 1 ? 'W' : '.'); }
  rv.forEach((x) => { for (let y = 1; y < S - 1; y++) g[y][x] = 'L'; });
  rh.forEach((y) => { for (let x = 1; x < S - 1; x++) g[y][x] = 'L'; });
  const order = shuffle([...rv.map(() => 'h'), ...rh.map(() => 'v')], r);
  const lv = [0, ...rv, S - 1], lh = [0, ...rh, S - 1];
  let ri = 0, rj = 0;
  const openings = [];
  for (const d of order) {
    let x, y;
    if (d === 'h') { x = lv[ri + 1]; y = randint(lh[rj] + 1, lh[rj + 1] - 1); ri++; }
    else { x = randint(lv[ri] + 1, lv[ri + 1] - 1); y = lh[rj + 1]; rj++; }
    g[y][x] = '.'; openings.push({ x, y, d });
  }
  return { g, openings, n, rv, rh };
}

export function layoutFromSeed(n, seed) {
  const r = mulberry32(seed);
  const { rv, rh } = pickRivers(n, r);
  return build(n, rv, rh, r);
}

export function bfs(passable) {
  const start = [1, 1], goal = [S - 2, S - 2], key = (x, y) => x + ',' + y;
  const prev = new Map([[key(start[0], start[1]), null]]), q = [start];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === goal[0] && y === goal[1]) break;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!prev.has(k) && passable(nx, ny)) { prev.set(k, [x, y]); q.push([nx, ny]); }
    }
  }
  if (!prev.has(key(goal[0], goal[1]))) return [start];
  const out = []; let cur = goal;
  while (cur) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
  return out;
}

export const truePath = (L) => bfs((x, y) => L.g[y][x] === '.');

/** True for cells on the first river the agent meets (the one a one-river room teaches). */
export function onFirstRiver(L) {
  const f = L.openings[0];
  return (x, y) => (f.d === 'h' ? x === f.x : y === f.y);
}

/** What the hollow agent thinks the room is: the first river is real, the rest is floor. */
export function believedPath(L) {
  const first = onFirstRiver(L);
  return bfs((x, y) => L.g[y][x] !== 'W' && !(L.g[y][x] === 'L' && first(x, y)));
}

/** Cells the hollow agent believes are floor but are lava. */
export function beliefCells(L) {
  const first = onFirstRiver(L), out = [];
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) if (L.g[y][x] === 'L' && !first(x, y)) out.push([x, y]);
  return out;
}

/** Walk a plan on the real map; stop at the first lava cell. */
export function cut(L, plan) {
  const i = plan.findIndex(([x, y]) => L.g[y][x] === 'L');
  return i === -1 ? plan : plan.slice(0, i + 1);
}

export const fellIn = (L, path) => { const e = path[path.length - 1]; return L.g[e[1]][e[0]] === 'L'; };

/** First seed, from `from`, whose layout shows the point well: hollow falls in (for 2-3 rivers). */
export function demoSeed(n, from = 7) {
  for (let s = from; s < from + 600; s++) {
    const L = layoutFromSeed(n, s);
    const one = cut(L, believedPath(L)), many = truePath(L);
    if ((n === 1 || (fellIn(L, one) && one.length > 4)) && many.length > 13) return s;
  }
  return from;
}

export const ORD = ['first', 'second', 'third'];
/** "second", "third": which river a lava cell belongs to, in the order they're crossed. */
export function riverOf(L, [x, y]) {
  const i = L.openings.findIndex((o) => (o.d === 'h' ? x === o.x : y === o.y));
  return i < 0 ? 'next river' : `${ORD[i] || 'next'} river`;
}

/** Pixel centre of a cell, nudged apart per agent. @param {number[]} cell @param {string} who */
export const centre = (cell, who) => {
  const [x, y] = cell;
  const off = who === 'one' ? -5 : 5;
  return [x * C + C / 2 + off, y * C + C / 2 + off];
};
