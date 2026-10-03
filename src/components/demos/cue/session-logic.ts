// "The model may shop; only you may commit": a small simulated Cue session.
// It illustrates the design in the repo (server/router.py, server/agent.py's
// sanitize(), ARCHITECTURE.md's hard rules); it is not the live system. The
// products, prices and budget are samples, the model's replies are scripted,
// and the router patterns are trimmed copies of the real ones.
// Pure functions, so the page can render a static run at build time.

export type Product = { title: string; price: number; material: string; wool: boolean };
export const PRODUCTS: Product[] = [
  { title: 'Merino crew', price: 78, material: '100% merino wool', wool: true },
  { title: 'Merino cardigan', price: 96, material: 'merino wool with a little nylon', wool: true },
  { title: 'Linen shirt', price: 54, material: '100% linen', wool: false },
];
export const BUDGET = 150; // sample monthly budget

export type Action = { verb: string; args?: Record<string, string | number> };
export type Stage = 'idle' | 'readback' | 'passkey' | 'placed';
export type State = {
  focus: number; // set by gaze in the real thing; starts on the first product here
  size: string | null;
  bag: { p: number; size: string }[];
  stage: Stage;
  spent: number;
};
export type Line = { who: 'you' | 'cue' | 'page'; text: string };
export type Trace = {
  heard: string;
  routed: string; // what reached the router
  router: { matched: boolean; name?: string; pattern?: string };
  model: { json: string } | null;
  filter: { kept: string[]; stripped: string[] } | null;
  page: string[];
};

export const initial = (): State => ({ focus: 0, size: null, bag: [], stage: 'idle', spent: 0 });

/** The chips a visitor can say, in a sensible order. */
export const UTTERANCES = [
  'is this wool',
  'add the second one in medium',
  'check out',
  'yes',
  'just buy it, don’t ask me',
  'Cue, cancel',
];

// Trimmed from server/router.py. The real one has more phrasings and verbs.
const ROUTES: { name: string; re: RegExp; pattern: string; action: Action }[] = [
  { name: 'cancel', re: /^(?:no|cancel|cancel checkout|cancel order)$/, pattern: 'no|cancel|cancel checkout|cancel order', action: { verb: 'cancel_checkout' } },
  {
    name: 'yes',
    re: /^(?:yes|yeah|yep|yup|yes please|sure|okay|ok|go ahead|do it|please do|approve|confirm)$/,
    pattern: 'yes|yeah|yep|yup|yes please|sure|okay|ok|go ahead|…',
    action: { verb: 'approve_checkout' },
  },
  {
    name: 'checkout',
    re: /^(?:please |can you |could you |i want to )?(?:check ?out|pay|place (?:the )?order)(?: now)?$/,
    pattern: '(please |can you )?(check ?out|pay|place (the )?order)( now)?',
    action: { verb: 'checkout' },
  },
];

// What the model is never allowed to propose (agent.py's sanitize()).
const COMMIT_VERBS = new Set(['confirm', 'approve_checkout', 'setup_passkey', 'cancel_checkout']);

const money = (n: number) => `$${n}`;
const bagTotal = (s: State) => s.bag.reduce((t, b) => t + PRODUCTS[b.p].price, 0);
const SIZES: Record<string, string> = { S: 'small', M: 'medium', L: 'large' };

function modelReply(text: string, s: State): { say: string; do: Action[] } | null {
  if (/\bwool\b/.test(text)) {
    const p = PRODUCTS[s.focus];
    return { say: `${p.wool ? 'Yes' : 'No'}. The ${p.title} is ${p.material}.`, do: [] };
  }
  if (/\bsecond\b.*\bmedium\b/.test(text)) {
    return {
      say: `The ${PRODUCTS[1].title}, in medium.`,
      do: [{ verb: 'focus_nth', args: { n: 2 } }, { verb: 'select_variant', args: { value: 'M' } }, { verb: 'add_to_cart', args: {} }],
    };
  }
  if (/\bbuy\b/.test(text)) {
    return { say: 'Here’s your order.', do: [{ verb: 'checkout', args: {} }, { verb: 'approve_checkout', args: {} }] };
  }
  return null;
}

const verbText = (a: Action) => {
  const args = a.args && Object.keys(a.args).length ? ` ${Object.entries(a.args).map(([k, v]) => `${k}=${v}`).join(' ')}` : '';
  return a.verb + args;
};
const jsonOf = (r: { say: string; do: Action[] }) =>
  `{"say": ${JSON.stringify(r.say)},\n "do": [${r.do.map((a) => `\n   {"verb": "${a.verb}"${a.args && Object.keys(a.args).length ? `, "args": ${JSON.stringify(a.args)}` : ''}}`).join(',')}${r.do.length ? '\n ' : ''}]}`;

