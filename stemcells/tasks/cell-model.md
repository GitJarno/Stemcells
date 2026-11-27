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

- **One body that grows.** `grown` runs from a newborn mochi (today's
  silhouette: a dome widest where it sits) to a figure with a head, arms
  and feet. It faces front unless something turns it. A Cell's growth is
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
   - **On the phone** (done). The Cell heading a chat, on the hero art's
     own grid (34 × 32), so a pixel of it is a pixel of the old Cell. The
     switch is kept in a file of the phone's own. The phone reads no
     strength yet, so every Cell there is drawn as it is born.
3. **The wardrobe.**
   - **What a Cell wore, it wears** (done). The drawn pieces are stamped on
     the model's picture where its head stands (`model/worn.ts`), in whole
     pixels of the picture, so every piece there is carries over at once.
   - **Then.** Fabrics and an outfit's colours, a tool in the hand, pieces
     that move; pieces as shapes of the model, pack by pack, where a stamp
     shows its flatness (most headwear is a shape turned round its axis).
     The dressing room on a turning stage.
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
- [x] Checks, pull request, merge

## Steps (slice 2, the phone)

- [x] A painter from a picture to the phone's drawing (`figure.ts`)
- [x] `CellModelFigure`, the switch in a kept file, its row under the wardrobe
- [x] Speed measured on the phone's engine
- [x] Seen on a simulator: at rest, through a Replay turn, the switch both ways
- [x] Checks, pull request, merge

## Steps (slice 3, what it wore)

- [x] `model/worn.ts`: where the head stands in a picture, a piece stamped
      there, room over the picture for a tall one
- [x] Both figures wear the Cell's look; the switch's words say so
- [x] Seen: sheets at the phone's size and the Mac's, each growth; the Mac's
      built app on a lab home
- [ ] Seen on a phone
- [x] Checks, pull request, merge

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

Slice 2 on the phone: on an iPhone Duo simulator the Cell stood in the
chat's header, pulled its laptop out as a Replay turn began and was glad at
the landing, and the switch brought the old figure back. A picture takes
13 to 17 ms on Hermes (the Mac's browser: 1.1 ms at this size), about one a
second at rest and up to twelve while a part moves. That is fine for the one
Cell heading a chat and too slow for a list of them: rows need pictures kept
per act (slice 4). Still open on the phone: reading a Cell's strength, so
it grows as the Mac's does; a tap on it is not yet answered by the model.

Slice 3, what it wore: a stamp was enough. A piece keeps its drawn pixels,
doubled on the Mac's 64 rows, and follows the head through a hop and a
turn of the face; a back piece shows only past the body. Left bare: a
fabric or an outfit's dye (a knight's plate stays the body's colour), what
a hand held (the model has its laptop), and a moving piece stands at its
first frame. Not seen on a phone: no simulator was free that day.

The person, seeing it on the phone: it stood side-on, and it was an egg, not
the mochi a Cell is. So a Cell faces front by default (a turn is for a
reason, such as another Cell), and the newborn is widest at its foot with a
nearly flat underside. Its laptop then stands between it and the viewer,
lid's back out, its eyes over it.
