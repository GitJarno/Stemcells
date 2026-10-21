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
lands is dealt; a scene that lands can be played.

## The tools

`stemcells/scripts/cells` runs from any worktree, with no dev server and no
build. It uses node's own TypeScript.

| Command | What it makes |
|---|---|
| `cells render <look> [scene…]` | `sheet.png`: every frame of each scene, at the miniature and the hero, on black and on light. Also one animated PNG per scene, size and frame |
| `cells pack <theme>` | A still sheet of every piece and outfit in a pack, at rest and cheering |
| `cells lookbook [theme…]` | `lookbook.html`: packs animated, outfits side by side. With no theme it shows every drawn pack |
| `cells crew [day] [count]` | `crew-<day>.png`: a crew in view dealt together on a day (`YYYY-MM-DD`, today by default), twelve Cells by default, at rest and cheering |
| `cells check [theme…]` | The rules below. Exits 1 on a failure. `--original` adds notes on the original's art |

A `<look>` is one of:
- `bare`;
- a curated look (`builder`);
- pack pieces (`gym/towel+gym/sweatband`);
- an outfit (`outfit:gym/athlete`), optionally in a colourway (`outfit:gym/athlete~sky`).

Options: `--body claude|codex|gemini|kimi|frost` and `--out <dir>`. Output
goes to `$TMPDIR/cells` by default, never into the repo.

A sheet is a PNG, so an agent can read it as an image. The lookbook is for
people: open it in a browser.

## Drawing

- **Draw for the miniature first, and judge it on both frames.** The 13 × 14
  miniature is the size people see most: tabs, pane headers, the phone.
- The hero is 32 × 32. The app draws the miniature's footprint of it, 26 × 28
  cells from (3, 2), at twice the density beside the composer. Keep anything
  that tells the piece inside that footprint.
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

### A pack: `art/packs/<theme>.json`

```json
{
  "theme": "workshop",
  "season": null,
  "about": "What the pack is, in a line.",
  "pieces": [
    { "name": "weldmask", "slot": "face", "eyes": true,
      "poses": { "building": "weldmask-down" },
      "art": ["…"], "hotspot": [7, 4], "mini": ["…"], "miniHotspot": [3, 2] },
    { "name": "weldmask-down", "slot": "face", "eyes": true, "posed": true,
      "art": ["…"], "hotspot": [7, 2], "mini": ["…"], "miniHotspot": [3, 1] },
    { "name": "toolbelt", "slot": "wrap",
      "art": ["…"], "hotspot": [11, 2], "mini": ["…"], "miniHotspot": [5, 1],
      "frames": [["…"], ["…"]], "miniFrames": [["…"], ["…"]], "fps": 4 }
  ],
  "fabrics": {
    "hivis": [{ "parts": ["torso"], "map": { "B": "Y", "b": "J" }, "rides": false,
                "rows": [24, 29], "miniRows": [10, 13] }],
    "hivis-orange": [{ "parts": ["torso"], "map": { "B": "3", "b": "R" }, "rides": false,
                       "rows": [24, 29], "miniRows": [10, 13] }]
  },
  "outfits": [
    { "id": "welder", "face": "workshop/weldmask", "wrap": "workshop/toolbelt",
      "fabric": "workshop/hivis",
      "colourways": [{ "id": "orange", "fabric": "workshop/hivis-orange" }],
      "cheer": "workshop/sparks", "silhouette": "mask", "family": "yellow" }
  ],
  "cheers": { "sparks": { "fps": 6, "facing": "right", "kind": "once", "tell": 1,
                          "frames": [{ "pose": { "eyes": "happy" } },
                                     { "pose": { "eyes": "happy", "base": 28 } }] } }
}
```

- **`season`** is one of:
  - `null`;
  - `{"from": "08-01", "to": "08-31"}` (MM-DD, inclusive, and it may wrap the
    new year);
  - for a feast that moves, `{"years": {"2027": ["02-06", "02-20"]}}`.