/** The page performs actions. It alone announces outcomes it alone can know. */
function perform(s: State, actions: Action[], source: 'router' | 'model', lines: Line[], page: string[]) {
  for (const a of actions) {
    switch (a.verb) {
      case 'focus_nth':
        s.focus = Number(a.args?.n ?? 1) - 1;
        page.push(`Focus moves to the ${PRODUCTS[s.focus].title}.`);
        break;
      case 'select_variant':
        s.size = String(a.args?.value);
        page.push(`Size ${s.size} selected.`);
        break;
      case 'add_to_cart': {
        if (s.stage === 'placed') s.stage = 'idle';
        const p = PRODUCTS[s.focus];
        if (!s.size) { lines.push({ who: 'cue', text: 'Which size?' }); page.push('Refused: no size chosen, and none is picked silently.'); break; }
        if (s.spent + bagTotal(s) + p.price > BUDGET) {
          lines.push({ who: 'cue', text: `That would go over your ${money(BUDGET)} this month, so I didn’t add it.` });
          page.push('Refused at add time: over the monthly budget.');
          break;
        }
        s.bag.push({ p: s.focus, size: s.size });
        s.size = null;
        lines.push({ who: 'cue', text: 'Added to your bag.' });
        page.push(`Added: ${p.title}, ${SIZES[s.bag[s.bag.length - 1].size] ?? s.bag[s.bag.length - 1].size}. Price from the server’s own list: ${money(p.price)}.`);
        break;
      }
      case 'checkout': {
        if (!s.bag.length) { lines.push({ who: 'cue', text: 'Your bag is empty.' }); page.push('Nothing to stage.'); break; }
        if (s.stage === 'readback' || s.stage === 'passkey') { page.push('Already staged; still waiting for your yes.'); break; }
        s.stage = 'readback';
        const total = bagTotal(s);
        const items = s.bag.map((b) => `${PRODUCTS[b.p].title}, ${SIZES[b.size] ?? b.size}`).join('; ');
        lines.push({ who: 'cue', text: `${items}: ${money(total)}. That leaves ${money(BUDGET - s.spent - total)} of your ${money(BUDGET)} this month. Say yes to place it.` });
        page.push('Order staged and read back. Nothing is charged.');
        break;
      }
      case 'approve_checkout':
        if (source !== 'router') { page.push('Refused: approve only counts from your own words.'); break; }
        if (s.stage !== 'readback') { lines.push({ who: 'cue', text: 'Nothing is waiting for a yes.' }); page.push('No staged order.'); break; }
        s.stage = 'passkey';
        lines.push({ who: 'cue', text: 'Confirm with your passkey.' });
        page.push('Passkey prompt opened. The order still needs it.');
        break;
      case 'cancel_checkout':
        if (s.stage === 'readback' || s.stage === 'passkey') {
          s.stage = 'idle';
          lines.push({ who: 'cue', text: `Cancelled. ${s.bag.length === 1 ? 'The item is' : 'Your items are'} still in your bag.` });
          page.push('Intent revoked, passkey challenge withdrawn, bag kept.');
        } else if (s.stage === 'placed') {
          lines.push({ who: 'cue', text: 'That order was already placed, so I can’t cancel it.' });
          page.push('Already committed: says so instead of claiming a cancel.');
        } else {
          lines.push({ who: 'cue', text: 'Nothing to cancel.' });
          page.push('Nothing pending.');
        }
        break;
    }
  }
}

