import { defineConfig } from 'astro/config';

// Static output: the build is plain HTML, CSS and JS that any host can serve.
// Change `site` to the live address once the domain is settled.
export default defineConfig({
  site: 'https://juicebox.ph',
  output: 'static',
  compressHTML: true,
});
