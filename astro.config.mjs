import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub *user* Pages site (TommyWuBC.github.io): served from the domain root, no `base` needed.
export default defineConfig({
  site: 'https://tommywubc.github.io',
  output: 'static',
  integrations: [mdx(), sitemap()],
  // Old URLs from the first version of the site.
  redirects: {
    '/projects/visual-navigation-research': '/work/visual-navigation/',
    '/projects/gt-movies-store': '/',
    '/projects/buzzboard': '/',
    '/projects/autonomous-vehicle-diagnostics': '/',
  },
});
