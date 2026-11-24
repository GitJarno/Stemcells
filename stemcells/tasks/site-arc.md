# stemcells.sh, told as one throw

The first rebuild (`site.md`) made the page draw with the app's own Aski and
Cells. This one changes what the page says and how it is staged: the brand
book (`stemcells/brand/book.md`) comes first, and the page is that book
acted out.

## Why

- The page led with "Aski divides the work". The model a person actually
  uses is the throw: every ask is thrown, flies, and lands or falls short;
  then it is settled. The page now teaches that, in the app's own four
  stage words.
- It said nothing about how Stemcells talks to a person (a chart, a
  diagram, a preview, one question), or about the tool taking the shape of
  the person's work.
- It was a desktop page that shrank. Phone, iPad and desktop now each get
  their own staging and gestures over one system.
- It no longer built: an app export it imported had been removed, and
  nothing checked the site. A test now builds it.

## The system

- Two materials, as the book has it: words are characters, things are
  solid. What is still an idea (prose, words in flight, a trail) is a
  **body** of characters (`src/kit/bodies.ts`); what has become a thing (a
  window, a chart, a card, a machine) is drawn clean on a 2D canvas, and the
  characters travel into it.
- The characters are drawn by one WebGL2 layer from a glyph atlas
  (`src/kit/glyphs.ts`), with a 2D canvas where WebGL2 is missing.
- Aski and the Cells stay the app's own (`src/app.ts`, `src/app-cells.ts`).
- A scene is pinned while its story is scrubbed by the scroll: every frame
  is a pure function of the scroll's progress and the clock
  (`src/kit/scenes.ts`). Reduce Motion gets each scene's still.
- Aski strolls along the foot of the page as it scrolls: where it stands
  is how far the story has come.

## The page

| Scene    | Says                               | Shows                                                                                                      |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hero     | Words become things                | Aski at home; type a thought, it is thrown, flies and lands; pick a Cell up and throw it                   |
| The arc  | Thrown until it lands              | One Cell scrubbed along its arc: Flying, Input (one question with previews), Landed, Settled               |
| Shown    | Agents write walls                 | A wall of text turns into a chart, a diagram, a choice and one closing line; a count of words left to read |
| Becomes  | It becomes what you need           | A plain Cell grows nubs, arms, biceps; a window goes from one chat to a crew to a phone                    |
| Machines | One crew, on every machine you own | Six machines in depth; Cells thrown from the one in your hand to the far ones; every screen says the same  |
| Get it   | Bring your own agents              | "a thought" turns into the three install lines                                                             |

Each scene is staged apart for a desk, a tablet and a phone: the stage list
is the Mac's column on a desk and the phone's four tabs in a hand, the
machine "in your hand" in the last scene is the one the visitor holds, and
the window scene ends on the other device.

## Plan

- [x] Brand book: `stemcells/brand/book.md`
- [x] Kit: glyph layer, bodies, scenes, form factors
- [x] Hero
- [x] The arc
- [x] Shown
- [x] Becomes
- [x] Machines
- [x] Get it, the stroll, the 404 and `aski.txt`
- [x] Phone, iPad and desktop passes; Reduce Motion; no WebGL
- [x] A test that builds the site
- [x] The readme says what the book says

## Review

- The page says the book's five ideas in six scenes, and each scene is one
  picture with one short sentence. The first draft said too much in words and
  drew everything in characters; both were cut back. The rule that came out
  of it is the book's: words are characters, things are solid.
- Checked by eye at 1440×900, 834×1194, 393×852 and 320×568, with Reduce
  Motion and without WebGL2. A short phone drops each scene's sentence so the
  picture keeps its room.
- An independent review found six real problems (a claim too broad, the
  hero's own typing writing over a visitor's, Reduce Motion ignoring Return,
  a button reachable while hidden, three collisions on the smallest phone).
  All are fixed.
- The site uses the app's own Aski, eyes included; when the eyes change in
  the app, the site follows at its next build.
- Left for later: the page's second chunk is about 130 KB gzipped, most of it
  the app's Cell painter. It loads after the hero, so the first paint doesn't
  wait for it.
