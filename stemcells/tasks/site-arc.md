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

- One grid of characters. Everything that is not Aski or a Cell is a
  **body**: a set of characters with a place and an ink. One body turns into
  the next by its characters travelling, never by a cut
  (`src/kit/bodies.ts`).
- The characters are drawn by one WebGL2 layer from a glyph atlas
  (`src/kit/glyphs.ts`), with a 2D canvas where WebGL2 is missing.
- Aski and the Cells stay the app's own (`src/app.ts`, `src/app-cells.ts`).
- A scene is pinned while its story is scrubbed by the scroll: every frame
  is a pure function of the scroll's progress and the clock
  (`src/kit/scenes.ts`). Reduce Motion gets each scene's still.
- Aski strolls along the foot of the page as it scrolls: where it stands
  is how far the story has come.

## The page

| Scene | Says | Shows |
| --- | --- | --- |
| Hero | Words become things | Aski at home; type a thought, it is thrown, flies and lands |
| The arc | Thrown until it lands | One Cell scrubbed along its arc: Flying, Input (one question), Landed, Settled, beside the app's own column |
| Shown | Shown, not told | A wall of text turns into a chart, a diagram, a choice and a close-out line |
| Becomes | It becomes what you need | A plain Cell grows what the work asks for; the workspace takes the shape of the work |
| Get it | Bring your own agents | The install lines, what it runs on, what it never sends |

## Plan

- [ ] Brand book: `stemcells/brand/book.md`
- [ ] Kit: glyph layer, bodies, scenes, form factors
- [ ] Hero
- [ ] The arc
- [ ] Shown
- [ ] Becomes
- [ ] Get it, the stroll, the 404 and `aski.txt`
- [ ] Phone, iPad and desktop passes; Reduce Motion; no WebGL
- [ ] A test that builds the site
- [ ] The readme says what the book says

## Review

Pending.
