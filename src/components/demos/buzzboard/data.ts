// SAMPLE data for the BuzzBoard zine. The campus, the events and the class
// schedule are invented for this illustration; they are not Georgia Tech's map
// or BuzzBoard's real events. Coordinates are in the map's 600 x 420 viewBox.

export type Ev = {
  id: string; title: string; cat: string; place: string;
  x: number; y: number; start: number; end: number; // minutes after midnight
  going: number; friends: number;
};
export type Block = { id: string; title: string; start: number; end: number };

export const EVENTS: Ev[] = [
  { id: 'pizza', title: 'Free pizza after the club fair', cat: 'Free food', place: 'the quad', x: 300, y: 214, start: 720, end: 780, going: 41, friends: 3 },
  { id: 'resume', title: 'Résumé review drop-in', cat: 'Career', place: 'the student center', x: 352, y: 88, start: 900, end: 960, going: 12, friends: 0 },
  { id: 'study', title: 'Linear algebra study group', cat: 'Study', place: 'the library', x: 128, y: 104, start: 1020, end: 1110, going: 8, friends: 2 },
  { id: 'figma', title: 'Intro to Figma workshop', cat: 'Workshop', place: 'the engineering hall', x: 506, y: 136, start: 1080, end: 1170, going: 23, friends: 1 },
  { id: 'yoga', title: 'Sunset yoga on the field', cat: 'Wellness', place: 'the rec field', x: 498, y: 330, start: 1155, end: 1215, going: 17, friends: 0 },
  { id: 'games', title: 'Board game night', cat: 'Hangout', place: 'the residence hall lounge', x: 150, y: 342, start: 1230, end: 1350, going: 15, friends: 4 },
];

/** Classes from a sample .ics file. */
export const CLASSES: Block[] = [
  { id: 'phys', title: 'Physics lecture', start: 570, end: 645 },
  { id: 'rec', title: 'Calculus recitation', start: 750, end: 800 },
  { id: 'lab', title: 'CS lab', start: 930, end: 1020 },
];

export const START_PIN = { x: 300, y: 150 };
export const METERS_PER_UNIT = 1.4; // the sample map is about 840 m across
export const WALK_M_PER_MIN = 80;

export const walkMin = (e: { x: number; y: number }, p: { x: number; y: number }) =>
  Math.max(1, Math.round((Math.hypot(e.x - p.x, e.y - p.y) * METERS_PER_UNIT) / WALK_M_PER_MIN));

export const rank = (p: { x: number; y: number }) =>
  [...EVENTS].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.start - b.start);

export const clock = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`;
};
export const span = (a: number, b: number) => `${clock(a)}–${clock(b)} ${b >= 720 ? 'pm' : 'am'}`;

/** Overlapping pairs among the blocks on your day. */
export function conflicts(blocks: Block[]) {
  const out: { a: Block; b: Block; start: number; end: number }[] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const s = Math.max(blocks[i].start, blocks[j].start), e = Math.min(blocks[i].end, blocks[j].end);
      if (s < e) out.push({ a: blocks[i], b: blocks[j], start: s, end: e });
    }
  return out;
}

export const DAY_START = 540; // 9 am
export const DAY_END = 1380; // 11 pm
