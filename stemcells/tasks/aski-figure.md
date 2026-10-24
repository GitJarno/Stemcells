# Aski's figure: the canon's eyes

Aski came over from the earlier TypeScript rebuild before its eyes were
remade, so it still wore apostrophe eyes. This ports the remade figure as it
stood there, without changes of our own.

## Plan

- [x] Diff our `aski/` against the rebuild's last Aski: the body (five
      lobes), the scenes, the stage and the renderer are the same; only the
      eyes, their moods, the blinks and the gaze moved on.
- [x] The eyes are block cursors, the █ of SC█: upright, squared ends, 0.55
      as wide as tall, level, a block's width apart (`eye.ts`, `canon.ts`).
- [x] Moods typed into the eyes in Aski's own square strokes: `^ ^` `- -`
      `? ?` `! !` `> <` `x x` (`mood.ts`), never mirrored, and kept off
      eyes under 8 device pixels.
- [x] `listen` no longer turns the eyes into an opening quote.
- [x] The figure draws each eye on layers of its own, open and shut
      (`stage/figure.ts`): blinks on the wall clock's 4.4 s slots, now and
      then twice, by transform alone; the eyes follow the pointer over Aski's
      pane and the caret in its field, rest up and to the left while Aski
      answers (`eyes.ts`). They no longer blink like a cursor while a chat
      waits on the person: with three to seven waiting at once, that was a
      beat a second all day, and the cards already say it.
- [x] The eyes say how things stand (`attention.ts`), first that holds:
      `- -` nobody at the Mac, `x x` the server doesn't answer, none
      while typing or waiting, `? ?` Aski's newest turn failed and nothing
      typed since, `^ ^` a Cell landed and none works or needs the person.
- [x] Nobody at the Mac: the server reads the I/O registry (idle 5 minutes,
      or the session switched out) at `GET /api/stemcells/presence`; the
      page asks every 10 s, every 2 s while nobody is there.
- [x] Tests: the canon's block and spacing, every mood's glyph, the idle
      blinks, the figure's eye layers, the mood order, the presence rules,
      and the upstream contracts the eyes read.
- [x] Proof from the dev app, headless: old and new side by side, and the
      eyes in each state.

## Review

- Not ported, because nothing here has it yet: the eyes resting on a card in
  Aski's place (Aski's page has no cards; asks show in each chat), and the
  eyes following a new Cell out to the stage (`AskiStage` is not mounted).
  Both drop in where those arrive.
- A chat never sent anything counts as neither landed nor at work: upstream
  makes an empty "New thread" in every project, which would otherwise keep
  Aski pleased.
- "Aski thinks" is Aski's chat running a turn; "puzzled" is its newest run
  failed, the closest this fork has to a request Aski could not place.
- No answer is the primary environment offline, reconnecting or refusing the
  page; a first connection still under way says nothing.
- Presence reads two `ioreg` calls (about 20 ms), shared by every page for
  2 s. Off macOS, and when a read fails, nobody is ever said to be away.
