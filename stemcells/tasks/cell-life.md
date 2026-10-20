# Cell life: temperament, acting, wardrobe

The critters port (`tasks/cell-kit.md`) brings the Swift app's Cell over
exactly: its rig, faces, wardrobe, packs and moves. This file designs what a
Cell is and does beyond the port. It covers:

- a temperament of its own;
- a move for every true signal in the thread;
- one clock for all of it;
- a crew where no two Cells look alike;
- a wardrobe that dresses a whole character.

It is the brief for the agents who draw it. A lookbook rendered through the
kit itself shows every temperament, action, draft outfit and a busy slate. It
is kept outside the repo and drawn on the same rig and grid. Each move is
marked Port, for the Swift app's own, or Draft, for new work.

## Principles

1. **True or nothing.** A Cell acts out only what the thread says is
   happening, and nothing it guesses. It holds no prop for show and grows only
   from work that happened. When there is no signal there is no move (see
   /clear below). The work verbs follow the same rule.
2. **The job is shared, the manner is personal.** Every Cell plays the same
   move for the same work, so you can read the job across a crew at a glance.
   Temperament shows at rest, in the beats between work and in celebrations.
3. **Faces are signals.** The eye states are reserved:
   - `! !` means needs you, and only that;
   - `x x` means failed;
   - `- -` means asleep;
   - `^ ^` means landed or pleased.

   At rest every temperament wears the calm face. Temperament never borrows a
   state's face.

4. **Energy goes into moments, not into idling.** At rest a Cell breathes and
   blinks, and that is all. Only one Cell on screen is lively at a time, and
   rare things stay rare. A crew at rest stays put.
5. **Legible at 13 × 14 first, on both frames.** Every piece and move is
   judged at the miniature and at the tab's one-device-pixel hero. It is
   judged on black and on T3's light canvas.
6. **Rewards are looks, never power.** Nothing punishes absence. A dip is a
   number somewhere else, never a sad Cell.
7. **One clock.** Every Cell and the composer's glow keep the wall clock's
   beat.

## 1. Temperament

Each Cell is dealt one of six temperaments from its thread id. Dealing uses
the same rendezvous hash as looks, with its own salt (`temperament:`), so
look and temperament vary independently: 6 temperaments × every outfit. All
six are weighted equally, and a Cell keeps its temperament for life. Its name
appears in one place only, the Cell's card, as one word.

A temperament is motion, not a stat. A trait with numbers (nerve, focus)
would claim something about the model that isn't true. Tempo, gaze and timing
claim nothing and still read at 13 × 14.

| Temperament | Breath                      | Blink                        | Notices after | Gaze at rest            | Fidget                                        | On it (sent)                        | Landed (no signature cheer)                   | Needs you (body only)               |
| ----------- | --------------------------- | ---------------------------- | ------------- | ----------------------- | --------------------------------------------- | ----------------------------------- | --------------------------------------------- | ----------------------------------- |
| Steady      | 5.2 s                       | 5.6 s                        | 330 ms        | ahead                   | a long breath out, lids low                   | a slow nod                          | a nod and a small hop                         | perks up and holds still            |
| Keen        | 3.0 s                       | 3.4 s, a double now and then | 0             | ahead, up at your words | two bounces on the spot                       | a quick hop, eyes wide              | two hops, arms up                             | the wave                            |
| Nosy        | 4.0 s                       | 4.0 s, double                | 80 ms         | wanders: side, up, side | cranes up, looks both ways                    | looks up at the message, cranes     | a hop, then looks left and right              | leans side to side, looking for you |
| Fussy       | 4.0 s, even                 | 4.0 s                        | 80 ms         | ahead                   | a hand up to its top, a small shake to settle | straightens tall, a hand to its top | a bow, then a glint                           | taps a hand at its side             |
| Dreamy      | 5.6 s                       | 6.4 s, long                  | 500 ms        | up, now and then        | a slow sway, eyes up                          | a slow blink, then up               | a spin (two turns, squeezed through the edge) | a slow sway                         |
| Proud       | 4.4 s, chest out at the top | 4.8 s                        | 170 ms        | ahead                   | puffs up and holds it                         | puffs up, chin up                   | a high hop, held at the top, then puffed      | stands puffed, stamps now and then  |

