# Juicebox

Scroll-driven site for Juicebox Digital Marketing, built with [Astro](https://astro.build).
It builds to plain static HTML, CSS and JS, so any static host can serve it.

## Commands

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Start the dev server on localhost:4321    |
| `npm run build`   | Build the static site into `dist/`        |
| `npm run preview` | Preview the production build locally      |

## Structure

- `src/pages/index.astro` composes the page from the section components.
- `src/components/` has one component per section (Hero, FiveCs, About, Services, Process, Portfolio, Faq, Cta, Footer) plus Nav and Deco.
- `src/layouts/Layout.astro` holds the document head, the fixed background and the script.
- `src/styles/global.css` is the whole stylesheet.
- `src/scripts/app.js` runs the scroll-scrubbed hero, the text choreography, the squeeze interaction and the FAQ accordion.
- `public/assets/` holds the scroll video, poster, images, shapes and characters.

## Notes

- Set `site` in `astro.config.mjs` to the live address so the share-preview image and canonical link point to it.
- The hero video is scrubbed by scroll position. Phones, portrait tablets and visitors who prefer reduced motion get a still hero instead and never download the video.
- The opening animation was made with AI.
