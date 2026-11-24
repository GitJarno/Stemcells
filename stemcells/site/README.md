# stemcells.sh

The landing page: the brand book (`stemcells/brand/book.md`) acted out. Its
Aski and its Cells are the app's own: `src/app.ts`, `src/app-cells.ts` and
`src/app-walk.ts` import the canon, the painters, the Cells' art, looks and
flight from `apps/web/src/stemcells/`, so the page can't drift from the app.

What the page adds:

- `src/kit/`: the engine. Words are characters and things are solid (the
  book, How it looks). One WebGL2 layer draws every character from a glyph
  atlas (`glyphs.ts`); a body is words as characters, which travel to become
  the next thing (`bodies.ts`); each scene draws its things on a canvas; a
  scene is pinned while the scroll plays it, each frame a pure function of
  the scroll's progress (`scenes.ts`); the page is staged apart for a
  phone, a tablet and a desk (`form.ts`).
- The hero (`hero.ts`, its thrown Cells in `throws.ts`) and one file a
  scene: `arc.ts`, `shown.ts`, `becomes.ts`, `devices.ts`, `get.ts`.
- `stroll.ts`: Aski walks the foot of the page as it scrolls.

Working on it:

- `node build.mjs` bundles `dist/` with vite-plus, and writes `aski.txt`
  (what `curl stemcells.sh` prints) and the 404's Aski from the same canon.
  `--out <folder>` builds elsewhere.
- Preview `dist/` with any static server; module scripts don't load from
  `file://`.
- `site.test.ts` builds and typechecks the page with the rest of our tests:
  the site is no workspace package, so nothing else would notice an app
  export it imports going away.
- Deploys are the maintainer's: `node deploy.mjs` builds and puts it on
  stemcells.sh (`vercel link` once first).