The following is the same for every temperament, by design:

- **The faces.** All six use the calm face at rest and the same reserved state
  faces.
- **The caret blink.** It blinks 530 ms open and 530 ms shut, and every Cell
  that needs you blinks in step.
- **The work moves.** Each job has one move, played the same by every Cell.
- **Failed.** A wide-eyed beat, a sag, then `x x`, held. A loss is reported,
  never performed.
- **The signature cheer.** When a look has its own cheer, it wins over the
  temperament's.

Readable at 13 × 14:

- Breath and hops change the miniature by a row, sway and lean by a column,
  and gaze moves the eyes by a cell.
- Tempo and timing read at any size.
- No temperament depends on detail that only the hero can show.

## 2. Acting: signal → move → hold

The truth comes from T3's live thread state, in two places:

- **The shell** (`useThreadShells`): run status, `activityStartedAt`, the
  failure class, pending approvals and inputs, project, branch and worktree.
- **The turn items** (`useThreadProjection`):
  - user and assistant messages;
  - reasoning;
  - `file_change`, `command_execution`, `file_search` and `web_search`;
  - `dynamic_tool`, `subagent`, `todo_list`, `compaction`, `handoff`, `fork`
    and `checkpoint`.

Upstream's `classifyToolActivity` and the work-log groups give the first cut.
`cell/activity.ts` (ported, unused on main) refines shell commands.

### Priority (highest first)

