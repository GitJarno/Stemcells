# stemcells.sh

The landing page: one static page with no dependencies. Aski and every form
it takes are drawn on a canvas character grid (`src/kit.js`); the hero is
`src/hero.js`, the four acts below it `src/story.js`.

- `node build.mjs` writes `dist/`: one `index.html` with the styles, scripts
  and art inlined, the 404 page, and `aski.txt`, which `curl stemcells.sh`
  gets instead of the page (`vercel.json`).
- Preview by opening `dist/index.html`.
- Deploys are the maintainer's: `vercel deploy --prod` from this folder.

The paintings are in the public domain; the photograph of The Thinker is from
The Met's Open Access collection (CC0).
