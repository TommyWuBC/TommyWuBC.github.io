// The toolbox as data: every tool from src/data/site.ts plus every stack item on
// projects and jobs, which projects and jobs used it, a logo, and a place on the
// map. Runs at build time; the page ships the result as markup and JSON.
import * as si from 'simple-icons';
import { skills } from '../../data/site';
import { mulberry32 } from '../shells/map-shell.terrain';

export type Cat = 'lang' | 'ml' | 'web' | 'infra' | 'met';
export const MAP_W = 1200, MAP_H = 820;

export const REGIONS: Record<Cat, { name: string; terrain: string; cx: number; cy: number; rx: number; ry: number }> = {
  lang: { name: 'Languages', terrain: 'the lake', cx: 235, cy: 240, rx: 190, ry: 165 },
  ml: { name: 'Machine learning', terrain: 'the forest', cx: 615, cy: 200, rx: 235, ry: 150 },
  web: { name: 'Web', terrain: 'open land', cx: 610, cy: 650, rx: 215, ry: 130 },
  infra: { name: 'Infrastructure and data', terrain: 'the hill', cx: 1000, cy: 420, rx: 175, ry: 330 },
  met: { name: 'Met on projects', terrain: 'the marsh', cx: 240, cy: 640, rx: 205, ry: 150 },
};
const CAT_OF_LABEL: Record<string, Cat> = { Programming: 'lang', 'Machine learning': 'ml', Web: 'web', 'Infrastructure and data': 'infra' };

/** Toolbox wording -> the name used on the map. */
const RENAME: Record<string, string> = { 'reinforcement learning (PPO)': 'RL (PPO)', 'vision-language models': 'VLMs' };
/** Stack wording on projects -> a toolbox tool. */
const ALIAS: Record<string, string> = { 'SQLite FTS5': 'SQLite' };
/**
 * Uses that the stacks imply but don't list, each with the reason (all from
 * the content or the public repos): shown as "implied" on the card.
 */
const IMPLIED: Record<string, [string, string][]> = {
  'visual-navigation': [['RL (PPO)', 'PPO baselines with Stable-Baselines3'], ['VLMs', 'GPT-4o-mini as a zero-shot VLM']],
  'pair-lab': [['RL (PPO)', 'domain-randomized PPO'], ['VLMs', 'classified VLM reasoning steps']],
  'saite-robotics': [['RAG', 'RAG over maintenance guidance']],
  'fault-diagnosis': [['RAG', 'RAG over maintenance guidance'], ['SQL', 'PostgreSQL']],
  csearch: [['Hugging Face', 'embedding model downloaded from Hugging Face'], ['SQL', 'SQLite FTS5 queries']],
  apptrack: [['SQL', 'PostgreSQL'], ['Docker', 'Docker Compose self-hosting'], ['Playwright', 'Playwright smoke tests']],
  buzzboard: [['React', 'Next.js'], ['Vercel', 'deployed on Vercel']],
  'centennial-web': [['React', 'Next.js']],
};

const ICON: Record<string, string> = {
  Python: 'siPython', Java: 'siOpenjdk', TypeScript: 'siTypescript', JavaScript: 'siJavascript', C: 'siC', 'C++': 'siCplusplus',
  PyTorch: 'siPytorch', 'Hugging Face': 'siHuggingface', LangChain: 'siLangchain', LangGraph: 'siLanggraph',
  'Next.js': 'siNextdotjs', React: 'siReact', Express: 'siExpress', FastAPI: 'siFastapi', Streamlit: 'siStreamlit',
  Git: 'siGit', Docker: 'siDocker', Linux: 'siLinux', ROS: 'siRos', PostgreSQL: 'siPostgresql', SQLite: 'siSqlite',
  Firebase: 'siFirebase', Vercel: 'siVercel', Cloudflare: 'siCloudflare', Fastify: 'siFastify', Django: 'siDjango',
  ElevenLabs: 'siElevenlabs', Claude: 'siClaude',
};
const MONO: Record<string, string> = {
  SQL: 'SQL', 'Stable-Baselines3': 'SB3', 'RL (PPO)': 'PPO', VLMs: 'VLM', RAG: 'RAG', Playwright: 'Pw', AWS: 'AWS', Chroma: 'Ch',
  MiniGrid: 'MG', 'GPT-4o-mini': '4o', 'tree-sitter': 'ts', 'sqlite-vec': 'vec', 'Sentence Transformers': 'ST', WebGazer: 'WG',
  'pg-boss': 'pgb', SwiftUI: 'SUI', MVVM: 'MV', pygame: 'pg',
};

