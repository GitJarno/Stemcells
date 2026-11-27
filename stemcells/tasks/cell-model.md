# The Cell, modelled

A Cell is a pixel sprite put together from frames drawn by hand: every move
is a list of frames, every piece is art at two sizes, and a new move times a
new piece is more drawing. The art reads well; making more of it is the
limit, and it only ever faces front.

This keeps the pixel look and changes where the pixels come from. A Cell
becomes a small 3D model, a handful of soft shapes posed by springs, and each
picture of it is that model drawn as pixel art: three tones and a gloss with
shifted hues, a darker pixel where one part passes another, an outline, and
eyes set on whole pixels. A pose, an angle, a size or a piece is then data,
never a sheet of frames.

The person chose the look from a living prototype: 64 pixels tall where
there is room ("hi-bit"), 32 in rows, 16 in the smallest places, twelve
pictures a second.

## The design

- **One body that grows.** `grown` runs from a newborn mound (today's
  silhouette) to a figure with a head, arms and feet. A Cell's growth is
  already a fact (`cell-growth.md`); here it shapes the body itself.
- **The laptop is its desk.** Sent to work, it pulls a laptop out, flips it
  open and lifts off: in the air with the screen lit is Flying. Thinking is
  hands off and eyes up; writing is hands on the keys and lines running up
  the screen. Asking, it comes down, half shuts the lid and waves. Landed,
  it shuts the lid, puts it away and hops.
- **Springs, not frames.** An act names where each part should be; the
  body gets there with its own weight. Twelve pictures a second are taken
  of it, so it still moves like pixel art.
- **Pieces are shapes on the body's own places** (the head, the neck, the
  back), so a piece fits every pose, every angle and every growth.
- **Each place draws its own size.** A 16-pixel Cell is drawn for 16
  pixels, framed on its face; nothing is a big picture shrunk.
- **Pure TypeScript on the CPU**, free of the DOM, so the Mac, the phone
  and the art tools share it as they share the kit.

## Slices

1. **The model** (this change). `cell/model/`: shapes and their distance
   field, the body from a pose, the sprite, the acts. `cells model` draws
   its sheet and a whole turn. No surface changes.
2. **A place to see it.** Behind a switch, off by default (Settings ›
   Collection › Cells): the Cell over the composer is drawn from the model,
   fed by the same mood, activity and strength as today.
   - **On the Mac** (done). An edit is written, other work is watched,
     thought is hands off; strength grows the body. A picture is taken only
     when the pose moved half a pixel.
   - **On the phone** (next). It has no store of its own for a switch, no
     painter for a picture in full colour, and its engine has no JIT, so
     its speed has to be measured on a device first; a row there may need
     pictures kept per act, as the kit keeps frames.
3. **The wardrobe.** Today's pieces as model pieces, pack by pack; first
   try lifting the drawn ones (most headwear is a shape turned round its
   axis). The dressing room on a turning stage.
4. **Everywhere, and the old frames go.** Rows, tabs, the Island and the
   Watch from the same model; the chat's live edge; Cells that turn to
   each other.

## Steps (slice 1)

- [x] Prototype, and the person's choice of look
- [x] `shapes.ts`, `tones.ts`, `body.ts`, `sprite.ts`, `acts.ts`
- [x] `cells model`: the sheet and a turn
- [x] Tests: eyes at every size and clear of the lid, the outline, nothing
      cut off, each act's shape
- [x] Checks, pull request, merge

## Steps (slice 2, the Mac)

- [x] Acts for watched work and sleep; a picture only when the pose moved
- [x] `model/stance.ts`: mood, activity, strength and provider as act,
      growth and colour
- [x] `CellModelFigure`, the switch, its row in Settings
- [x] Seen in the built app on a lab home, a Replay chat through a turn
- [ ] Checks, pull request, merge

## Review

Slice 1 landed as planned, with no surface changed. The tests earned their
keep at once: they caught a cheering Cell's hands cut off at the top of the
picture, which the prototype had too. Measured in node on the Mac, a picture
takes 4.9 ms at 64 rows, 1.1 ms at 32 and 0.3 ms at 16 (a grown Cell with
headphones and a backpack). The phone is unmeasured; slice 2 starts there.

Slice 2 on the Mac: in the built app the Cell stood on the composer's roof in
its old box (a 68 × 64 picture in 34 × 32 points), pulled its laptop out as
the turn began, shut it and cheered at the landing, and the switch brought
the old figure back at once. Over a 45-second turn it took 102 pictures
where the clock beat 540 times. Not yet measured: its cost on the main
thread with several chats streaming, which decides whether drawing moves to
a worker before the switch defaults to on.