- **`slot`** names where the piece sits:

  | Slot | Anchor | Depth |
  |---|---|---|
  | `headwear` | the crown: hero (15, 14), mini (6, 6) at rest | z 3 |
  | `face` | the eyes: (15, 21) and (6, 9) | z 3 |
  | `wrap` | the ground: (15, 30) and (6, 14) | z 1: over the body, under the face and arms |
  | `back` | (15, 20) and (6, 10) | z −1: behind the body |

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
    curated look's (`knight`, `alien`, `dragon`).
  - `silhouette` (what it reads as at a glance) and `family` (its colour
    family) keep a crew apart. No two outfits in a pack share both.

### How a crew is dealt

The Cells in view are dealt together (`cell/looks.ts`, rules in
`stemcells/tasks/cell-outfits.md`):
- A pack with outfits deals each Cell one outfit, in one of its colourways;
  a pack without deals one piece.
- No two Cells in view wear the same silhouette or colour family while the
  catalogue lasts; past it, the least worn, in a colourway no other wearer
  has.
- A season's item is dealt first, being the day's; the theme's item takes
  the slots it leaves free, so a season outfit that leaves a slot free lets
  a Cell's own theme show beside it.
- A Cell keeps its look while it stays in view.

### A move set: `art/moves/<set>.json`

```json
{
  "scenes": {
    "editing/0": { "fps": 6, "facing": "right", "kind": "loop", "priority": 3,
                   "tier": "common", "lively": false, "tell": 1, "next": "idle",
                   "frames": [
                     { "pose": { "eyes": "focused", "arms": [{ "side": 1, "at": 0.5, "dx": 2, "dy": -1 }] },
                       "layers": [{ "art": ["…"], "attach": "handR", "hotspot": [0, 2], "z": 4,
                                    "mini": ["…"], "miniHotspot": [0, 1] }] }
                   ] }
  },
  "meta": { "idle": { "tell": 0, "kind": "loop" } }
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
  - `kind`: `loop`, `once` or `hold`;
  - `priority`: its rung on the ladder;
  - `tier`: `common`, `rare`, `legendary` or `secret`;
  - `lively`: it needs the lively token;
  - `tell`: the frame Reduce Motion holds, required;
  - `next`: the scene it hands back to;
  - `land`: frames to wait before a cut while in the air;
  - `stage`: how far a travelling move goes past the box;
  - `sound`: timed to sound, so it may run at 24 fps.
- **Holding a tool.** A scene that holds a tool sets `"holds": true` and
  `"held": "<tool>"`.
- **A second body** (a bud, a vesicle) is a layer drawn in the body's letters,
  so it wears the Cell's colours.
- **`meta`** adds meta to the original's scenes by name. Their frames stay as
  exported.

### A temperament: `art/temperaments/<id>.json`

```json
{ "id": "steady", "weight": 2,
  "breath": { "periodMs": 4200, "depthRows": 1 },
  "blink": { "windowMs": 4000, "shutMs": 150, "double": false },
  "noticeMs": 300, "gaze": [{ "look": [1, 0], "holdMs": 1200 }],
  "fidget": "idle",
  "beats": { "onIt": "idle", "landed": "happy", "needsYou": "waiting", "wake": "idle", "sleep": "asleep" } }
```

`fidget` and the `beats` name scenes.

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
  - a drawn move has a `tell` that is one of its frames, keeps the beat
    (12, or 24 with `sound`), and hands back to a real scene;
  - a temperament's weight is above 0, and its fidget and beats are scenes.
- **Warnings** (look, then decide):
  - art that falls off the canvas in some scene (the original's own hats do,
    in the plea's hop). A posed variant is probed only in the scenes it is
    worn in: its states' scenes, and `happy` when a cheer swaps it in;
  - a drawn scene whose marks leave the canvas.

Before a pack's pull request:
1. `cells check <theme>` passes.
2. `cells pack <theme>` and `cells lookbook <theme>` are attached for review.
3. The kit tests pass: `pnpm exec vp test run src/stemcells/cell`.
