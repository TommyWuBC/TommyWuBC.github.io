// SAMPLE data for the fault-diagnosis illustration. Everything here is invented
// for this page: the robot, the log lines, the rule ids, the guidance sections
// and their similarity scores, and both reports. The real platform's code and
// data are private. What is real is the shape of the pipeline: deterministic
// subsystem diagnosis first, retrieval over maintenance guidance, LLM analysis
// on top, and a rule-based fallback underneath.

export interface LogLine { t: string; lv: 'INFO' | 'WARN' | 'ERROR'; node: string; msg: string }
export interface Rule { id: string; text: string; lines: number[] }
export interface Guide { id: string; title: string; text: string; score: number; right?: boolean }
export interface Scenario {
  key: string;
  label: string;
  log: LogLine[];
  rules: Rule[];
  subsystem: string;
  ruledOut: { text: string; line: number };
  query: string;
  guides: Guide[];
  llm: { summary: string; cause: string; steps: string[]; severity: string };
  fallbackSteps: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'drive',
    label: 'Left wheel overcurrent',
    log: [
      { t: '10:42:01.120', lv: 'INFO', node: '/bringup', msg: 'All nodes up, battery 87%' },
      { t: '10:42:03.551', lv: 'INFO', node: '/nav', msg: 'Goal accepted: bay 3 to aisle 4' },
      { t: '10:42:04.007', lv: 'INFO', node: '/base_driver', msg: 'Velocity command 0.80 m/s' },
      { t: '10:42:09.312', lv: 'WARN', node: '/base_driver', msg: 'Left motor current 16.8 A, soft limit 15.0 A' },
      { t: '10:42:09.330', lv: 'INFO', node: '/odom', msg: 'Wheel odometry at 49.8 Hz' },
      { t: '10:42:11.874', lv: 'WARN', node: '/base_driver', msg: 'Left motor current 18.2 A, soft limit 15.0 A' },
      { t: '10:42:12.090', lv: 'WARN', node: '/odom', msg: 'Left/right encoder disagreement 7.4% for 1.2 s' },
      { t: '10:42:12.415', lv: 'INFO', node: '/nav', msg: 'Recovery behavior: clearing costmap' },
      { t: '10:42:12.903', lv: 'ERROR', node: '/base_driver', msg: 'Left motor driver fault 0x21 (overcurrent trip)' },
      { t: '10:42:12.905', lv: 'ERROR', node: '/safety', msg: 'Protective stop: drive fault' },
      { t: '10:42:13.200', lv: 'WARN', node: '/nav', msg: 'Goal aborted: controller failed' },
      { t: '10:42:13.640', lv: 'INFO', node: '/bms', msg: 'Pack 25.4 V, 3.1 A' },
      { t: '10:42:15.002', lv: 'INFO', node: '/bringup', msg: 'Waiting for operator reset' },
    ],
    rules: [
      { id: 'D-01', text: 'motor current over its limit twice within 5 s', lines: [4, 6] },
      { id: 'D-04', text: 'wheel encoders disagree by more than 5%', lines: [7] },
      { id: 'D-07', text: 'driver fault code 0x21 is an overcurrent trip', lines: [9] },
    ],
    subsystem: 'Drive, left wheel',
    ruledOut: { text: 'Power ruled out: pack voltage normal', line: 12 },
    query: 'left drive motor overcurrent trip 0x21, encoder disagreement',
    guides: [
      { id: 'DRV-3.2', title: 'Overcurrent trips on one wheel', score: 0.84, right: true, text: 'Look for debris or wrapped material at the wheel. With power off, turn the wheel by hand; resistance points to the gearbox or bearing. Check the motor phase connector for heat marks.' },
      { id: 'DRV-5.1', title: 'Encoders disagree between wheels', score: 0.71, text: 'Push the robot 2 m in a straight line with motors disabled and compare encoder counts. More than 3% apart: check the encoder cable and the wheel for slip.' },
      { id: 'PWR-2.4', title: 'Brownout during acceleration', score: 0.52, text: 'If the bus voltage dips below 22 V under load, test the pack under load and inspect the main contactor.' },
    ],
    llm: {
      summary: 'The left drive motor tripped its driver on overcurrent after two rising current warnings, and the robot made a protective stop.',
      cause: 'Extra mechanical load on the left wheel: debris, wrapped material, or a failing gearbox. The encoders started to disagree just before the trip, which fits a wheel being dragged. Power is not involved; the pack read 25.4 V.',
      steps: [
        'Power down and lock out the robot.',
        'Inspect the left wheel for debris or wrapped material (DRV-3.2).',
        'Turn the wheel by hand. If it resists, inspect the gearbox and bearing.',
        'Check the left motor phase connector for heat marks.',
        'Clear fault 0x21, push 2 m straight and compare encoder counts (DRV-5.1).',
      ],
      severity: 'Robot stopped. Needs a technician at the robot.',
    },
    fallbackSteps: [
      'DRV-3.2: Look for debris or wrapped material at the wheel.',
      'DRV-3.2: With power off, turn the wheel by hand.',
      'DRV-3.2: Check the motor phase connector for heat marks.',
      'DRV-5.1: Push 2 m straight and compare encoder counts.',
    ],
  },
  {
    key: 'lidar',
    label: 'Lidar drops out',
    log: [
      { t: '14:05:40.010', lv: 'INFO', node: '/bringup', msg: 'All nodes up, battery 74%' },
      { t: '14:05:40.512', lv: 'INFO', node: '/lidar', msg: 'Publishing /scan at 15.0 Hz' },
      { t: '14:05:42.130', lv: 'INFO', node: '/nav', msg: 'Goal accepted: aisle 2 to charger' },
      { t: '14:05:58.441', lv: 'WARN', node: '/lidar', msg: '/scan rate 6.2 Hz, expected 15.0 Hz' },
      { t: '14:05:58.902', lv: 'WARN', node: '/net', msg: 'eth1 link down/up 3 times in 10 s' },
      { t: '14:06:00.950', lv: 'ERROR', node: '/lidar', msg: 'No /scan message for 2.0 s' },
      { t: '14:06:01.003', lv: 'WARN', node: '/localization', msg: 'Transform timeout: map to odom' },
      { t: '14:06:01.210', lv: 'WARN', node: '/nav', msg: 'Obstacle data stale, slowing to 0.1 m/s' },
      { t: '14:06:03.774', lv: 'ERROR', node: '/nav', msg: 'Goal aborted: localization lost' },
      { t: '14:06:04.020', lv: 'INFO', node: '/base_driver', msg: 'Motors nominal, 2.1 A each' },
      { t: '14:06:04.300', lv: 'INFO', node: '/bms', msg: 'Pack 24.9 V' },
    ],
    rules: [
      { id: 'S-02', text: 'scan rate under half its expected value', lines: [4] },
      { id: 'N-01', text: 'link flapping on the port a sensor uses', lines: [5] },
      { id: 'S-05', text: 'sensor silent for more than 1 s', lines: [6] },
    ],
    subsystem: 'Sensing, front lidar and its network link',
    ruledOut: { text: 'Drive ruled out: motor currents nominal', line: 10 },
    query: 'lidar scan dropout, eth1 link flapping, localization lost',
    guides: [
      { id: 'SEN-1.3', title: 'Lidar stops publishing', score: 0.81, right: true, text: 'Reseat the lidar Ethernet connector and check its strain relief. Power-cycle the sensor, then confirm /scan returns to its rated frequency.' },
      { id: 'NET-2.1', title: 'Flapping link on a sensor port', score: 0.77, text: 'Swap the cable for a known-good one. If the port still flaps, move the sensor to a spare port and log the switch port number.' },
      { id: 'LOC-4.2', title: 'Localization lost after a sensor dropout', score: 0.63, text: 'Once the sensor is back, re-localize the robot at a marked pose before sending it a new goal.' },
    ],
    llm: {
      summary: 'The front lidar stopped publishing mid-route while its Ethernet link went down and up three times, so localization timed out and navigation aborted.',
      cause: 'An intermittent Ethernet connection to the lidar: a loose connector, a strained cable, or a bad port. The link flapped about two seconds before the scan stopped. Drive and power look healthy.',
      steps: [
        'Reseat the lidar Ethernet connector and check the strain relief (SEN-1.3).',
        'Swap in a known-good cable; if eth1 still flaps, move to a spare port (NET-2.1).',
        'Power-cycle the lidar and confirm /scan is back at 15 Hz.',
        'Re-localize at a marked pose before sending a new goal (LOC-4.2).',
      ],
      severity: 'Robot stopped safely. Likely a quick fix on site.',
    },
    fallbackSteps: [
      'SEN-1.3: Reseat the lidar Ethernet connector and check its strain relief.',
      'SEN-1.3: Power-cycle the sensor and confirm /scan frequency.',
      'NET-2.1: Swap the cable for a known-good one.',
      'LOC-4.2: Re-localize at a marked pose.',
    ],
  },
  {
    key: 'power',
    label: 'Battery sags under load',
    log: [
      { t: '09:17:22.004', lv: 'INFO', node: '/bringup', msg: 'All nodes up, battery 41%' },
      { t: '09:17:23.600', lv: 'INFO', node: '/nav', msg: 'Goal accepted: ramp to aisle 6' },
      { t: '09:17:23.910', lv: 'INFO', node: '/bms', msg: 'Pack 24.6 V at 4.0 A' },
      { t: '09:17:30.115', lv: 'INFO', node: '/base_driver', msg: 'Velocity command 1.00 m/s, climbing' },
      { t: '09:17:31.402', lv: 'WARN', node: '/bms', msg: 'Pack 22.1 V at 19.5 A' },
      { t: '09:17:31.405', lv: 'WARN', node: '/bms', msg: 'Cell 5 at 3.02 V, others 3.31 V' },
      { t: '09:17:31.620', lv: 'WARN', node: '/base_driver', msg: 'Bus undervoltage 21.4 V' },
      { t: '09:17:31.700', lv: 'ERROR', node: '/computer', msg: 'Brownout reset detected on controller' },
      { t: '09:17:40.880', lv: 'INFO', node: '/bringup', msg: 'Restarting nodes, reason: brownout' },
      { t: '09:17:44.016', lv: 'INFO', node: '/bms', msg: 'Pack 24.3 V at rest' },
    ],
    rules: [
      { id: 'P-03', text: 'pack voltage sags more than 2 V under load', lines: [3, 5] },
      { id: 'P-06', text: 'cell spread over 200 mV', lines: [6] },
      { id: 'P-09', text: 'controller brownout reset', lines: [8] },
    ],
    subsystem: 'Power, battery pack',
    ruledOut: { text: 'Drive ruled out: it only reports low bus voltage', line: 7 },
    query: 'battery voltage sag under load, weak cell, brownout reset',
    guides: [
      { id: 'PWR-2.4', title: 'Brownout during acceleration', score: 0.86, right: true, text: 'If the bus voltage dips below 22 V under load, test the pack under load and inspect the main contactor. Replace a pack that cannot hold 22 V at 20 A.' },
      { id: 'BAT-1.7', title: 'One cell lower than the rest', score: 0.8, text: 'A spread over 200 mV at rest or under load means a weak cell. Run a balance charge, then retest; if the spread returns, take the pack out of service.' },
      { id: 'DRV-3.2', title: 'Overcurrent trips on one wheel', score: 0.41, text: 'Look for debris or wrapped material at the wheel. With power off, turn the wheel by hand.' },
    ],
    llm: {
      summary: 'Climbing the ramp at full speed, the pack sagged from 24.6 V to 22.1 V, the motor bus fell under its limit, and the controller browned out and restarted.',
      cause: 'A weak cell. Cell 5 sat 290 mV below the others under load, so the whole pack could not hold voltage at 19.5 A. The robot recovered on its own, so this will happen again on the next climb.',
      steps: [
        'Take the robot off ramp routes until the pack is checked.',
        'Run a balance charge and retest the cell spread (BAT-1.7).',
        'Load-test the pack at 20 A; replace it if it falls below 22 V (PWR-2.4).',
        'Inspect the main contactor while the pack is out.',
      ],
      severity: 'Robot running again, but the fault will recur. Schedule soon.',
    },
    fallbackSteps: [
      'PWR-2.4: Test the pack under load and inspect the main contactor.',
      'BAT-1.7: Run a balance charge, then retest the cell spread.',
      'PWR-2.4: Replace a pack that cannot hold 22 V at 20 A.',
    ],
  },
];

