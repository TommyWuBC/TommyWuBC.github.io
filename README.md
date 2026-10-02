<img src="public/og.png" alt="The cover of tommywubc.github.io: the name Tommy Wu set large in a light serif, running into the sky of a lake photograph." width="100%">

<p align="center"><b><a href="https://tommywubc.github.io">tommywubc.github.io</a></b> · <a href="https://www.linkedin.com/in/bingchang-wu-017474274/">LinkedIn</a> · <a href="public/resume.pdf">Résumé (PDF)</a></p>

The source for my personal site. If you're here for the work, **[go to the site](https://tommywubc.github.io)**. If you want to see how it's built, keep reading.

## The design

It's set like a small printed monograph: one ink (a lake blue, `#13295B`) on cool uncoated paper, with the photographs as the only full color. Type is [Newsreader](https://github.com/productiontype/Newsreader), a variable serif with an optical-size axis, and [Schibsted Grotesk](https://github.com/schibsted/schibsted-grotesk) for the marginalia. Both are self-hosted. Sections have folio numbers; the running head at the top changes to the section you're reading, like a book's.

The centerpiece is **Fig. 1, "Move the gap"**: a working MiniGrid LavaCrossing from my research. A policy trained on one layout (dotted) and one trained on many (solid) cross the same lava field; move the gap and the memorizer walks into lava. The case studies add a gaze-filter demo for Cue and a pipeline diagram for csearch.

Everything works without JavaScript: the figure's SVG is rendered at build time from the same code the browser runs, and controls that need scripts stay hidden until they can work. Motion respects `prefers-reduced-motion`.

## Adding things

Content lives in files, not markup. The schemas in [`src/content.config.ts`](src/content.config.ts) are the contract; a wrong field fails the build.

| To add | Do this |
| --- | --- |
| A project | Add `src/content/projects/<slug>.md`. `tier: featured` gives it a full entry under Selected work; `tier: archive` makes it one line under "Also, from earlier". |
| A case study | Make it `<slug>.mdx` with `caseStudy: true`. The body is published at `/work/<slug>/` and can use `<Section>`, `<Row note="…">`, `<Finding value="…" caption="…">`, `<Table caption="…">`, `<Mark>`, `<Band>` and the figure components without importing them. |
| A job | Add `src/content/experience/<slug>.md`. The Markdown list in the body becomes the bullets. |
| A note | Copy [`src/content/notes/_template.md`](src/content/notes/_template.md) to a name without the underscore and set `draft: false`. A "Notes" link appears in the nav once one exists. |
| About, links, skills | Edit [`src/data/site.ts`](src/data/site.ts). |
| Résumé | Replace `public/resume.pdf`. |

Use pull-figures (`figure:`) sparingly. They stop being special after three or four on a page.

## Layout

```
src/
  content.config.ts        collection schemas
  content/                 projects/, experience/, notes/  (one file each)
  data/site.ts             identity, links, About, skills
  pages/                   index, work/[slug], notes/, 404
  layouts/Base.astro       <head>, running head, colophon
  components/              Cover, Opener, ProjectEntry, JobEntry, Archive, About, Contact, …
  components/article/      the MDX building blocks for case studies
  components/figures/      LavaFigure, ResultsChart, GazeFigure, SearchPipeline
  lib/lava.ts              Fig. 1's layouts and drawing (runs at build time and in the browser)
  scripts/                 small client scripts: figures, running head, copy-email
  styles/                  tokens, base, entries, figures, article
```

## Running it

Needs Node 22.12 or newer.

```bash
npm install
npm run dev       # http://localhost:4321
npm run check     # type-check .astro and .ts files
npm run build     # static site in dist/
```

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): type-check, build, publish to GitHub Pages.

Stack: [Astro](https://astro.build), MDX, TypeScript, plain CSS with design tokens. No client framework.
