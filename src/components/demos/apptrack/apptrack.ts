// The apptrack demos share one small store: the inbox classifies emails, the
// course and event log draw what the classifier (or you) decided, the quiet
// slider infers silence, and a reprocess shows that your corrections win.
import {
  INBOX, APPS, LABEL, SHORT, CORRECTABLE, SAMPLE_RULE, STATE_LABEL, TERMINAL,
  classify, reduce, onTimeline, evaluateGhost, thresholdsFor, day,
  type EventType, type Result, type Email, type State, type Ghost,
} from './engine';
import { drawCourse, type Lane } from './course';

declare global { interface Window { __apptrack?: boolean } }

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byId = new Map(INBOX.map((e) => [e.id, e]));

type Row =
  | { kind: 'event'; email: number; type: EventType; by: string }
  | { kind: 'replace'; email: number; from: EventType; type: EventType; by: string }
  | { kind: 'correction'; email: number; from: EventType; type: EventType }
  | { kind: 'revert'; email: number; type: EventType }
  | { kind: 'kept'; email: number; type: EventType; machine: EventType };

const S = {
  results: new Map<number, Result>(),
  corr: new Map<number, EventType>(),
  log: [] as Row[],
  sel: 1,
  llm: false,
  next: false, // reprocessed with the sample rule
  days: 64,
  stage: 'real',
  ahead: false,
  dismissedAt: null as State | null,
  lastRun: null as null | string[],
  animate: 0 as number, // email id whose trace should play
};
const subs: (() => void)[] = [];
const emit = () => subs.forEach((f) => f());

const effective = (id: number): EventType | undefined => S.corr.get(id) ?? S.results.get(id)?.type;
const rules = () => (S.next ? [SAMPLE_RULE] : []);

function by(r: Result) {
  const w = r.winner;
  if (!w) return 'no rule';
  const c = w.conf.toFixed(2);
  if (w.layer === 'L2') return `L2 ${w.detail.split(' ')[0]}${w.detail.startsWith(SAMPLE_RULE.id) ? ' (sample)' : ''}, ${c}`;
  if (w.layer === 'L0') return `L0 headers, ${c}`;
  if (w.detail.includes('template marker')) return `L1 ${w.detail.split(' ')[0]} template, ${c}`;
  if (w.detail.includes('calendar')) return `L1 calendar invite, ${c}`;
  return `L1 subject template, ${c}`;
}

function classifyOne(id: number) {
  const e = byId.get(id)!;
  const r = classify(e, { llm: S.llm, extraRules: rules() });
  const had = S.results.has(id);
  S.results.set(id, r);
  if (!had && e.app && onTimeline(r.type) && !S.corr.has(id)) S.log.push({ kind: 'event', email: id, type: r.type, by: by(r) });
}

function correct(id: number, to: EventType) {
  const from = effective(id);
  if (!from || from === to) return;
  S.corr.set(id, to);
  S.log.push({ kind: 'correction', email: id, from, type: to });
  emit();
}
function undo(id: number) {
  const t = S.corr.get(id);
  if (!t) return;
  S.corr.delete(id);
  S.log.push({ kind: 'revert', email: id, type: t });
  emit();
}

function reprocess() {
  const lines: string[] = [];
  S.next = true;
  for (const e of INBOX) {
    const old = S.results.get(e.id);
    const r = classify(e, { llm: S.llm, extraRules: rules() });
    S.results.set(e.id, r);
    const mine = S.corr.get(e.id);
    if (mine) {
      if (r.type !== mine) {
        S.log.push({ kind: 'kept', email: e.id, type: mine, machine: r.type });
        lines.push(`<b>Email ${e.id}, ${esc(e.subject)}.</b> The classifier now says <i>${LABEL[r.type]}</i>. Your locked correction, <i>${LABEL[mine]}</i>, stays.`);
      }
      continue;
    }
    if (!old) {
      if (e.app && onTimeline(r.type)) S.log.push({ kind: 'event', email: e.id, type: r.type, by: by(r) });
    } else if (old.type !== r.type) {
      if (e.app) S.log.push({ kind: 'replace', email: e.id, from: old.type, type: r.type, by: by(r) });
      lines.push(`<b>Email ${e.id}, ${esc(e.subject)}.</b> ${LABEL[old.type]} becomes <i>${LABEL[r.type]}</i>: a replacement row is appended, the old one stays in the log.`);
    }
  }
  if (!lines.length) lines.push('Same rules, same answers. Nothing was appended.');
  S.lastRun = lines;
  emit();
}

