# stemcells.sh

The landing page. Its Aski and its Cells are the app's own: `src/app.ts` and
`src/app-cells.ts` import the scenes, the grid painter, the Cells' art, looks
and flight from `apps/web/src/stemcells/`, so the page can't drift from the
app. What it adds is the staging: the hero (`src/hero.ts`, over a field of
asks in `src/field.ts`) and the four acts (`src/act-*.ts`).

- `node build.mjs` bundles `dist/` with vite-plus, and writes `aski.txt`
  (what `curl stemcells.sh` prints) and the 404's Aski from the same canon.
- Preview `dist/` with any static server; module scripts don't load from
  `file://`.
- Deploys are the maintainer's: `vercel build --prod`, then
  `vercel deploy --prebuilt --prod`, from this folder.