1. Needs you (approval, input, a plan to approve, a subagent's request)
2. Spawn and release (Aski's, unchanged)
3. Failed, stopped
4. Moments: landed, merged, the flex, compaction, model or provider change,
   rewind, wake, sleep
5. Work in flight
6. A reaction (notice, feel, resume: the Swift app's, for a look changing)
7. A fidget
8. Breath and blink

A higher item cuts in at the next frame. The exception is a Cell in the air,
which lands first (four frames at most). A moment hands back to whatever
holds beneath it. Moments are never queued behind each other: the newest
wins and the rest are dropped.

### Work in flight

Holds come from the Swift app's measurements (246 h of busy time): a new
activity shows after 3 s and a shown one holds 8 s. That was right 94 % of
the time, with under one switch a busy minute. Starting and stopping work
show at once.

| Signal (thread)                                                                              | Activity             | Move                                                                                                                                                         | Status |
| -------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| A run is active and no call is in flight (a reasoning item, or nothing yet)                  | thinking             | gaze wanders, a bulb now and then                                                                                                                            | Port   |
| 20 s of thinking                                                                             | thinking, long       | alternates with the head scratch every 20 s                                                                                                                  | Port   |
| 8 s with nothing new in the turn                                                             | thinking gone deep   | eyes closed, floats 2 px, still with no clock; the next record drops it                                                                                      | Port   |
| `file_search`, upstream `search`, `rg`/`grep`/`find`                                         | searching            | magnifier at the eye                                                                                                                                         | Port   |
| A file read, `cat`/`head`/`less`/`sed`, a `dynamic_tool` with `viewedImagePath`, `git` reads | reading              | the book                                                                                                                                                     | Port   |
| `file_change`                                                                                | **editing** (new)    | a pencil in the side column, scribbling. When the item completes, a `+` and a `−` rise at the shoulder, each only when its diff adds or removes lines        | Draft  |
| `command_execution` the classifier can't name; an MCP tool                                   | running              | the laptop                                                                                                                                                   | Port   |
| A test command                                                                               | testing              | the bubbling flask                                                                                                                                           | Port   |
| A build command                                                                              | building             | the hammer                                                                                                                                                   | Port   |
| `git commit/push/tag`, `gh pr create`, the app's own commit, push and PR actions             | shipping             | the paper plane                                                                                                                                              | Port   |
| `web_search`, a fetch, browser tools                                                         | browsing             | the spyglass                                                                                                                                                 | Port   |
| `sleep`/`wait`; background work the turn waits on (monitor, background task)                 | waiting              | the hourglass                                                                                                                                                | Port   |
| A `subagent` item running, or a collab tool call                                             | **delegating** (new) | a bud of the Cell stands beside it on the composer and bobs while the Cell watches it; one bud per subagent, two at most; a bud hops home when its item ends | Draft  |

### Moments

| Signal                                                                                                                        | Move                                                                                                                                                   | Hold                                                           | Status                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------- |
| Your message is sent (run `queued`, then `starting`)                                                                          | **on it**: the temperament's beat, then the work                                                                                                       | once                                                           | Draft                        |
| Run `completed`                                                                                                               | the cheer: a crouch, a hop with arms up, stars, `^ ^`; a look's signature cheer wins                                                                   | once, then rest; unread, `^ ^` holds as a state until you look | Port                         |
| A pending approval                                                                                                            | the plea: `! !`, perked up, the `!` mark, caret blink                                                                                                  | held                                                           | Port                         |
| A pending question, a plan waiting for approval                                                                               | the wave                                                                                                                                               | held                                                           | Port                         |
| Run `failed`                                                                                                                  | wide-eyed, a sag, `x x`                                                                                                                                | held until your next send, or until you open the chat          | Draft                        |
| Run `interrupted` or `cancelled` by you                                                                                       | stopped: brakes `> <`, skids a column, then looks at you                                                                                               | once                                                           | Draft                        |
| A `todo_list` item turns completed                                                                                            | a lime tick pops at the shoulder, `^ ^` for a beat                                                                                                     | once per item, at most one every 2 s                           | Draft                        |
| A `compaction` item                                                                                                           | a slab comes down and presses the Cell flat. The depth follows the ratio of tokens saved (before → after, clamped). It pops back with a glint, lighter | once                                                           | Draft                        |
| `thread.model-selection-updated`                                                                                              | a glint crosses it diagonally; wide eyes, then calm                                                                                                    | once                                                           | Draft                        |
| `thread.provider-switched`                                                                                                    | its new colour comes down over it like a curtain                                                                                                       | once                                                           | Draft                        |
| `checkpoint.rollback-requested`, run `rolled_back`                                                                            | steps back four columns, blinks, comes home                                                                                                            | once                                                           | Draft                        |
| Its provider session starts                                                                                                   | wakes: lids, a stretch with arms up, settles, blinks twice                                                                                             | once                                                           | Draft                        |
| Session stopped, or thread snoozed                                                                                            | falls asleep: a yawn, flattens, `- -`, z's                                                                                                             | asleep holds, with a slow breath                               | Draft                        |
| A usage limit (`lastErrorClass: usage_limit`)                                                                                 | asleep and dimmed; the reset time is in words on the composer                                                                                          | until the reset or the auto-resume, which plays wake           | Draft                        |
| A context reset (/clear)                                                                                                      | the gust: hunkers, watches the page go, whistles                                                                                                       | once                                                           | Port, **off: no signal yet** |
| One of the thread's pull requests turns merged (a `pullRequests[].snapshot.state` going from `open` to `merged` on the shell) | **the lap**: scoots out along the composer's top edge, turns, scoots home, hops with stars                                                             | once per PR, only on a change seen live; legendary             | Draft                        |
| A turn lands after a long run alone: 30 min or more with no needs-you                                                         | **the flex**: strength arms up, biceps, `^ ^`                                                                                                          | in place of the cheer                                          | Draft                        |
| Created (`thread.created`)                                                                                                    | Aski's in, around, out; eyes last, `- -` until the session is ready                                                                                    | once                                                           | Swift, unchanged             |
| Archived or deleted by you                                                                                                    | the release: eyes shut, the blocks lift into letters that run home to Aski                                                                             | once                                                           | Swift, unchanged             |

### Between Cells

Every thread shell carries its project, branch and worktree, so the client
can check every fact below without anything new on the wire.

| Signal                                                                          | Move                                                                                                                | Hold           | Status |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------- | ------ |
| Two running threads have a `file_change` on one path                            | **same file**: both turn to look at each other, focused; the tab strip's words carry the warning                    | while both run | Draft  |
| A `handoff` or `fork` item from one thread to another                           | **handoff**: a drop of the sender's colour arcs from one Cell to the other, and the receiver squashes as it catches | once           | Draft  |
| One lands while another Cell needs you                                          | **a quiet win**: `^ ^` only, no hop, and it looks toward the one that needs you                                     | as done        | Draft  |
| Two or more were at work at once, and now all are done with none waiting on you | **the chorus**: every Cell in view whistles at once                                                                 | once           | Port   |
| A fork's new Cell                                                               | **lineage**: it wears its parent's fabric colourway                                                                 | for life       | Draft  |

### Signals, verified

Read on main on 21 October.

- **Merged: yes, on every thread's shell.**
  - `thread.pull-request-synced` carries the whole thread, and the shell
    keeps its `pullRequests` (`packages/client-runtime/src/state/models.ts`).
  - Each link's `snapshot` has `state` (`open`, `closed` or `merged`) and
    `mergedAt` (`packages/contracts/src/threadPullRequest.ts`).
  - The server polls open pull requests every minute, and ones untouched for
    30 minutes every 5. A `gh pr merge` in the thread is read at once
    (`PullRequestSyncReactor.ts`), so the lap can come a minute or more
    after a merge done elsewhere.
  - The lap plays only on a change from `open` to `merged` seen live. A
    merge that happened while the app was closed plays nothing.
- **Unseen threads: live on desktop only.**
  - On the desktop app, `RunningThreadKeepAlive` (mounted in `__root.tsx`
    when `isElectron`) mounts the detail stream of every running thread in
    every enabled environment. Turn items stay live for tabs you can't see
    and are released once the run stops.
  - In a browser, only the threads someone reads are live. There, an unseen
    tab's Cell falls back to the shell: working, needs you, done, failed.
    The other route is to mount the same keep-alive outside Electron, which
    is one atom.
- **Diff counts: in the contract, but empty today.**
  - `file_change` declares `additions` and `deletions`, but neither adapter
    fills them. Claude's sets `diffStr` from the tool's output once it ends.
    Codex's sets `diffStr` from the first change.
  - So the marks come at completion, counted from the diff's `+` and `-`
    lines. While the change is in flight the pencil scribbles alone.
- **/clear: no signal.** The slash command goes to the provider. The adapter
  has to report a context reset (Claude's session-start source, or its
  equivalent in each adapter) as a turn item, and until it does the gust
  stays off.
- **The classifier.** Add `editing` (`file_change`) and `delegating`
  (`subagent`, `collab_agent_tool_call`) to `activity.ts`. An MCP tool stays
  running unless its name says browser.

## 3. Choreography

- **The clock.** It is the wall clock, the same beat the composer's glow keeps
  (its `beatStart(cycle, performance.timeOrigin)`, landing with the glow). Sprites tick on the kit's
  12 fps beat (`BEAT`). A move's fps divides 12, and theatre that is timed to
  sound runs at 24.
- **Phase.**
  - Each Cell's breath phase is seeded from its id, so a crew never breathes
    in unison.
  - Unison is kept for two things: the needs-you caret blink (530 ms, every
    Cell in step) and the chorus.
  - While a Cell works, its breath locks to the glow's pass, one breath per
    4.2 s (3.2 s pass plus 1 s rest). It inhales as the band crosses under it.
  - While the glow is blocked on you, the plea loop runs as long as the
    glow's 3.2 s breath.
- **A beat.** Every moment has three parts: notice (0–500 ms, set by the
  temperament), act, then resume (250 ms, back to what holds). This is the
  Swift reaction's shape, used for every moment.
- **The lively token.**
  - One per window. Cheers, laps, flexes, fidgets and rare beats need it.
  - A Cell that waits more than 2 s for the token drops a fidget. A cheer
    plays smaller: one hop, on the tab mark.
  - While any Cell needs you, nothing else celebrates: wins play quiet.
- **Budgets.**
  - **Fidgets:** at most one per Cell every 90 s, only while the pointer has
    moved in the last 60 s. None after 10 minutes without you.
  - **Rare beats:** at most 3 an hour across the crew, and never the same one
    twice in a row.
  - **The lap:** once per pull request.
- **Off screen.** Each Cell pauses on its own `IntersectionObserver` and on
  `visibilitychange` (the pattern in `AskiStage`). Nothing catches up: on
  return the Cell shows its current state's frame, and a state like an unread
  landing holds.
- **Reduce Motion.**
  - Each move holds its telling frame (the kit marks it).
  - No blink. Needs you shows a still `! !`.
  - State changes cross-fade over 200 ms.
  - Meaning never rides on motion alone.
- **Cost.**
  - Frames are composed once per look and scene (the kit's lazy bank) and
    cached as bitmaps.
  - One `requestAnimationFrame` serves the window, and a Cell draws only when
    its frame changes. A Cell at rest costs about one draw a second.
  - Budget: under 1 ms a frame for twelve Cells.
  - No CSS keyframes on sprites: they keep the compositor busy for nothing.

## 4. Diversity

- **Slots:** head, face, wrap, back (new), fabric (dye), and held (moves
  only). An outfit fills two or three of them.
- **No two alike on screen.**
  - Each look is ranked by its rendezvous score for the Cell. Cells are
    walked in birth order, and each takes its highest-ranked look whose
    silhouette class and colour family no other Cell in view already wears.
  - Temperament is dealt the same way, from its own ranking. So are names,
    which can collide today.
  - A Cell never changes its look while it is in view; only newcomers move
    down their ranking.
  - Past the catalogue, a crew differs by temperament and colourway, then by
    name.
- **Proportions: no.** Emotion is already shape: focused is taller, tired is
  wider and lower, proud is puffed. A permanent build would read as a
  permanent mood. Growth is the only lasting change of shape.
- **Colourways of fabric, never of body.** The body's colour is the
  provider's, which is how you tell a Claude Cell from a Codex one. Each
  outfit lists two or three fabric colourways from the fabric pairs (the
  mage's robe in lilac, sky or rose).
- **Seasons add, never replace.** A season's piece takes a slot the theme
  leaves free (the Swift app let the season win, which cost four of eight
  Cells their house piece on 21 October). Decided; see below.
- **Growth: the flex.**
  - Time worked alone is a turn's running time with no needs-you, summed over
    the thread.
  - At 10 min, 30 min and 2 h the Cell grows nubs, then arms, then biceps.
    The thresholds are open to tuning.
  - Strength arms are the only limb that stays.
  - The flex replaces the cheer after a single run of 30 min or more.
- **Earned pieces.** These are rare and true:
  - the champion belt, for the project's longest solo run of the month;
  - the crown, for the hundredth Cell.

  The Cell's card states the fact behind each piece ("Longest run alone in
  October: 2 h 14 min"). A Cell wears one earned piece at most, in its slot,
  over the dealt piece.

- **Lineage.** A forked Cell wears its parent's fabric colourway.

## 5. Wardrobe

### Rules (the Swift three, plus three)

1. The front of the box is the face: nothing stamped under the eyes.
2. Light faces the void, and deep meets the body.
3. One eye stays visible, unless the piece is the eyes.
4. **Two frames.** On black there is nothing to fix: no piece fails there.
   On T3's light canvas, **80 of 167** pieces and curated looks have half or
   more of their outline under 1.6 : 1. Measured on a Claude body at the
   miniature.

   The fix is a pass in the compositor, not a redraw. On light frames only,
   it draws a one-cell keyline in charcoal (`4`) outside every light piece
   cell that faces the void. The check then measures both frames after the
   pass.

5. **The back slot reads above the shoulders.** The dome fills the
   miniature's width from row 10 down, so a back piece reads only where it
   rises over the crown or past the narrow top: arrows, a towel's end, wings,
   jetpack nozzles. A cape shows a hem and nothing more.
6. **A posed piece frees the eyes whenever the face carries state.** The
   welder's mask comes down only while the Cell builds. It goes up for needs
   you, landed and failed.

### The approved packs

| Pack            | Pieces (slot)                                                                                      | Cheer                                                                |
| --------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Classes: knight | helm (head), plate (fabric), a cape hem (back)                                                     | sword raised (ported)                                                |
| Classes: mage   | wizard hat (head), robe with a gold hem (fabric; lilac, sky or rose)                               | a spark off the wand (drafted)                                       |
| Classes: ranger | peaked cap with a feather (head), quiver (back)                                                    | an arrow loosed, flying off the side                                 |
| Classes: rogue  | charcoal hood (fabric), cape with a light hem (back)                                               | vanishes: thins to nothing and steps back in a column over (drafted) |
| Classes: monk   | headband with tails (head), a gi with a belt (fabric)                                              | a palm strike with a burst                                           |
| Gym             | sweatband (head), towel (back), lifting belt (wrap)                                                | the flex (drafted)                                                   |
| Workshop        | welding mask, posed up and down (face), hi-vis with a reflective stripe (fabric), tool belt (wrap) | sparks                                                               |
| August          | crayfish-party paper hat (head), a paper moon lantern (back)                                       | the lantern swings                                                   |
| November        | sou'wester (head, exists), raincoat (fabric), a reflector on a string (trim)                       | shakes off the rain                                                  |
| Lunar New Year  | red and gold fabric, a lantern (back), and a lion-dance head drawn with care                       | firecrackers at the side                                             |

Lunar New Year needs per-year dates: `season.years: {"2027": ["02-06", "02-20"], …}`.

Proposed in addition: a sixth class, **bard** (lute on the back, a strummed
cheer whose notes join the whistle), and more of the year, done
respectfully:

- **Holi:** the cheer is a puff of colour powder.
- **Carnival:** a feather back piece.
- **Día de Muertos:** a marigold crown.
- **Diwali:** a string of lights as a wrap, with a sparkler cheer.

For cultural packs:

- Objects of the celebration only: flowers, lanterns, food, kites. Nothing
  sacred, and no costume of a people.
- One pack, one event, named plainly and dated from its own calendar.
- Each piece's `about` says what it is and where it is worn.

## 6. What the kit's data must carry

These are additions to the formats in `cell/kit/`, for the critters owner:

- **`temperaments.json`**, one record per temperament:
  - `id`, `weight`;
  - `breath: {periodMs, depthRows, puff?}`;
  - `blink: {windowMs, shutMs, double}`;
  - `noticeMs`;
  - `gaze: [{look, holdMs}]`;
  - `fidget: move`;
  - `beats: {onIt, landed, needsYou, wake, sleep}` as move names.

  Failure and the work moves are absent on purpose.

- **Moves** (in `moves.json` scenes and cheers), per move:
  - `kind`: `loop`, `once` or `hold`;
  - `priority` (the ladder above);
  - `tier`: common, rare, legendary or secret;
  - `lively`: whether it needs the token;
  - `tell`: the frame Reduce Motion holds;
  - `then`: the scene it hands back to;
  - `land`: frames to wait before a cut while it is in the air.
- **Travel moves** (the lap, and a bud hopping home) carry per-frame `dx`,
  and a `stage` width in hero cells beyond the box.
- **Composite moves** (a bud, the vesicle) carry a second body as role
  letters, drawn in the Cell's palette.
- **New scenes:**
  - `editing/0`, `delegating/0`, `onIt/<temperament>`, `landed/<temperament>`;
  - `stopped`, `todo`, `compaction`, `glint`, `rewind`, `wake`, `yawn`;
  - `lap`, `flex/<tier>`, `sameFile`, `handoff`, `quietWin`.
- **Marks** (move layers): the pencil, `+` and `−`, the slab, the tick, the
  vesicle, the bud, and the biceps.
- **Pieces:**
  - a `back` slot (anchor `back`, z −1);
  - posed variants keyed by state, e.g.
    `poses: {"building": "weldmask-down"}`;
  - `about` for cultural pieces.
- **Outfits** (a new record, dealt as one):
  - `id`, `head?`, `face?`, `wrap?`, `back?`, `fabric?`;
  - `colourways: [{id, fabric}]`;
  - `cheer?`;
  - `silhouette` (a class name) and `family` (a colour family), which dealing
    uses to keep a crew apart.
- **Packs:** `season.years` for moving dates, and `outfits` beside `pieces`.
- **Growth:** `strength` art per tier (nubs, arms, biceps) as rig features at
  both sizes, and the flex per tier.
- **Earned:** pieces with a `rule` id (`longest-solo-month`,
  `hundredth-cell`). The rule lives in code; the art lives in data.
- **Palette:** the keyline ink, `keyline: "4"`.

## 7. Fan-out

1. **The kit lands first** (critters, slices 1–3), with the toolchain's
   `check`. The check renders every look × move × temperament at hero and
   mini, on black and light after the keyline. It fails on any of these:
   - a piece outside the box;
   - a covered eye where a state needs it;
   - a stamp in the mouth zone;
   - an outline under 1.6 : 1 on either frame;
   - an fps that doesn't divide 12;
   - a missing `tell`;
   - two outfits in a pack sharing a silhouette and a family.
2. **Shared brief:** this file, `docs/critter-art.md`'s rules as ported, the
   kit's formats, and "draw for the miniature first, judge on both frames".
   Every agent ships JSON, its renders in a lookbook, and a passing `check`.
   Curation happens at the miniature, in live combinations.
3. **In parallel, one agent each:**
   - **Temperaments:** six records and their beat moves.
   - **Work moves:** editing, delegating and the bud.
   - **Moments:** on it, stopped, todo, compaction, glint, rewind, wake, yawn,
     the lap.
   - **Between Cells:** same file, handoff, quiet win, lineage.
   - **Growth:** strength tiers, the flex and earned pieces.
   - **Packs, one agent per pack:** classes (six), gym, workshop, August,
     November, Lunar New Year, then the proposed cultural packs.
4. **Integration** (critters' slice 3 plus this):
   - the signal adapter (the tables above, as a contract test over fixtures
     of real turn items);
   - the priority ladder;
   - the lively token;
   - crew dealing;
   - the keyline pass.

## Plan

- [x] Design bible (this file)
- [x] Lookbook: temperaments, actions, outfits and a busy slate, drawn through
      the kit
- [x] Calls decided (below)
- [x] Signals verified: merged, unseen threads, diff counts
- [ ] Kit format additions agreed with critters (sent for slice 3)
- [ ] Ask the adapters for a context reset
- [ ] The owner's look at the lookbook, then the fan-out per section 7

## Decisions

These were decided on 21 October, and the owner can still override any of
them.

1. **Seasons add to the outfit.** A season's piece takes a slot the theme
   leaves free. This changes a Swift behaviour.
2. **A keyline on light frames only.** No piece is redrawn: the art stays
   the Swift art.
3. **A temperament is named only on the Cell's card.**
4. **The merge lap is in.** It is the one legendary move: a short dash along
   the composer, about 5 s.
5. **Colourways are fabric only.** The body stays exactly the provider's
   colour.

## Review

The bible and the lookbook are done, and the decisions above are made. No
code waits on this file until the owner has looked at the lookbook.