function resetAll() {
  S.results.clear(); S.corr.clear(); S.log = []; S.sel = 1; S.next = false; S.lastRun = null; S.dismissedAt = null; S.animate = 0;
  emit();
}

const appState = (app: 'tern' | 'quarry'): State =>
  reduce(INBOX.filter((e) => e.app === app && S.results.has(e.id)).map((e) => effective(e.id)!).filter(onTimeline));

function quarryGhost(): { state: string; ghost: Ghost } {
  const real = appState('quarry');
  if (S.dismissedAt && S.dismissedAt !== real) S.dismissedAt = null; // suppressed only until the state changes
  const state = S.stage === 'real' ? real : S.stage;
  return {
    state,
    ghost: evaluateGhost({ state, days: S.days, scheduledAhead: S.ahead, dismissed: !!S.dismissedAt, terminal: TERMINAL.includes(real) }),
  };
}

/* ============================== inbox ============================== */
function mountInbox(root: HTMLElement) {
  const mount = root.querySelector<HTMLElement>('[data-mount]')!;
  mount.innerHTML = `
    <div class="ib">
      <div class="ib-left">
        <div class="ib-tools">
          <button type="button" class="at-btn" data-next>Classify next email</button>
          <button type="button" class="at-btn ghost" data-all>Classify the rest</button>
        </div>
        <ol class="ib-list" aria-label="Sample inbox, oldest first"></ol>
        <div class="ib-foot">
          <label class="ib-llm"><input type="checkbox" role="switch" data-llm /><span class="sw" aria-hidden="true"></span><span>LLM fallback <i data-llm-t>off, the default</i></span></label>
          <button type="button" class="at-link" data-reset>Start over</button>
        </div>
      </div>
      <div class="ib-insp" aria-live="polite"></div>
    </div>`;
  const list = mount.querySelector<HTMLOListElement>('.ib-list')!;
  const insp = mount.querySelector<HTMLElement>('.ib-insp')!;
  const nextBtn = mount.querySelector<HTMLButtonElement>('[data-next]')!;
  const allBtn = mount.querySelector<HTMLButtonElement>('[data-all]')!;
  const llm = mount.querySelector<HTMLInputElement>('[data-llm]')!;

  nextBtn.addEventListener('click', () => {
    const e = INBOX.find((x) => !S.results.has(x.id));
    if (!e) return;
    S.sel = e.id; S.animate = e.id;
    classifyOne(e.id); emit();
  });
  allBtn.addEventListener('click', () => {
    INBOX.forEach((e) => { if (!S.results.has(e.id)) classifyOne(e.id); });
    S.animate = 0; emit();
  });
  mount.querySelector('[data-reset]')!.addEventListener('click', resetAll);
  llm.addEventListener('change', () => {
    S.llm = llm.checked;
    mount.querySelector('[data-llm-t]')!.textContent = S.llm ? 'on (hybrid mode)' : 'off, the default';
    // re-run what's been read so the L3 line reflects the mode; results don't change
    for (const id of S.results.keys()) S.results.set(id, classify(byId.get(id)!, { llm: S.llm, extraRules: rules() }));
    emit();
  });
  list.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
    ev.preventDefault();
    const i = INBOX.findIndex((e) => e.id === S.sel);
    const j = k === 'Home' ? 0 : k === 'End' ? INBOX.length - 1 : Math.max(0, Math.min(INBOX.length - 1, i + (k === 'ArrowDown' ? 1 : -1)));
    S.sel = INBOX[j].id; S.animate = 0; emit();
    list.querySelector<HTMLButtonElement>(`[data-id="${S.sel}"]`)?.focus();
  });

  function tag(id: number) {
    const t = effective(id);
    if (!t) return '<span class="at-tag t-unread">Not read yet</span>';
    const mine = S.corr.has(id);
    return `<span class="at-tag t-${t}${mine ? ' mine' : ''}">${mine ? '<svg class="lk" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5"/></svg>' : ''}${LABEL[t]}</span>`;
  }

  function renderList() {
    const focusWasIn = list.contains(document.activeElement);
    list.innerHTML = INBOX.map((e) => `
      <li><button type="button" class="ib-row${S.sel === e.id ? ' on' : ''}${S.results.has(e.id) ? '' : ' unread'}" data-id="${e.id}" aria-pressed="${S.sel === e.id}" tabindex="${S.sel === e.id ? 0 : -1}">
        <span class="ib-r1"><b>${esc(e.fromName)}</b><span>${day(e.date)}</span></span>
        <span class="ib-subj">${esc(e.subject)}</span>
        ${tag(e.id)}
      </button></li>`).join('');
    list.querySelectorAll<HTMLButtonElement>('.ib-row').forEach((b) =>
      b.addEventListener('click', () => { S.sel = +b.dataset.id!; S.animate = 0; emit(); }));
    if (focusWasIn) list.querySelector<HTMLButtonElement>(`[data-id="${S.sel}"]`)?.focus();
    // keep the selected row in view when the list scrolls on its own (narrow screens)
    const row = list.querySelector<HTMLElement>(`[data-id="${S.sel}"]`)?.parentElement;
    if (row && list.scrollHeight > list.clientHeight + 2) {
      if (row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop - 8;
    }
    const left = INBOX.filter((e) => !S.results.has(e.id)).length;
    nextBtn.disabled = allBtn.disabled = left === 0;
    nextBtn.textContent = left === 0 ? 'Inbox read' : left === INBOX.length ? 'Classify the first email' : 'Classify next email';
  }

  function bodyHtml(e: Email, r?: Result) {
    let b = esc(e.body);
    const ev = r?.evidence;
    if (ev && ev.where === 'body') {
      const i = b.toLowerCase().indexOf(esc(ev.needle).toLowerCase());
      if (i >= 0) { const n = esc(ev.needle).length; b = `${b.slice(0, i)}<mark class="ev">${b.slice(i, i + n)}</mark>${b.slice(i + n)}`; }
    }
    return b.split('\n').map((l) => `<span>${l}</span>`).join('');
  }

  function renderInsp() {
    const e = byId.get(S.sel)!;
    const r = S.results.get(e.id);
    const ev = r?.evidence;
    const subj = ev?.where === 'subject'
      ? esc(e.subject).replace(new RegExp(`(${esc(ev.needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<mark class="ev">$1</mark>')
      : esc(e.subject);
    const hdrs = e.headers ? Object.entries(e.headers).map(([k, v]) => `<div class="${ev?.where === 'headers' ? 'evrow' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') : '';
    const mine = S.corr.get(e.id);
    let out = `
      <div class="mail">
        <p class="mail-k">Email ${e.id} of ${INBOX.length}${e.app ? `, ${APPS[e.app].name}` : ''}</p>
        <dl class="mail-h">
          <div><dt>From</dt><dd>${esc(e.fromName)} <span>&lt;${esc(e.from)}&gt;</span></dd></div>
          <div><dt>Subject</dt><dd>${subj}</dd></div>
          <div><dt>Date</dt><dd>${day(e.date)}, 2026</dd></div>
          ${hdrs}
        </dl>
        <p class="mail-b${r?.steps[0]?.tone === 'stop' && r.type === 'newsletter_ignore' ? ' unfetched' : ''}">${bodyHtml(e, r)}</p>
        ${e.calendar ? `<p class="mail-cal${ev?.where === 'calendar' ? ' evrow' : ''}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>Calendar invite: ${esc(e.calendar.summary)}, ${esc(e.calendar.start.replace('T', ' at '))}</p>` : ''}
      </div>`;
    if (!r) {
      out += `<div class="verdict pending"><p>Not classified yet.</p><button type="button" class="at-btn" data-this>Classify this email</button></div>`;
    } else {
      out += `<ol class="trace">${r.steps.map((s, i) => `
        <li class="tr tone-${s.tone}" style="--i:${i}">
          <span class="tr-c">${s.layer === 'Guard' ? 'G' : s.layer}</span>
          <span class="tr-t"><b>${s.name}</b> ${esc(s.outcome)}${s.candidates ? `<span class="tr-cands">${s.candidates.map((c) => `<span class="cand${c === r.winner ? ' win' : ''}">${LABEL[c.type]} <b>${c.conf.toFixed(2)}</b><i>${esc(c.detail)}</i></span>`).join('')}</span>` : ''}</span>
        </li>`).join('')}</ol>`;
      const t = mine ?? r.type;
      out += `<div class="verdict" style="--i:${r.steps.length}">
        <span class="v-ring" aria-hidden="true"></span>
        <p class="v-type">${LABEL[t]}</p>
        <p class="v-meta">${mine ? `Your correction, locked. The classifier said ${LABEL[r.type]} (${r.conf.toFixed(2)}).` : `Confidence ${r.conf.toFixed(2)}${r.needsReview ? '. Below 0.6 or unknown, so it goes to the review queue.' : ''}`}</p>
        ${mine ? '' : `<span class="v-meter" aria-hidden="true"><i style="width:${Math.round(r.conf * 100)}%"></i><b class="m60" title="review below 0.6"></b><b class="m75" title="L3 below 0.75"></b></span>`}
      </div>`;
      if (e.app) {
        out += mine
          ? `<div class="fix locked"><p><svg class="lk" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5"/></svg>Locked. Automation won't overwrite it, even on a reprocess.</p><button type="button" class="at-link" data-undo>Undo my correction</button></div>`
          : `<div class="fix"><label><span>Wrong? Correct it:</span>
              <select data-fix>${CORRECTABLE.filter((c) => c !== r.type).map((c) => `<option value="${c}">${LABEL[c]}</option>`).join('')}</select></label>
              <button type="button" class="at-btn ghost" data-lock>Save and lock</button></div>`;
      } else {
        out += `<p class="fix none">Not matched to any application, so there's nothing to correct. It waits in the review queue.</p>`;
      }
    }
    insp.innerHTML = out;
    insp.querySelector('[data-this]')?.addEventListener('click', () => { S.animate = e.id; classifyOne(e.id); emit(); });
    insp.querySelector('[data-lock]')?.addEventListener('click', () => {
      const v = insp.querySelector<HTMLSelectElement>('[data-fix]')!.value as EventType;
      correct(e.id, v);
      insp.querySelector<HTMLElement>('[data-undo]')?.focus();
    });
    insp.querySelector('[data-undo]')?.addEventListener('click', () => undo(e.id));
    if (S.animate === e.id && !reduceMotion()) {
      insp.classList.remove('play'); void insp.offsetWidth; insp.classList.add('play');
    } else insp.classList.remove('play');
    S.animate = 0;
  }
  subs.push(renderList, renderInsp);
}

