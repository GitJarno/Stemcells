# Drawing Cell art

A Cell is drawn from data: role letters in grids, painted by a palette, put
together by a rig and a compositor (`apps/web/src/stemcells/cell/`). The art
comes from two places:

- `cell/kit/` is the original app's art and moves, exported from its sources.
  It is the reference. Never edit it by hand.
- `cell/art/` holds what is drawn for Stemcells: `packs/`, `moves/` and
  `temperaments/`, one JSON file per pack, move set or temperament. Agents
  drawing in parallel never share a file.

Every file under `cell/art/` joins the kit when the app starts. A pack that
lands is worn; a scene that lands can be played.

## The tools

`stemcells/scripts/cells` runs from any worktree, with no dev server and no
build. It uses node's own TypeScript.

| Command                        | What it makes                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `cells render <look> [scene…]` | `sheet.png`: every frame of each scene, at the miniature and the hero, on black and on light. Also one animated PNG per scene, size and frame  |
| `cells pack <theme>`           | A still sheet of every piece and outfit in a pack, at rest and cheering                                                                        |
| `cells lookbook [theme…]`      | `lookbook.html`: packs animated, outfits side by side. With no theme it shows every drawn pack                                                 |
| `cells crew [day] [count]`     | `crew-<day>.png`: a crew in view dealt together on a day (`YYYY-MM-DD`, today by default), twelve Cells by default, at rest and cheering       |
| `cells cast [name…]`           | `cast.png`: the Cells' own looks by name, at rest and landed. Every name by default; a name with no look is drawn bare and marked `none`       |
| `cells manner [temperament…]`  | `manner-<look>.png`: each temperament's rest (a picture a hold) and its beats frame by frame, at both sizes. `--look <look>`, `--ground light` |
| `cells check [theme…]`         | The rules below. Exits 1 on a failure. `--original` adds notes on the original's art                                                           |

A `<look>` is one of:

- `bare`;
- a curated look (`builder`);
- pack pieces (`gym/towel+gym/sweatband`);
- an outfit (`outfit:gym/athlete`), optionally in a colourway (`outfit:gym/athlete~sky`).

Any of them can be grown to a strength (`bare@arms`) and flex for its cheer
(`bare@biceps:flex`).

Options: `--body claude|codex|gemini|kimi|frost` and `--out <dir>`. Output
goes to `$TMPDIR/cells` by default, never into the repo.

A sheet is a PNG, so an agent can read it as an image. The lookbook is for
people: open it in a browser.

## Drawing

- **Draw for the miniature first, and judge it on both frames.** The 13 × 14
  miniature is the size people see most: tabs, pane headers, the phone.
- The hero is 32 × 32. The miniature's footprint of it, 26 × 28 cells from
  (3, 2), is the Cell's box: what lays it out. A 2× display draws the hero at
  twice the density, in tabs and beside the composer alike, with a margin
  past the box to the hero grid's edges (`MARGIN` in `scene.ts`: two cells of
  the miniature each side, one above and below), where the original's widest
  pieces reach. Keep anything drawn here inside the box; the margin is the
  original's.
- **Letters are roles, not colours.**
  - `B b L O` are the body (fill, shade, highlight, contour), painted in the
    provider's colours. Never use them for a piece unless it is the body,
    like a bud.
  - Every other letter is an ink from `kit/palette.json`.
  - Fabrics come in pairs (fill, shade). Light or signal fabrics may face the
    void: sunflower `Y/J`, bubblegum `I/i`, lilac `l/v`, sky `S/d`, pearl
    `p/q`, lime `A/a`, aqua `Q/x`, washed denim `1/2`. Deep ones go only
    against the body: crimson `N/m`, midnight `w/c`, cocoa `Z/j`.
  - `4` is charcoal felt, a black that still shows on black.
  - Ask before adding an ink.
