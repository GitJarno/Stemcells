# The app's screens, as the site shows them

Every picture in `public/app/` is the real web app (the production build of
`apps/web`) in a headless Chromium, dark, default theme, with nothing drawn
over it. The work on screen is made up: a person shipping a small website,
in two projects called Website and Docs. `rig/world.mjs` holds every word
the Cells say.

The same moments are taken at three widths: a Mac's window (1440×900 at 2x),
a tablet's browser (`-tablet`, 834×1194 at 2x) and a phone's (`-phone`,
393×852 at 3x). A phone visitor sees the phone's pictures, so the text is
readable at its own size.

## Taking them again

From the checkout, after `pnpm install`:

```sh
bash stemcells/site/shots/rig/up.sh            # a lab home, fakes, two projects, the server
bash stemcells/site/shots/rig/seed.sh          # throws the Cells through the UI, settles four
bash stemcells/site/shots/rig/shoot.sh         # every picture, manifest.json, style.json
bash stemcells/site/shots/rig/down.sh --wipe   # stops the server by its PID, removes the lab
node stemcells/site/shots/place.mjs /tmp/stemcells-shots/app
```

- A full run takes about six minutes. `LAB` (default
  `/tmp/stemcells-shots/lab`), `OUT` (`/tmp/stemcells-shots/app`) and `PORT`
  (4517) can be set from the shell. `up.sh` builds the web app once if
  `apps/web/dist` is missing (about 300 MB, gitignored).
- The world moves one way: Flying, Input, Landed, Settled. `shoot.sh` takes
  its phases in that order (`flying input narrow landed settled shown
  fresh`), so a full retake starts from `down.sh --wipe`. `shoot.sh shown`
  and `shoot.sh fresh` can run again on a finished world;
  `ONLY=shown-wall bash …/shoot.sh shown` retakes one picture at both widths.
- The pages in the "shown" answers are real ones: `rig/pages.mjs` bundles
  `src/worlds/` into one page each, the scripted agent hands it to the
  server's own `html_render`, and the site plays the same shapes live where
  the app showed them. A change to a shape needs its picture retaken.
- `place.mjs` needs `cwebp`, and keeps the pictures a run did not take. It writes each picture as WebP (and at half
  size where it is a Mac's screen) and `src/shots.data.ts`: each picture's
  size and where things are on it, in CSS pixels.
- It starts no model and no provider CLI. Every provider in the lab home is
  a fake carrying the lab's mark (`stemcells/lab/fakes-only.cjs`); the
  scripted agent (`rig/agent.mjs`) plays `world.mjs` through the Replay
  provider, and the server runs on a scratch home that reads nothing of the
  person's.

## After a retake

- Look at every picture before it is committed: nothing private, no toast
  over the content. The word under a Cell at work and each Cell's creature
  are rolled by the app, so they change on every run.
- The camera's framings are in `src/shots.ts` and in each scene's staging.
  They hold while the app's layout does; check each scene at a desk's, a
  tablet's and a phone's width. One part is measured by hand: the line a
  phone's chat ends on once it is settled (`SAID` in `src/arc.ts`).
- `node stemcells/site/shots/rig/words.mjs` counts the words in each
  "shown" reply; the page's count is `WORDS` in `src/shots.ts`.

## Traps

- The Replay provider's question form has no field for an option's preview.
  The lab loads `rig/preview-hook.mjs`, which lets `_meta.preview` through
  as the server loads its form parser; no file in the repository changes.
  It says so on stderr if the parser has moved.
- A Cell must be started by typing in the composer. One started from the
  command line shows its first message folded, as if another agent wrote it.
- A toast about a feat slides in a few seconds after a Cell lands. The rig
  closes it before each picture.
- Below about 640px the left column is upstream's thread list, not our
  stage list, so the phone's pictures show one Cell to a tab with the
  column shut.
- A short reply cannot be scrolled higher than the app lays it: on a phone
  it starts 140 to 220px down the pane (`reply` in the manifest says where).
- The free-disk figure in the column is routed to a round disk, and the
  environment's name is set to "Mac".

## The app's look, as measured

The site's tokens (`src/site.css`) come from `style.json`, computed styles
read in the page:

| What                                       | Value                                               |
| ------------------------------------------ | --------------------------------------------------- |
| Page, pane surface, card, raised row       | `#000000`, `#0d0d0d`, `#151515`, `#181818`          |
| Border                                     | `#1e1e1e`, 1px                                      |
| Ink, muted                                 | `#f5f5f5`, `#818181`                                |
| Stage dots: Input, Flying, Landed, Settled | `#fdbe48`, `#8393ff`, `#2ad394`, `#818181`          |
| Radii                                      | 8, 12 and 16px                                      |
| Type                                       | the system's sans, 14px / 20px; mono `ui-monospace` |