/* ============================== course + log ============================== */
function mountCourse(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-course-svg]')!;
  const g = root.querySelector<SVGGElement>('[data-course-g]')!;
  const hint = root.querySelector<HTMLElement>('[data-course-hint]')!;
  const desc = root.querySelector<HTMLElement>('[data-course-desc]')!;
  const tbody = root.querySelector<HTMLElement>('[data-log]')!;
  const prev: Record<string, number> = { tern: 0, quarry: 0 };
  let prevLog = 0;
  let lastW = 0;

  function lanes(): Lane[] {
    return (['tern', 'quarry'] as const).map((app) => {
      const ctls = INBOX.filter((e) => e.app === app && S.results.has(e.id))
        .map((e) => ({ type: effective(e.id)!, date: e.date, email: e.id, mine: S.corr.has(e.id) }))
        .filter((c) => onTimeline(c.type));
      const state = reduce(ctls.map((c) => c.type));
      const lane: Lane = { app, ctls, state };
      if (app === 'quarry') lane.quiet = { days: S.days, ghost: quarryGhost().ghost };
      return lane;
    });
  }

  function render() {
    const L = lanes();
    const fresh = new Set<string>();
    L.forEach((l) => {
      for (let k = prev[l.app]; k < l.ctls.length; k++) { fresh.add(`${l.app}:c${k}`); fresh.add(`${l.app}:${k}`); }
      prev[l.app] = l.ctls.length;
    });
    const w = svg.parentElement!.clientWidth || 720;
    lastW = w;
    const vertical = w < 560;
    const d = drawCourse(L, { width: vertical ? w : 720, vertical, fresh: reduceMotion() ? undefined : fresh });
    svg.setAttribute('viewBox', `0 0 ${d.w} ${d.h}`);
    svg.classList.toggle('vertical', vertical);
    g.innerHTML = d.svg;
    g.querySelectorAll<SVGGElement>('.ctl-g').forEach((c) => {
      c.setAttribute('tabindex', '0'); c.setAttribute('role', 'button');
      const id = +c.dataset.email!;
      c.setAttribute('aria-label', `Open email ${id}, ${byId.get(id)!.subject}`);
      const open = () => {
        S.sel = id; emit();
        document.querySelector('[data-at-inbox]')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
      };
      c.addEventListener('click', open);
      c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
    });
    const read = S.results.size;
    hint.textContent = read === 0
      ? 'Classify the inbox above and the controls appear as each event lands.'
      : `${read} of ${INBOX.length} emails read. Select a control to open its email.`;
    desc.textContent = L.map((l) => `${APPS[l.app].name}: applied${l.ctls.map((c) => ', ' + LABEL[c.type]).join('')}. Now ${STATE_LABEL[l.state]}.${l.quiet && !TERMINAL.includes(l.state) ? ` Quiet for ${l.quiet.days} days: ${l.quiet.ghost.status.replace('_', ' ')}, an inference.` : ''}`).join(' ');

    // the log, append-only
    const rows = S.log.map((r, i) => {
      const e = byId.get(r.email)!;
      const app = e.app ? APPS[e.app].name.split(' ')[0] : 'None';
      const when = r.kind === 'event' || r.kind === 'replace' ? day(e.date) : 'now';
      let ev = '', who = '';
      if (r.kind === 'event') { ev = LABEL[r.type]; who = r.by; }
      if (r.kind === 'replace') { ev = `Replaces ${LABEL[r.from]}: ${LABEL[r.type]}`; who = r.by; }
      if (r.kind === 'correction') { ev = `Correction: ${SHORT[r.from]} to ${LABEL[r.type]}, locked`; who = 'you'; }
      if (r.kind === 'revert') { ev = `Correction to ${LABEL[r.type]} reverted`; who = 'you'; }
      if (r.kind === 'kept') { ev = `Reprocess said ${LABEL[r.machine]}; locked value kept`; who = 'rules + R-CHECKIN-1'; }
      return `<tr class="${i >= prevLog ? 'new' : ''} k-${r.kind}"><td>${i + 1}</td><td>${when}</td><td>${app}</td><td>${esc(ev)}</td><td>${esc(who)}</td></tr>`;
    });
    tbody.innerHTML = rows.length ? rows.join('') : `<tr class="empty"><td colspan="5">No events yet. The log fills as emails are classified.</td></tr>`;
    if (S.log.length > prevLog) { const sc = tbody.closest('.at-log-scroll')!; sc.scrollTop = sc.scrollHeight; }
    prevLog = S.log.length;
  }
  subs.push(render);
  new ResizeObserver(() => { const w = svg.parentElement!.clientWidth; if (Math.abs(w - lastW) > 4 && (w < 560) !== (lastW < 560)) render(); }).observe(svg.parentElement!);
}

