// ---------------------------------------------------------------------------
// Content collections. Every project, job and note is one file in
// src/content/<collection>/. Add a file, and it shows up on the site.
// The schemas below are the contract: a build fails loudly if a field is wrong.
// ---------------------------------------------------------------------------
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.object({ label: z.string(), href: z.string() });

/** A big number with a caption, set as a pull-figure beside an entry. */
const figure = z.object({ value: z.string(), caption: z.string() });

const projects = defineCollection({
  loader: glob({ pattern: '[^_]*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** Margin label: where it happened ("HackGT 13", "Personal", "Research, PAIR Lab"). */
    context: z.string(),
    /** Display date, e.g. "Jun 2026 to now". */
    when: z.string(),
    /** Sort key: newest first. */
    date: z.coerce.date(),
    /** One italic sentence under the title. */
    dek: z.string(),
    /** A short paragraph for the home page. Omit to show only the dek. */
    summary: z.string().optional(),
    /** Pull-figure beside the entry. Use sparingly, they stop being special fast. */
    figure: figure.optional(),
    /** Or a quote instead of a figure. */
    quote: z.object({ text: z.string(), caption: z.string() }).optional(),
    /**
     * Numbered attempts shown on the notebook page. `struck` is crossed out
     * (what didn't work), `text` follows it.
     */
    trials: z.array(z.object({ struck: z.string().optional(), text: z.string() })).default([]),
    stack: z.array(z.string()).default([]),
    links: z.array(link).default([]),
    /** Shown after the links, e.g. "Internal tool; code is private." */
    note: z.string().optional(),
    /**
     * featured: a full entry under Selected work.
     * archive:  one line under "Also, from earlier".
     */
    tier: z.enum(['featured', 'archive']).default('featured'),
    /**
     * How the project opens from the notebook. If set, the file body is an
     * interactive write-up published at /work/<id>/, wrapped in that shell:
     *   folder: a manila folder opened on the desk
     *   scroll: a paper roll that unrolls
     *   zine:   a riso-printed, stapled zine
     *   map:    an orienteering map
     */
    expansion: z.enum(['folder', 'scroll', 'zine', 'map']).optional(),
    /** The button label on the notebook page, e.g. "Open the folder". Defaults per shell. */
    openLabel: z.string().optional(),
    /** Case-study header: your role on the project. */
    role: z.string().optional(),
    /** Lower numbers first within the same tier; ties fall back to date. */
    order: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '[^_]*.md', base: './src/content/experience' }),
  schema: z.object({
    role: z.string(),
    org: z.string(),
    /** A line under the role, e.g. what the lab works on. */
    blurb: z.string().optional(),
    /** Project ids (files in src/content/projects) that came out of this role. */
    projects: z.array(z.string()).default([]),
    when: z.string(),
    /** Start date, used for sorting. */
    date: z.coerce.date(),
    stack: z.array(z.string()).default([]),
    figure: figure.optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '[^_]*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    dek: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, experience, notes };