/* ---------------- HTML ---------------- */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const decisive = (s: Scenario) => new Map(s.rules.flatMap((r) => r.lines.map((l) => [l, r.id] as const)));
const refs = (ls: number[]) => ls.map((l) => `L${l}`).join(', ');

export function logHTML(s: Scenario) {
  const d = decisive(s);
  return s.log.map((l, i) => {
    const n = i + 1;
    const rule = d.get(n);
    return `<li class="fd-l fd-${l.lv.toLowerCase()}${rule ? ' fd-dec' : ''}${n === s.ruledOut.line ? ' fd-out' : ''}" data-n="${n}">` +
      `<span class="fd-n">L${n}</span><span class="fd-meta">${l.t} <b>${l.lv}</b> ${esc(l.node)}</span>` +
      `<span class="fd-msg">${esc(l.msg)}</span>${rule ? `<span class="fd-tag">${rule}</span>` : ''}</li>`;
  }).join('');
}

export function rulesHTML(s: Scenario) {
  return `<ul class="fd-rules">${s.rules.map((r) => `<li><b>${r.id}</b> ${esc(r.text)} <span>(${refs(r.lines)})</span></li>`).join('')}` +
    `<li class="fd-ruled-out">${esc(s.ruledOut.text)} <span>(L${s.ruledOut.line})</span></li></ul>` +
    `<p class="fd-verdict">Subsystem: <b>${esc(s.subsystem)}</b></p>`;
}

