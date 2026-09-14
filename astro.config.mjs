import { defineConfig } from 'astro/config';

// This repo is a GitHub *user* Pages site (TommyWuBC.github.io), so it is
// served from the domain root; no `base` path is needed. If you ever move
// this content into a project repo (e.g. github.com/you/portfolio) deployed
// at username.github.io/portfolio, set `base: '/portfolio'` below.
export default defineConfig({
  site: 'https://TommyWuBC.github.io',
  output: 'static',
});