- **The three rules of a legible piece**, from the original:
  1. The front of the box is the face. It has no mouth at rest, so anything
     stamped under the eyes reads as a mouth or a moustache. Clothing is
     fabric (a dye on the body's own cells), or it changes the outline.
  2. Light faces the void, and deep meets the body.
  3. One eye stays visible, so a blink, `! !` and the moods still read,
     unless the piece is the eyes.
- **A posed piece frees the eyes whenever the face carries state.** A
  welder's mask comes down only while the Cell builds: draw it up, and give
  it `"poses": {"building": "mask-down"}`.
- **The back slot reads above the shoulders.** The body fills the miniature's
  width from row 10 down, so a back piece shows only where it rises over the
  crown or past the narrow top: arrows, a towel's end, wings. A cape shows a
  hem and nothing more.
- **Identity lives in width, shape and colour, not height.** The miniature has
  only rows 0–3 above the crown.
- **The light frame.** The light frame draws a one-cell charcoal keyline
  outside every pale piece cell that faces the void, in the tools and in the
  app while it is drawn light. Don't redraw a piece for the light frame. Do
  check the keylined render reads.
- **Cultural packs.** Use only the objects of the celebration: flowers,
  lanterns, food, kites. Nothing sacred, and no costume of a people. A pack
  is one event, named plainly and dated from its own calendar. Each piece's
  `about` says what it is and where it is worn.

## Formats

A new file under `art/` is imported by name in `art.ts`, so the phone's
bundler has it too; `art.test.ts` fails until it is.

### A pack: `art/packs/<theme>.json`

```json
{
  "theme": "workshop",
  "season": null,
  "about": "What the pack is, in a line.",
  "pieces": [
    {
      "name": "weldmask",
      "slot": "face",
      "eyes": true,
      "poses": { "building": "weldmask-down" },
      "art": ["…"],
      "hotspot": [7, 4],
      "mini": ["…"],
      "miniHotspot": [3, 2]
    },
    {
      "name": "weldmask-down",
      "slot": "face",
      "eyes": true,
      "posed": true,
      "art": ["…"],
      "hotspot": [7, 2],
      "mini": ["…"],
      "miniHotspot": [3, 1]
    },
    {
      "name": "toolbelt",
      "slot": "wrap",
      "art": ["…"],
      "hotspot": [11, 2],
      "mini": ["…"],
      "miniHotspot": [5, 1],
      "frames": [["…"], ["…"]],
      "miniFrames": [["…"], ["…"]],
      "fps": 4
    }
  ],
  "fabrics": {
    "hivis": [
      {
        "parts": ["torso"],
        "map": { "B": "Y", "b": "J" },
        "rides": false,
        "rows": [24, 29],
        "miniRows": [10, 13]
      }
    ],
    "hivis-orange": [
      {
        "parts": ["torso"],
        "map": { "B": "3", "b": "R" },
        "rides": false,
        "rows": [24, 29],
        "miniRows": [10, 13]
      }
    ]
  },
  "outfits": [
    {
      "id": "welder",
      "face": "workshop/weldmask",
      "wrap": "workshop/toolbelt",
      "fabric": "workshop/hivis",
      "colourways": [{ "id": "orange", "fabric": "workshop/hivis-orange" }],
      "cheer": "workshop/sparks",
      "silhouette": "mask",
      "family": "yellow"
    }
  ],
  "cheers": {
    "sparks": {
      "fps": 6,
      "facing": "right",
      "kind": "once",
      "tell": 1,
      "frames": [{ "pose": { "eyes": "happy" } }, { "pose": { "eyes": "happy", "base": 28 } }]
    }
  }
}
```

- **`season`** is one of:
  - `null`;
  - `{"from": "08-01", "to": "08-31"}` (MM-DD, inclusive, and it may wrap the
    new year). A window over twenty days may name its `"feast": ["12-20",
    "12-26"]`, the days inside it every Cell dresses for;
  - for a feast that moves, `{"years": {"2027": ["02-06", "02-20"]}}`.
- **`"cast": true`** marks a pack of the Cells' own looks. Each outfit's `id`
  is a Cell's name in lower case (`stemcells/words/cellNames.json`), and that
  Cell wears it every day. A cast look is one silhouette piece and at most
  one supporting piece, and has a cheer only where the cheer is the joke:
  without one, a landing plays the Cell's temperament.
- **`slot`** names where the piece sits:

  | Slot       | Anchor                                        | Depth                                       |
  | ---------- | --------------------------------------------- | ------------------------------------------- |
  | `headwear` | the crown: hero (15, 14), mini (6, 6) at rest | z 3                                         |
  | `face`     | the eyes: (15, 21) and (6, 9)                 | z 3                                         |
  | `wrap`     | the ground: (15, 30) and (6, 14)              | z 1: over the body, under the face and arms |
  | `back`     | (15, 20) and (6, 10)                          | z −1: behind the body                       |

  `z` overrides the depth. Headwear, and a back piece that rises above the
  crown, hold the Cell's hop and stretch down so they stay on the canvas.

- **`hotspot`** is the cell of the art that lands on the anchor.
- **`frames`** is the whole hero cycle, starting with `art`. `miniFrames`
  matches it, and `fps` divides 12. A scene folds the cycle into its own
  clock. The first frame is the still, so make it the most telling.
- **`poses`** maps a state (a scene's name before its `/`: `building`,
  `waiting`, `happy`) to a piece of the same pack worn in its place. Mark the
  variant `"posed": true` so it is never dealt alone. `"eyes": true` marks a
  piece that is the eyes.
- **Fabrics** dye the body's own roles (`map`) in row bands. Hero rows count
  from the top of the 32-row grid, mini rows from the top of the 14-row grid.
  `rides: true` moves the band with the breath; otherwise it counts from the
  ground. A fabric is its list of bands, or `{"about": "…", "bands": […]}`
  to say what it is.
- **An outfit** is dealt as one. It fills the slots `headwear`, `face`,
  `wrap` and `back`, plus a `fabric`.
  - A slot names a pack piece by id (`theme/piece`), from any pack.
  - It may instead name a piece of the original's library: headwear such as
    `helm` or `wizard`, a face piece such as `specs`.
  - `outfit` wears one of the original's outfits, with its fabric and trim
    (`plate`, `dungarees`, `wings`).
  - Reuse the original's art where it exists, rather than redrawing it.
  - A pack's `fabric` dyes over a library outfit's.
  - It lists two or three `colourways`, each a fabric of its own. Colourways
    are fabric only: the body stays the provider's colour.
  - Its `cheer` plays when a turn lands: a pack's (`theme/cheer`), or a
    curated look's (`knight`, `alien`, `dragon`). It plays once, from its
    first frame, the moment the turn lands; then the Cell rests with `^ ^`
    until the cheer's six seconds are up. So start it at or near rest, and
    end it on the rest pose with `"eyes": "happy"`.
  - `silhouette` (what it reads as at a glance) and `family` (its colour
    family) keep a crew apart. No two outfits in a pack share both.

### How a crew is dealt

What a Cell wears is worked out from its chat's id and the day, the same on
every screen (`cell/looks.ts`, the reasons in `stemcells/tasks/cell-cast.md`):

- **Its own look, every day.** A Cell wears the look drawn for its name: the
  Cell named Fox wears the fox hood. Two Cells of one name in view wear the
  look's colourways apart, while it has any.
- **A season is dress-up days.** A window of twenty days or fewer is a feast
  whole, and so are a longer window's named `feast` days: every Cell dresses
  for it. Through the rest of a longer season a Cell dresses for it one day
  in three, on days of its own.
- **Dressed for the season**, a Cell wears the season's outfit in place of
  its own look: an outfit is a whole look. A season pack with no outfits
  deals one piece, and the Cell's own look keeps the slots the piece leaves
  free.
- **No two alike in a season.** The Cells in view that dress for it are dealt
  together: no two wear the same silhouette or colour family while the
  catalogue lasts; past it, the least worn, in a colourway no other wearer
  has.
- A Cell keeps the item and colourways it wears while it stays in view.

### A move set: `art/moves/<set>.json`

```json
{
  "scenes": {
    "editing/0": {
      "fps": 6,
      "facing": "right",
      "kind": "loop",
      "priority": 3,
      "tier": "common",
      "lively": false,
      "tell": 1,
      "next": "idle",
      "frames": [
        {
          "pose": { "eyes": "focused", "arms": [{ "side": 1, "at": 0.5, "dx": 2, "dy": -1 }] },
          "layers": [
            {
              "art": ["…"],
              "attach": "handR",
              "hotspot": [0, 2],
              "z": 4,
              "mini": ["…"],
              "miniHotspot": [0, 1]
            }
          ]
        }
      ]
    }
  },
  "meta": { "idle": { "tell": 0, "kind": "loop" } },
  "strength": { "arms": { "at": 0.5, "dx": 3, "dy": 2 } }
}
```

- **A frame** is a pose (the rig's fields; anything left out stays at rest)
  plus the marks and props it adds (`layers`, drawn inline). It may also
  carry:
  - `swaps`: a worn piece, in any slot, shown as its posed variant;
  - `hidden: true`: the Cell is gone for the frame (a vanish). Its body and
    what it wears aren't drawn; the frame's layers are, on the anchors it
    would stand on;
  - `dx`, for a move that travels: how far the Cell stands from its place,
    in hero cells. The tools draw it; the app holds the Cell in its place
    until a stage gives it room to travel.
- **The move's meta:**
  - `kind`: `loop`, `once` or `hold`. A state's scene loops on the wall
    clock: Cells at work or asking in step, a Cell at rest, landed or
    asleep on a phase of its own. A moment (a landing's cheer, a
    temperament's beats) plays once from the frame it began on, then the
    state's scene holds (`cell/cast.ts`, `entering`);
  - `priority`: its rung on the ladder;
  - `tier`: `common`, `rare`, `legendary` or `secret`;
  - `lively`: it needs the lively token;
  - `tell`: the frame Reduce Motion holds, required;
  - `next`: the scene it hands back to;
  - `land`: frames to wait before a cut while in the air;
  - `stage`: how far a travelling move goes past the box;
  - `sound`: timed to sound, so it may run at 24 fps;
  - `ownArms`: the layers of its frames draw the Cell's arms (the gym's
    flex), so a strong Cell's arms stand aside in the frames that have
    layers.
- **Holding a tool.** A scene that holds a tool sets `"holds": true` and
  `"held": "<tool>"`.
- **A second body** (a bud, a vesicle) is a layer drawn in the body's letters,
  so it wears the Cell's colours.
- **The buds** stand on a stage of their own: a box the size of the Cell's,
  just past it, where the Cell is given room (the composer's line; not a
  tab). Their scenes are frames with the Cell `hidden` and the buds as
  layers on its `ground`: `bud/1` and `bud/2` stand one or two, and
  `bud/out/1` and `bud/out/2` step the next one out of the Cell's side, the
  step home being the same frames backwards (`cell/buds.ts`). Stepping out
  leaves the box on purpose, so `check` warns on those two. The app draws
  none of the bud art. It reads only where each layer stands, then draws
  that bud's Subcell there at half the Cell's size (`SubcellMark`). So a
  bud layer's centre and feet are what count, and a layer's place in a
  frame is matched to a bud by how near the Cell it stands in the first
  frame.
- **`meta`** adds meta to the original's scenes by name. Their frames stay as
  exported.
- **`strength`** (`growth.json`) is the arm a Cell holds at rest once it has
  grown (`stemcells/tasks/cell-growth.md`): `nubs`, `arms` and `biceps`, each
  a rig arm with no `side`. The arm stands on each side a frame leaves free
  and no tool in hand takes. `bulge` gives an arm rows of biceps, lit on top;
  a Cell with biceps bulges in every arm a move shows. The arms reach past
  the box into the margin a display draws, as the original's own arms do.
- **`diff`** (`marks.json`) is the `+` and `−` a landing's cheer raises when
  its run added or removed lines (`stemcells/tasks/cell-diff-marks.md`).
  `added` and `removed` are each a mark: its `art` with its top-left cell
  `at` on the hero grid, and its `mini` with `miniAt` on the miniature's.
  They stand on the box, not the body, and are drawn over the frame
  (`cell/marks.ts`). `rise` lifts both by that many hero rows (half as many
  at the miniature) on each beat of the sprite clock from the landing; past
  the last they are gone, once a landing.
- **`form/hop`** (`form.json`) is the hop a Cell lands on its line with as
  it forms (`stemcells/docs/interaction.md`, the spawn). Its first frame,
  the crouch, is also the outline its blocks fill; every frame stays inside
  the box. One frame a beat of the sprite clock.
- **`toss/walk`** (`toss.json`) is the scoot a thrown Cell walks home in
  (`stemcells/docs/interaction.md`, the toss): the original's gait, its
  crown reaching ahead and its base sliding under it, facing left and
  mirrored to go right. A gait leans past the box on purpose, so `check`
  warns on it. Its other poses come from springs, not frames
  (`cell/toss.ts`).

### A temperament: `art/temperaments/<id>.json`

How a Cell carries itself between moves. Each Cell is dealt one for life from
its name (`cell/manner.ts`), apart from its look; the design is in
`stemcells/tasks/cell-life.md`, Temperament.

```json
{
  "id": "nosy",
  "weight": 1,
  "breath": { "periodMs": 4000, "depthRows": 1 },
  "blink": { "windowMs": 4000, "shutMs": 150, "double": true },
  "noticeMs": 80,
  "gaze": [
    { "look": [0, 0], "holdMs": 5000 },
    { "look": [1, 0], "holdMs": 1330 }
  ],
  "fidget": "fidget/nosy",
  "beats": {
    "onIt": "onIt/nosy",
    "landed": "landed/nosy",
    "needsYou": "needsYou/nosy",
    "wake": "wake",
    "sleep": "yawn"
  }
}
```

- **`breath`** is its rest: one row down for a share of each period
  (`outShare`, a third unless told); `puff` swells it a row at the top.
- **`blink`** is once a window, at a moment its name picks; `double` blinks
  twice in one window of three.
- **`gaze`** is where it looks at rest, a cycle in order (`[0, 0]` is ahead),
  rounded out to whole breaths. Leave it empty to look ahead.
- The rest is made from these, not drawn: `rest/<id>`, and `pleased/<id>`
  (the same breath with `^ ^`, held after a landing's cheer). Both are scenes
  the tools draw. Each Cell stands at its own place in its rest, so a crew
  never breathes as one.
- **`beats`** name the scenes it enters a moment with, each played once:
  - `onIt` when a send is taken up;
  - `landed` when a turn lands and its look has no cheer of its own;
  - `wake` and `sleep` when it wakes and when it goes cold.
  - `needsYou` is the loop it waits on you in (the body only: the plea's face
    and the caret blink are every Cell's).

  A beat left out plays as every Cell's (`happy`, `waiting`).

- **`noticeMs`** is how long it holds a moment's first frame before it moves.
- **`fidget`** is a scene it plays at rest, about once in six minutes, and
  only while the person has moved the pointer or typed in the last minute.
- A beat starts and ends at rest, and never borrows a state's face: `! !`,
  `x x` and `- -` stay what they mean, and `^ ^` is for a landing.

## The rules `check` holds

These hold on drawn art. On the original's art they are notes.

- **The original's rules**, at rest, at both sizes, with the calm and the open
  face:
  - every letter is a known role;
  - every cell is inside 32 × 32 and 13 × 14;
  - one eye is left whole (a posed variant worn only at work is exempt);
  - no cell beside empty space is dark on black (luma under 40);
  - a headwear or back piece stamps nothing in the mouth zone (hero rows
    19–23 × columns 11–20, mini rows 9–11 × 4–8). Face pieces are the face's
    own, and wraps are the trousers.
- **Contrast.** Under half of a piece's outline is below 1.6 : 1 against
  black, and against light after the keyline.
- **Data:**
  - hero and mini frames match;
  - a cycle's fps divides 12;
  - `poses`, outfit pieces, fabrics and cheers name things that exist;
  - seasons are real windows;
  - outfits in a pack differ in silhouette or family;
  - a cast look is named for a Cell's name, no name has two, no two cast
    looks share both silhouette and family, and (with no theme named) every
    name has one;
  - a drawn move has a `tell` that is one of its frames, keeps the beat
    (12, or 24 with `sound`), and hands back to a real scene;
  - a temperament's weight is above 0, its breath takes a second or more, its
    blink fits its window, and its fidget and beats are scenes.
- **The box.** A piece drawn here, worn alone at rest, keeps inside the
  miniature's footprint on the hero (26 × 28 from (3, 2)): the margin a 2×
  display draws past it is the original's, whose pieces reach there, drawn for
  its larger stage, and stay as ported.
- **Warnings** (look, then decide):
  - art that falls off the canvas in some scene (the original's own hats do,
    in the plea's hop). A posed variant is probed only in the scenes it is
    worn in: its states' scenes, and `happy` when a cheer swaps it in;
  - a drawn scene whose marks leave the canvas or, at the hero, the
    miniature's footprint: the box, which drawn art keeps inside.

Before a pack's pull request:

1. `cells check <theme>` passes.
2. `cells pack <theme>` and `cells lookbook <theme>` are attached for review.
3. The kit tests pass: `pnpm exec vp test run src/stemcells/cell`.