export function guidesHTML(s: Scenario) {
  return `<p class="fd-query">Query: <q>${esc(s.query)}</q></p><ol class="fd-guides">${s.guides.map((g) =>
    `<li class="${g.right ? 'right' : ''}"><span class="fd-gid">${g.id}</span><span class="fd-gt">${esc(g.title)}</span><span class="fd-gs">${g.score.toFixed(2)}</span><span class="fd-gx">${esc(g.text)}</span></li>`).join('')}</ol>`;
}

export function reportHTML(s: Scenario, llm: boolean) {
  const evidence = [...new Set([...s.rules.flatMap((r) => r.lines), s.ruledOut.line])].sort((a, b) => a - b);
  const head = `<header class="fd-rh"><p class="fd-rk">Fault report, sample</p><h4>${esc(s.subsystem)}</h4>` +
    `<p class="fd-rmeta">Robot SAMPLE-07, ${s.log[0].t.slice(0, 5)}. Evidence ${refs(evidence)}.</p></header>`;
  if (llm) {
    return head +
      `<p>${esc(s.llm.summary)}</p>` +
      `<h5>Likely cause</h5><p>${esc(s.llm.cause)}</p>` +
      `<h5>Do this</h5><ol>${s.llm.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` +
      `<p class="fd-sev">${esc(s.llm.severity)}</p>` +
      `<p class="fd-by">Drafted by LLM analysis from the rule hits and ${s.guides.length} guidance sections.</p>`;
  }
  return head +
    `<h5>Rules that fired</h5><ul>${s.rules.map((r) => `<li>${r.id}: ${esc(r.text)} (${refs(r.lines)})</li>`).join('')}<li>${esc(s.ruledOut.text)} (L${s.ruledOut.line})</li></ul>` +
    `<h5>Steps from guidance</h5><ol>${s.fallbackSteps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` +
    `<p class="fd-by">Written by the rule-based fallback. No LLM analysis; every line comes from a rule or a guidance section.</p>`;
}
