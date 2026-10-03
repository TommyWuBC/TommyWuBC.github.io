// Draws an application's journey as an orienteering course: start triangle =
// applied, one control per event, a double circle when it ends (offer or
// rejection), and a dashed leg when it goes quiet. Pure string output, so the
// same drawing is used for the static page and the live demo.
import { APPS, SHORT, STATE_LABEL, TERMINAL, day, type EventType, type Ghost, type State } from './engine';

export interface Ctl { type: EventType; date: string; mine?: boolean; email: number }
export interface Lane { app: keyof typeof APPS; ctls: Ctl[]; state: State; quiet?: { days: number; ghost: Ghost } }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LOCK = (x: number, y: number) =>
  `<g class="lock" transform="translate(${x} ${y})"><rect x="-4.5" y="-1" width="9" height="7" rx="1.2"/><path d="M-2.6 -1v-2.2a2.6 2.6 0 0 1 5.2 0V-1"/></g>`;

const QUIET_WORD: Record<Ghost['status'], string> = {
  none: 'quiet, still in window',
  stale: 'stale (inferred)',
  possibly_ghosted: 'possibly ghosted (inferred)',
  paused: 'paused, interview ahead',
  terminal: '',
  dismissed: 'dismissed by you',
};

/** Horizontal lanes, one per application. */
export function drawCourse(lanes: Lane[], o: { width: number; vertical?: boolean; fresh?: Set<string> }) {
  return o.vertical ? vertical(lanes, o) : horizontal(lanes, o);
}

function horizontal(lanes: Lane[], o: { width: number; fresh?: Set<string> }) {
  const W = o.width, laneH = 166, H = laneH * lanes.length + 6;
  let s = '';
  lanes.forEach((lane, li) => {
    const top = li * laneH + 8, cy = top + 96;
    const a = APPS[lane.app];
    const n = lane.ctls.length + (TERMINAL.includes(lane.state) ? 0 : 1);
    const x0 = 44, step = Math.min(118, (W - x0 - 70) / Math.max(1, n));
    const pt = (k: number): [number, number] => [x0 + k * step, cy + (k % 2 ? -14 : 12)];
    s += `<g class="lane" data-app="${lane.app}">`;
    s += `<text class="lane-t" x="14" y="${top + 18}">${esc(a.name)}<tspan class="lane-r" dx="8">${esc(a.role)}, sample</tspan></text>`;
    s += `<text class="lane-s" x="${W - 14}" y="${top + 18}" text-anchor="end">${esc(STATE_LABEL[lane.state])}</text>`;
    const pts = [pt(0), ...lane.ctls.map((_, k) => pt(k + 1))];
    // legs
    for (let k = 0; k < pts.length - 1; k++) s += leg(pts[k], pts[k + 1], k === 0 ? 13 : 15, 15, '', o.fresh?.has(`${lane.app}:${k}`));
    // start: applied
    s += tri(pts[0], pts[1] ?? [pts[0][0] + 10, pts[0][1]], 15);
    s += `<text class="c-lab" x="${pts[0][0]}" y="${pts[0][1] + 34}" text-anchor="middle">Applied</text><text class="c-date" x="${pts[0][0]}" y="${pts[0][1] + 48}" text-anchor="middle">${day(a.applied)}</text>`;
    lane.ctls.forEach((c, k) => {
      const [x, y] = pts[k + 1];
      const fin = k === lane.ctls.length - 1 && TERMINAL.includes(lane.state);
      const above = (k + 1) % 2 === 1;
      const ly = above ? y - 26 : y + 34, dy = above ? y - 40 : y + 48;
      s += `<g class="ctl-g${c.mine ? ' mine' : ''}${o.fresh?.has(`${lane.app}:c${k}`) ? ' fresh' : ''}" data-email="${c.email}">`;
      s += `<circle class="c" cx="${x}" cy="${y}" r="13"/>`;
      if (fin) s += `<circle class="c" cx="${x}" cy="${y}" r="8"/>`;
      else s += `<text class="c-n" x="${x}" y="${y + 4.5}" text-anchor="middle">${k + 1}</text>`;
      s += `<text class="c-lab" x="${x}" y="${above ? dy : ly}" text-anchor="middle">${esc(SHORT[c.type])}</text>`;
      s += `<text class="c-date" x="${x}" y="${above ? ly : dy}" text-anchor="middle">${day(c.date)}${c.mine ? ' · yours' : ''}</text>`;
      if (c.mine) s += LOCK(x + 15, y - 14);
      s += `</g>`;
    });
    if (!TERMINAL.includes(lane.state) && lane.quiet) {
      const from = pts[pts.length - 1];
      const to: [number, number] = [Math.min(W - 40, from[0] + step), cy - 2];
      const g = lane.quiet.ghost;
      s += leg(from, to, 15, 15, 'quiet ' + g.status);
      s += `<circle class="q-c ${g.status}" cx="${to[0]}" cy="${to[1]}" r="13"/><text class="q-mark" x="${to[0]}" y="${to[1] + 5}" text-anchor="middle">?</text>`;
      s += `<text class="q-lab" x="${to[0] + 20}" y="${to[1] - 2}">${lane.quiet.days} days quiet</text>`;
      s += `<text class="q-word ${g.status}" x="${to[0] + 20}" y="${to[1] + 13}">${esc(QUIET_WORD[g.status])}</text>`;
    }
    s += `</g>`;
  });
  return { svg: s, w: W, h: H };
}

