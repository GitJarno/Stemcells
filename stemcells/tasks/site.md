# stemcells.sh, drawn by the app

The first site drew Aski and the Cells by hand, and got them wrong: apostrophe
eyes, a solid cloud, generic blobs. The site now plays the app's own canon,
bundled from `apps/web/src/stemcells/`, so it can't drift from the app again.

## How it's made

- `stemcells/site/build.mjs` bundles `src/main.ts` with vite-plus's `build`;
  the scenes, the painter, the Cells' art and their physics are imported from
  the app, never copied.
- `aski.txt` (what `curl stemcells.sh` prints) is Aski at rest from
  `cloudAtRest`, its eyes cut as holes, made at build time.
- Colour only where the app has it: ink for Aski, gold for the koi, each
  Cell's own body, amber only for "needs you". The one addition: characters a
  Cell gives back keep its colour on their way home, then fade into Aski's ink.
- Behind the hero, a dim field of things people ask their Cells for; now and
  then one lights up in a Cell's colour and flies home into Aski.

## Acts

- [x] Pipeline: bundle, CSP (`script-src 'self'`), the pond in the hero.
- [x] Hero: `the-pond` into Aski at home; blinks, eyes follow the pointer,
      its letters stir under it; a click plays another of its scenes (the
      rain, the pond again).
- [x] 01 One sentence in: type, send, the words pour in (`the-wait`),
      `the-bud` spells the task words into buds, and each bud becomes a Cell
      that drops to the ground and gets to work.
- [x] 02 Grow: one Cell dealt today's look, working alone while a clock runs,
      nubs to arms to biceps, then the flex.
- [x] 03 You make the calls: Aski throws, the Cells fly (`tossFrame`), two
      stick their landing; one falls short, bonks, and Aski asks you. Answer
      it and it lands.
- [x] 04 Nothing is lost: a landed Cell says its last words, comes apart into
      its characters in its colour, they fly home into Aski's skin and fade
      to ink, and Aski buds the next Cell from them.
- [x] Reduced motion holds each act's still; nothing runs out of sight.
- [x] Deploy from `stemcells/site`; the old local site folder retired.

## Review

- One canon: Aski, its eyes, the pond, the bud, the Cells' looks, growth and
  flight all come from the app's modules; `aski.txt` and the 404 too. A
  change to the app's Aski or Cells shows up on the next deploy.
- The hero loads 22 KB of script (gzipped); the Cells' art, 58 KB, loads with
  the acts after it. Every stage stops while out of sight, and Reduce Motion
  shows a still per act.
- An eye is a hole only over something: a character landing in Aski's eye
  turned it into a solid block, so characters land in its skin outside the
  eyes.
- Checked headless at desktop and phone sizes, with a click through act 03's
  question and a Reduce Motion load.
