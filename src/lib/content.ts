// Queries over the content collections, so pages don't repeat sort logic.
import { getCollection, type CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>;

/** `order` first (lower wins), then newest first. */
const byOrderThenDate = (a: Project, b: Project) =>
  (a.data.order ?? Infinity) - (b.data.order ?? Infinity) || b.data.date.valueOf() - a.data.date.valueOf();

export async function getProjects() {
  const all = await getCollection('projects', ({ data }) => !data.draft);
  return {
    featured: all.filter((p) => p.data.tier === 'featured').sort(byOrderThenDate),
    archive: all.filter((p) => p.data.tier === 'archive').sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()),
    caseStudies: all.filter((p) => p.data.caseStudy),
  };
}

export async function getExperience() {
  return (await getCollection('experience')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** True once src/content/notes/ has a file not starting with "_". Avoids querying an empty collection. */
const noteFiles = import.meta.glob(['/src/content/notes/*.{md,mdx}', '!/src/content/notes/_*']);
export const hasNoteFiles = Object.keys(noteFiles).length > 0;

export async function getNotes() {
  if (!hasNoteFiles) return [];
  return (await getCollection('notes', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** "Five projects", "Twelve projects": for section kickers that shouldn't go stale. */
export const countWord = (n: number, noun: string) =>
  `${WORDS[n] ?? n} ${noun}${n === 1 ? '' : 's'}`;

/** Strip tags and decode numeric entities: for <meta> descriptions built from HTML-ish fields. */
export const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
