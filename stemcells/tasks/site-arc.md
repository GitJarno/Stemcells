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

## What upstream's page does well

The first pass drew the app: windows, charts and machines as clean outlines.
It read as a mock-up. T3 Code's own landing page was the lesson in
presentation:

- The product is the picture. The real window sits right under the claim,
  and every feature section shows real UI.
- One claim, one sentence, one button a screen. A visitor skims it in
  fifteen seconds.
- Plain type, hairlines, a lot of air.

We took those, and kept what is ours: Aski and the Cells are alive on the
page, the throw is playable, and the scroll plays each idea.

## The system

- **The app is shown as itself.** `public/app/` holds real screens of the
  app, taken in a lab with made-up work (`shots/README.md`); `src/shots.ts`
  says where things are on each. An exhibit (`src/kit/exhibit.ts`) is those
  screens in a window's frame: they turn into each other in place, a camera
  moves over them and a spotlight says where to look.
- **Creatures stand on things.** A window's top edge is the ground Aski and
  the Cells stand on, in the hero and in every scene.
- **Words are characters.** What is still an idea (words in flight, a trail)
  is a body of characters (`src/kit/bodies.ts`), drawn by one WebGL2 layer
  from a glyph atlas (`src/kit/glyphs.ts`), with a 2D canvas where WebGL2 is
  missing.
- The page reads in the app's own type and the stages wear the app's own
  colours. Aski and the Cells stay the app's own (`src/app.ts`,
  `src/app-cells.ts`).
- A scene is pinned while its story is scrubbed by the scroll: every frame
  is a pure function of the scroll's progress and the clock
  (`src/kit/scenes.ts`). Reduce Motion gets each scene's still.
- Aski strolls along the foot of the page as it scrolls: where it stands
  is how far the story has come.

## The page

| Scene    | Says                               | Shows                                                                                                          |
| -------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Hero     | Words become things                | Aski on the app's window; type a thought, it is thrown and lands on the window; pick a Cell up and throw it    |
| The arc  | Thrown until it lands              | A Cell flies along the window's top edge while the window shows each stage: Flying, Input, Landed, Settled     |
| Shown    | Agents write walls                 | A real reply as a wall of text is wiped into the same answer as a chart, then a diagram, a choice, one line    |
| Becomes  | It becomes what you need           | A Cell grows nubs, arms, biceps on the window; the window goes from one chat to two to a crew, a Cell for each |
| Machines | One crew, on every machine you own | Laptop, tablet and phone each showing the app as it looks there; Cells thrown to the far Macs; one asks        |
| Get it   | Bring your own agents              | "a thought" turns into the three install lines; a Cell in each provider's colours lands on them                |

Each scene is staged apart for a desk, a tablet and a phone: a desk shows
the whole window with a spotlight, a phone sends the camera to the part that
counts; the stage list is the Mac's column on a desk and the phone's four
tabs in a hand; the machine "in your hand" is the one the visitor holds.

## Plan

- [x] Brand book: `stemcells/brand/book.md`
- [x] Kit: glyph layer, bodies, scenes, form factors
- [x] Hero, the arc, shown, becomes, machines, get it, the stroll
- [x] A test that builds the site
- [x] The readme says what the book says
- [x] Study upstream's page; rebuild every scene on real screens (`exhibit.ts`)
- [ ] The real screens: taken in the lab, placed, checked for anything private
- [ ] Phone, iPad and desktop passes on the real screens; Reduce Motion
- [ ] The phone app's own screens (needs a simulator; the phone and tablet show the app in a browser until then)

## Review

Pending.