function vertical(lanes: Lane[], o: { width: number; fresh?: Set<string> }) {
  const W = o.width;
  let s = '', y0 = 10;
  lanes.forEach((lane) => {
    const a = APPS[lane.app];
    const x = 34, step = 58;
    s += `<g class="lane" data-app="${lane.app}">`;
    s += `<text class="lane-t" x="12" y="${y0 + 16}">${esc(a.name)}</text>`;
    s += `<text class="lane-s" x="${W - 12}" y="${y0 + 16}" text-anchor="end">${esc(STATE_LABEL[lane.state])}</text>`;
    s += `<text class="lane-r" x="12" y="${y0 + 34}">${esc(a.role)}, sample</text>`;
    const top = y0 + 66;
    const pt = (k: number): [number, number] => [x + (k % 2 ? 10 : 0), top + k * step];
    const pts = [pt(0), ...lane.ctls.map((_, k) => pt(k + 1))];
    for (let k = 0; k < pts.length - 1; k++) s += leg(pts[k], pts[k + 1], k === 0 ? 13 : 15, 15, '', o.fresh?.has(`${lane.app}:${k}`));
    s += tri(pts[0], pts[1] ?? [pts[0][0], pts[0][1] + 10], 15);
    s += `<text class="c-lab" x="${x + 30}" y="${pts[0][1] - 1}">Applied</text><text class="c-date" x="${x + 30}" y="${pts[0][1] + 14}">${day(a.applied)}</text>`;
    lane.ctls.forEach((c, k) => {
      const [cx, cy] = pts[k + 1];
      const fin = k === lane.ctls.length - 1 && TERMINAL.includes(lane.state);
      s += `<g class="ctl-g${c.mine ? ' mine' : ''}${o.fresh?.has(`${lane.app}:c${k}`) ? ' fresh' : ''}" data-email="${c.email}">`;
      s += `<circle class="c" cx="${cx}" cy="${cy}" r="13"/>`;
      if (fin) s += `<circle class="c" cx="${cx}" cy="${cy}" r="8"/>`;
      else s += `<text class="c-n" x="${cx}" y="${cy + 4.5}" text-anchor="middle">${k + 1}</text>`;
      s += `<text class="c-lab" x="${x + 40}" y="${cy - 1}">${esc(SHORT[c.type])}</text>`;
      s += `<text class="c-date" x="${x + 40}" y="${cy + 14}">${day(c.date)}${c.mine ? ' · yours' : ''}</text>`;
      if (c.mine) s += LOCK(cx + 15, cy - 14);
      s += `</g>`;
    });
    let end = pts[pts.length - 1][1];
    if (!TERMINAL.includes(lane.state) && lane.quiet) {
      const from = pts[pts.length - 1];
      const to: [number, number] = [x, from[1] + step + 10];
      const g = lane.quiet.ghost;
      s += leg(from, to, 15, 15, 'quiet ' + g.status);
      s += `<circle class="q-c ${g.status}" cx="${to[0]}" cy="${to[1]}" r="13"/><text class="q-mark" x="${to[0]}" y="${to[1] + 5}" text-anchor="middle">?</text>`;
      s += `<text class="q-lab" x="${x + 40}" y="${to[1] - 1}">${lane.quiet.days} days quiet</text>`;
      s += `<text class="q-word ${g.status}" x="${x + 40}" y="${to[1] + 14}">${esc(QUIET_WORD[g.status])}</text>`;
      end = to[1];
    }
    s += `</g>`;
    y0 = end + 40;
  });
  return { svg: s, w: W, h: y0 };
}

function leg(a: [number, number], b: [number, number], r1: number, r2: number, cls: string, fresh?: boolean) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < r1 + r2 + 4) return '';
  const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
  const x1 = a[0] + ux * (r1 + 3), y1 = a[1] + uy * (r1 + 3), x2 = b[0] - ux * (r2 + 3), y2 = b[1] - uy * (r2 + 3);
  return `<line class="leg ${cls}${fresh ? ' fresh' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" pathLength="1"/>`;
}

function tri(p: [number, number], toward: [number, number], R: number) {
  const ang = Math.atan2(toward[1] - p[1], toward[0] - p[0]);
  const pts = [0, 1, 2].map((k) => { const a = ang + k * 2.0944; return `${(p[0] + Math.cos(a) * R).toFixed(1)},${(p[1] + Math.sin(a) * R).toFixed(1)}`; }).join(' ');
  return `<polygon class="st" points="${pts}"/>`;
}