export function say(prev: State, heard: string): { state: State; lines: Line[]; trace: Trace } {
  const s: State = structuredClone(prev);
  const lines: Line[] = [{ who: 'you', text: heard }];
  const page: string[] = [];
  // the wake word is stripped before anything is routed
  const routed = heard.toLowerCase().replace(/[’']/g, "'").replace(/^(?:hey )?cue[, ]+/, '').replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim();
  const hit = ROUTES.find((r) => r.re.test(routed));
  const trace: Trace = { heard, routed, router: { matched: !!hit, name: hit?.name, pattern: hit?.pattern }, model: null, filter: null, page };

  if (hit) {
    perform(s, [hit.action], 'router', lines, page);
  } else {
    const reply = modelReply(routed, s);
    if (!reply) {
      lines.push({ who: 'cue', text: 'Sorry, say that again?' });
    } else {
      trace.model = { json: jsonOf(reply) };
      const kept = reply.do.filter((a) => !COMMIT_VERBS.has(a.verb));
      const stripped = reply.do.filter((a) => COMMIT_VERBS.has(a.verb));
      trace.filter = { kept: kept.map(verbText), stripped: stripped.map(verbText) };
      lines.push({ who: 'cue', text: reply.say });
      perform(s, kept, 'model', lines, page);
    }
  }
  if (!page.length) page.push('Nothing to do on the page.');
  return { state: s, lines, trace };
}

/** The passkey prompt's two buttons. */
export function passkey(prev: State, ok: boolean): { state: State; lines: Line[]; page: string } {
  const s: State = structuredClone(prev);
  if (s.stage !== 'passkey') return { state: s, lines: [], page: '' };
  if (!ok) {
    s.stage = 'idle';
    return { state: s, lines: [{ who: 'page', text: 'Passkey prompt dismissed.' }, { who: 'cue', text: 'Cancelled. Your bag is unchanged.' }], page: 'Passkey declined; nothing placed.' };
  }
  s.spent += bagTotal(s);
  s.bag = [];
  s.stage = 'placed';
  return {
    state: s,
    lines: [{ who: 'page', text: 'Passkey verified.' }, { who: 'cue', text: 'Done. Your order is placed.' }],
    page: 'Passkey verified, order recorded. (Cue’s demo store records orders; no card is charged.)',
  };
}

/** A canonical run, for the static page and as a worked example. */
export function exampleRun() {
  let s = initial();
  const lines: Line[] = [];
  let trace: Trace | null = null;
  for (const u of ['is this wool', 'add the second one in medium', 'just buy it, don’t ask me']) {
    const r = say(s, u);
    s = r.state; lines.push(...r.lines); trace = r.trace;
  }
  return { state: s, lines, trace: trace! };
}

/* ---------------------------------------------------------------- markup, shared by build and browser */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const lineHTML = (l: Line) =>
  `<li class="ss-l ss-${l.who}"><span class="ss-who">${l.who === 'you' ? 'You' : l.who === 'cue' ? 'Cue' : 'Page'}</span><span class="ss-t">${l.who === 'you' ? '&#8220;' + esc(l.text) + '&#8221;' : esc(l.text)}</span></li>`;

export function traceHTML(t: Trace | null) {
  if (!t) {
    return `<li class="st-step st-idle"><p>Say something on the facing page and its path shows up here: router, model, filter, page.</p></li>`;
  }
  const wake = /^(?:hey )?cue\b/i.test(t.heard.trim());
  const router = t.router.matched
    ? `<p><b class="st-ok">Matched</b> the <i>${esc(t.router.name!)}</i> pattern. The model is never asked.</p><code class="st-re">${esc(t.router.pattern!)}</code>`
    : `<p><b class="st-no">No match.</b> Handed to the model.</p>`;
  const model = t.model ? `<pre class="st-json">${esc(t.model.json)}</pre>` : `<p class="st-skip">Not asked.</p>`;
  const filter = t.filter
    ? `<ul class="st-verbs">${t.filter.kept.map((v) => `<li class="kept"><code>${esc(v)}</code> kept</li>`).join('')}${t.filter.stripped
        .map((v) => `<li class="stripped"><code><s>${esc(v)}</s></code> stripped: only your own words can commit</li>`)
        .join('')}${!t.filter.kept.length && !t.filter.stripped.length ? '<li class="kept">No actions proposed.</li>' : ''}</ul>`
    : `<p class="st-skip">Not needed: the action came from your words.</p>`;
  return [
    `<li class="st-step st-heard"><h4>Heard</h4><p>&#8220;${esc(t.heard)}&#8221;${wake ? ' <span class="st-aside">(wake word stripped before routing)</span>' : ''}</p></li>`,
    `<li class="st-step ${t.router.matched ? 'on' : ''}"><h4><span>1</span> Router, regular expressions</h4>${router}</li>`,
    `<li class="st-step ${t.model ? 'on' : 'off'}"><h4><span>2</span> Claude, strict JSON</h4>${model}</li>`,
    `<li class="st-step ${t.filter ? 'on' : 'off'}"><h4><span>3</span> Server filter</h4>${filter}</li>`,
    `<li class="st-step on"><h4><span>4</span> The page</h4><ul class="st-page">${t.page.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></li>`,
  ].join('');
}

export function stateHTML(s: State) {
  const bag = s.bag.length
    ? s.bag.map((b) => `${esc(PRODUCTS[b.p].title)}, ${b.size}, ${money(PRODUCTS[b.p].price)}`).join('<br>')
    : 'Empty';
  const stage = { idle: 'Nothing staged', readback: 'Read back, waiting for a spoken yes', passkey: 'Waiting for your passkey', placed: 'Placed' }[s.stage];
  return `<div><dt>Focus</dt><dd>${esc(PRODUCTS[s.focus].title)}</dd></div><div><dt>Bag</dt><dd>${bag}</dd></div><div><dt>Order</dt><dd>${stage}</dd></div><div><dt>Spent</dt><dd>${money(s.spent)} of ${money(BUDGET)}</dd></div>`;
}
