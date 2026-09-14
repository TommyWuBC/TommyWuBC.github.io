# Bingchang Wu: Portfolio

A personal software-engineering portfolio site built with [Astro](https://astro.build), TypeScript, and plain CSS. Statically generated, no backend, no CMS, no client-side framework.

## Editing content

All personal content (name, bio, projects, experience, education, skills, contact links) lives in a single file:

```
src/data/profile.ts
```

Edit that file to update the site; no need to touch any `.astro` component. To add a new project, add an entry to the `projects` array; a detail page is generated automatically at `/projects/<slug>/`.

To swap in a real résumé, replace `public/resume.pdf` with your own file (keep the same filename, or update `resumeUrl` in `profile.ts`).

## Local development

```bash
npm install
npm run dev
```

This starts a local dev server (default: http://localhost:4321) with hot reload.

## Build

```bash
npm run build
```

Outputs the static site to `dist/`.

To preview the production build locally:

```bash
npm run preview
```

## Deploying to GitHub Pages

This repo is set up as a GitHub **user** Pages site (`TommyWuBC.github.io`), so it deploys to the domain root.

1. In your GitHub repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`:

   ```bash
   git push origin main
   ```

3. The workflow in `.github/workflows/deploy.yml` runs automatically on every push to `main`: it installs dependencies, runs `npm run build`, and publishes `dist/` to GitHub Pages.
4. Your site will be live at `https://TommyWuBC.github.io`.

You can also trigger a deploy manually from the **Actions** tab (`workflow_dispatch`).

### Deploying from a project repo instead

If you ever move this into a non-`username.github.io` repo (served at `username.github.io/repo-name`), set `base: '/repo-name'` in `astro.config.mjs`.

## Tech stack

- [Astro](https://astro.build) (static output only)
- TypeScript
- Plain CSS with custom properties (no Tailwind, no CSS-in-JS)
- GitHub Actions for CI/CD

## Project structure

```
src/
  data/profile.ts        # all editable content
  layouts/BaseLayout.astro
  components/            # Header, Hero, About, Projects, Experience, Skills, Contact, Footer
  pages/index.astro       # single-page site with anchor navigation
  pages/projects/[slug].astro  # reusable project detail page template
  styles/global.css      # design tokens + base styles
public/
  resume.pdf
  favicon.svg
```