export interface Use { kind: 'project' | 'job'; id: string; title: string; href: string; why?: string }
export interface Tool {
  id: string; name: string; cat: Cat;
  icon?: { path: string; hex: string; title: string };
  mono?: string;
  uses: Use[];
  x: number; y: number;
  lab: { x: number; y: number; anchor: 'start' | 'end' | 'middle' };
}
export interface Spot { kind: 'project' | 'job'; id: string; title: string; short: string; href: string; tools: string[]; x: number; y: number; lab: Tool['lab']; archive: boolean }

export const slug = (s: string) => s.toLowerCase().replace(/\+\+/g, 'pp').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface ProjectIn { id: string; title: string; stack: string[]; expansion?: string; tier: string }
interface JobIn { id: string; org: string; role: string; stack: string[] }

export function buildMap(projects: ProjectIn[], jobs: JobIn[]) {
  const tools = new Map<string, Tool>();
  const add = (name: string, cat: Cat) => {
    if (tools.has(name)) return tools.get(name)!;
    const key = ICON[name] as keyof typeof si | undefined;
    const ic = key ? (si[key] as { path: string; hex: string; title: string } | undefined) : undefined;
    const t: Tool = { id: slug(name), name, cat, icon: ic ? { path: ic.path, hex: ic.hex, title: ic.title } : undefined, mono: ic ? undefined : MONO[name] ?? name.slice(0, 2), uses: [], x: 0, y: 0, lab: { x: 0, y: 0, anchor: 'start' } };
    tools.set(name, t);
    return t;
  };
  for (const s of skills) {
    const cat = CAT_OF_LABEL[s.label] ?? 'infra';
    s.items.replace(/\.$/, '').split(/[,.]\s+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean)
      .forEach((n) => add(RENAME[n] ?? n, cat));
  }

  const spots: Spot[] = [];
  const shortTitle = (t: string) => t.replace(/ under .*/, '').replace(/ platform$/, '').replace(/^Fault-diagnosis/, 'Fault diagnosis');
  const use = (name: string, u: Use) => {
    const t = tools.get(ALIAS[name] ?? name) ?? add(ALIAS[name] ?? name, 'met');
    if (!t.uses.some((x) => x.id === u.id)) t.uses.push(u);
    return t.name;
  };
  for (const p of projects) {
    const href = p.expansion ? `/work/${p.id}/` : p.tier === 'archive' ? '/#archive' : `/#${p.id}`;
    const u: Use = { kind: 'project', id: p.id, title: p.title, href };
    const names = p.stack.map((n) => use(n, u));
    for (const [n, why] of IMPLIED[p.id] ?? []) names.push(use(n, { ...u, why }));
    spots.push({ kind: 'project', id: p.id, title: p.title, short: shortTitle(p.title), href, tools: [...new Set(names)], x: 0, y: 0, lab: { x: 0, y: 0, anchor: 'start' }, archive: p.tier === 'archive' });
  }
  for (const j of jobs) {
    const org = j.org.split(',')[0].replace(/^Stanford /, '');
    const u: Use = { kind: 'job', id: j.id, title: `${j.role}, ${org}`, href: `/#${j.id}` };
    const names = j.stack.map((n) => use(n, u));
    for (const [n, why] of IMPLIED[j.id] ?? []) names.push(use(n, { ...u, why }));
    spots.push({ kind: 'job', id: j.id, title: `${j.role}, ${j.org.split(',')[0]}`, short: org, href: `/#${j.id}`, tools: [...new Set(names)], x: 0, y: 0, lab: { x: 0, y: 0, anchor: 'start' }, archive: false });
  }

  layout([...tools.values()], spots);
  return { tools: [...tools.values()], spots };
}