/* ============================== quiet ============================== */
function mountQuiet(root: HTMLElement) {
  const days = root.querySelector<HTMLInputElement>('[data-q-days]')!;
  const daysOut = root.querySelector<HTMLOutputElement>('[data-q-days-out]')!;
  const ahead = root.querySelector<HTMLInputElement>('[data-q-ahead]')!;
  const status = root.querySelector<HTMLElement>('[data-q-status]')!;
  const why = root.querySelector<HTMLElement>('[data-q-why]')!;
  const evid = root.querySelector<HTMLElement>('[data-q-ev]')!;
  const ticks = root.querySelector<SVGGElement>('[data-q-ticks]')!;
  const walked = root.querySelector<SVGLineElement>('[data-q-walked]')!;
  const runner = root.querySelector<SVGGElement>('[data-q-runner]')!;
  const dismiss = root.querySelector<HTMLButtonElement>('[data-q-dismiss]')!;
  const realName = root.querySelector<HTMLElement>('[data-q-stage-name]')!;
  const realT = root.querySelector<HTMLElement>('[data-q-stage-t]')!;
  const X = (d: number) => 10 + (Math.min(120, d) / 120) * 380;

  days.addEventListener('input', () => { S.days = +days.value; emit(); });
  ahead.addEventListener('change', () => { S.ahead = ahead.checked; emit(); });
  root.querySelectorAll<HTMLInputElement>('[data-q-stage]').forEach((r) => r.addEventListener('change', () => { if (r.checked) { S.stage = r.value; emit(); } }));
  dismiss.addEventListener('click', () => {
    if (S.dismissedAt) S.dismissedAt = null;
    else S.dismissedAt = appState('quarry');
    emit();
  });

  const WORD: Record<Ghost['status'], string> = { none: 'Still in the window', stale: 'Stale', possibly_ghosted: 'Possibly ghosted', paused: 'Paused', dismissed: 'Dismissed', terminal: 'Finished' };
  const WHY: Record<Ghost['status'], string> = {
    none: 'Nothing flagged. Any meaningful email resets the timer.',
    stale: "Marked stale. The application's state doesn't change; it's a note that things are slow.",
    possibly_ghosted: 'Flagged as possibly ghosted, labelled as a guess, with an item in the review queue. One click dismisses it.',
    paused: 'Paused. Something is scheduled ahead, so the silence means nothing yet.',
    dismissed: "Dismissed. It stays quiet until the application's state changes.",
    terminal: 'The application has ended, so the ghost timer is off.',
  };

  function render() {
    const real = appState('quarry');
    const rt = thresholdsFor(real);
    realName.textContent = `Its real stage: ${STATE_LABEL[real]}`;
    realT.textContent = `stale ${rt.stale}, ghost ${rt.ghost}`;
    const { state, ghost } = quarryGhost();
    const t = thresholdsFor(state);
    daysOut.textContent = `${S.days} day${S.days === 1 ? '' : 's'}`;
    status.textContent = WORD[ghost.status];
    status.dataset.s = ghost.status;
    why.textContent = WHY[ghost.status];
    evid.textContent = ghost.evidence;
    dismiss.textContent = S.dismissedAt ? 'Undo dismiss' : 'Dismiss';
    dismiss.disabled = !S.dismissedAt && (ghost.status === 'none' || ghost.status === 'paused' || ghost.status === 'terminal');
    ticks.innerHTML = [
      [t.stale, `stale ${t.stale}`], [t.ghost, `ghost ${t.ghost}`],
    ].map(([d, l]) => `<line class="q-tick" x1="${X(+d)}" y1="30" x2="${X(+d)}" y2="50"/><text class="q-tl" x="${X(+d)}" y="20" text-anchor="middle">${l} days</text>`).join('')
      + `<text class="q-tl end" x="10" y="68">last email</text><text class="q-tl end" x="390" y="68" text-anchor="end">120 days</text>`;
    walked.setAttribute('x2', String(X(S.days)));
    runner.setAttribute('transform', `translate(${X(S.days)} 40)`);
    runner.classList.toggle('paused', ghost.status === 'paused');
    root.dataset.s = ghost.status;
  }
  subs.push(render);
}