/* ------------------------------ layout ------------------------------ */
const textW = (s: string, size = 12.5) => s.length * size * 0.56 + 6;
type Box = { x0: number; y0: number; x1: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function layout(tools: Tool[], spots: Spot[]) {
  const R = 17, MIN = 66;
  // homes: a sunflower inside each region
  const byCat = new Map<Cat, Tool[]>();
  tools.forEach((t) => byCat.set(t.cat, [...(byCat.get(t.cat) ?? []), t]));
  const home = new Map<Tool, [number, number]>();
  for (const [cat, list] of byCat) {
    const g = REGIONS[cat];
    list.sort((a, b) => b.uses.length - a.uses.length);
    list.forEach((t, i) => {
      const r = Math.sqrt((i + 0.6) / list.length) * 0.8, th = i * 2.39996 + (cat.length * 0.7);
      const p: [number, number] = [g.cx + Math.cos(th) * g.rx * r, g.cy + Math.sin(th) * g.ry * r];
      home.set(t, p); t.x = p[0]; t.y = p[1];
    });
  }
  // project and job flags settle between the tools they used
  const byName = new Map(tools.map((t) => [t.name, t]));
  for (const s of spots) {
    const ts = s.tools.map((n) => byName.get(n)!).filter(Boolean);
    s.x = ts.reduce((a, t) => a + t.x, 0) / Math.max(1, ts.length) || MAP_W / 2;
    s.y = ts.reduce((a, t) => a + t.y, 0) / Math.max(1, ts.length) || MAP_H / 2;
  }
  // relax: everything repels, tools are pulled home, all stay on the sheet
  const all = [...tools, ...spots];
  const rnd = mulberry32(7);
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const min = 'kind' in a || 'kind' in b ? MIN + 10 : MIN;
        if (d < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d = 0.5; }
        if (d < min) {
          const push = ((min - d) / d) * 0.5;
          a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
        }
      }
    for (const t of tools) { const h = home.get(t)!; t.x += (h[0] - t.x) * 0.04; t.y += (h[1] - t.y) * 0.04; }
    for (const p of all) { p.x = Math.max(60, Math.min(MAP_W - 60, p.x)); p.y = Math.max(78, Math.min(MAP_H - 50, p.y)); }
  }
  // labels: east, west, south, north, first one that doesn't collide
  const boxes: Box[] = all.map((p) => ({ x0: p.x - R - 2, y0: p.y - R - 2, x1: p.x + R + 2, y1: p.y + R + 2 }));
  // region names
  boxes.push({ x0: 120, y0: 40, x1: 350, y1: 72 }, { x0: 470, y0: 20, x1: 760, y1: 56 }, { x0: 840, y0: 46, x1: 1160, y1: 82 }, { x0: 480, y0: 780, x1: 740, y1: 820 }, { x0: 100, y0: 780, x1: 380, y1: 820 });
  const place = (p: { x: number; y: number; lab: Tool['lab'] }, text: string, size: number) => {
    const w = textW(text, size), h = size + 4;
    const opts: [number, number, Tool['lab']['anchor'], Box][] = [
      [p.x + R + 6, p.y + size * 0.36, 'start', { x0: p.x + R + 4, y0: p.y - h / 2, x1: p.x + R + 6 + w, y1: p.y + h / 2 }],
      [p.x - R - 6, p.y + size * 0.36, 'end', { x0: p.x - R - 6 - w, y0: p.y - h / 2, x1: p.x - R - 4, y1: p.y + h / 2 }],
      [p.x, p.y + R + size + 2, 'middle', { x0: p.x - w / 2, y0: p.y + R + 2, x1: p.x + w / 2, y1: p.y + R + 4 + h }],
      [p.x, p.y - R - 6, 'middle', { x0: p.x - w / 2, y0: p.y - R - 6 - h, x1: p.x + w / 2, y1: p.y - R - 4 }],
    ];
    const inside = (b: Box) => b.x0 > 4 && b.x1 < MAP_W - 4 && b.y0 > 4 && b.y1 < MAP_H - 4;
    const ok = opts.find(([, , , b]) => inside(b) && !boxes.some((o) => hit(o, b))) ?? opts.find(([, , , b]) => inside(b)) ?? opts[0];
    p.lab = { x: ok[0], y: ok[1], anchor: ok[2] };
    boxes.push(ok[3]);
  };
  [...spots].forEach((s) => place(s, s.short, 13));
  [...tools].sort((a, b) => b.uses.length - a.uses.length).forEach((t) => place(t, t.name, 12.5));
}