/* ============================== reprocess ============================== */
function mountRepro(root: HTMLElement) {
  const mine = root.querySelector<HTMLElement>('[data-r-mine]')!;
  const run = root.querySelector<HTMLButtonElement>('[data-r-run]')!;
  const ver = root.querySelector<HTMLElement>('[data-r-ver]')!;
  const out = root.querySelector<HTMLElement>('[data-r-out]')!;
  run.addEventListener('click', reprocess);

  function render() {
    const list = [...S.corr.entries()];
    if (!list.length) {
      mine.innerHTML = `<p class="r-none">You haven't corrected anything yet. Email 8, <q>Checking in</q>, matched no rule. Tell apptrack what it is:</p>
        <p class="r-quick"><button type="button" class="at-btn ghost" data-q="recruiter_outreach">Recruiter reached out</button><button type="button" class="at-btn ghost" data-q="followup_request">Follow-up request</button></p>`;
      mine.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.addEventListener('click', () => {
        if (!S.results.has(8)) classifyOne(8);
        correct(8, b.dataset.q as EventType);
      }));
    } else {
      mine.innerHTML = `<ul class="r-list">${list.map(([id, t]) => `<li><svg class="lk" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5"/></svg><span>Email ${id}, <q>${esc(byId.get(id)!.subject)}</q>: you said <b>${LABEL[t]}</b>.</span><button type="button" class="at-link" data-u="${id}">Undo</button></li>`).join('')}</ul>`;
      mine.querySelectorAll<HTMLButtonElement>('[data-u]').forEach((b) => b.addEventListener('click', () => undo(+b.dataset.u!)));
    }
    ver.textContent = S.next ? 'Rules: rules-2026.07.0 plus R-CHECKIN-1 (sample)' : 'Rules: rules-2026.07.0';
    run.textContent = S.next ? 'Reprocess again' : 'Reprocess the inbox';
    out.innerHTML = S.lastRun ? S.lastRun.map((l) => `<li>${l}</li>`).join('') : '';
  }
  subs.push(render);
}

function init() {
  const inbox = document.querySelector<HTMLElement>('[data-at-inbox]');
  const course = document.querySelector<HTMLElement>('[data-at-course]');
  const quiet = document.querySelector<HTMLElement>('[data-at-quiet]');
  const repro = document.querySelector<HTMLElement>('[data-at-repro]');
  if (inbox) mountInbox(inbox);
  if (course) mountCourse(course);
  if (quiet) mountQuiet(quiet);
  if (repro) mountRepro(repro);
  emit();
}

if (!window.__apptrack) { window.__apptrack = true; init(); }
