# Aski the shapeshifter: forms, the spawn, and the engine under them

Aski is made of characters. Every shape it takes, the koi in its pond, its
own body, the Cells it gives life to, is the same characters rearranged.
This page decides what that means for the room, the spawn and the code.

This is the design. A working prototype (pond, Aski, the spawn into 1, 3
or 5 Cells, in Aski's tab and in a new chat) was shown in the chat that
made this page; it is kept outside the repo. The slices are at the end.

## Decisions

### 1. The composer never moves

- The composer stands at the foot of every chat, in every pane, as
  upstream's does. A new chat does not centre it and then drop it on send.
- Why: the hand learns one place. A Cell's line, Aski's perch and the
  spawn's landing all stand on the composer's edge; a composer that moves
  moves all of them. Upstream keeps it there, so a sync never fights it.
- What an empty chat changes is the transcript above it, which is Aski's
  stage until the first message: the pond in Aski's tab, Aski standing in
  a new chat. On send, nothing slides down: the stage resolves into what
  the message made (decision 4), and the transcript begins.

### 2. Aski is characters, always

- Aski's own form is its canon body (five lobes, `canon.ts`) in its live
  ASCII skin (`render.ts`): the ramp `. : - = +` at its edges, its own body
  characters inside, in Aski's 5×7 font. It is no longer drawn as a solid
  field.
- The eyes are the one solid thing: the two block cursors, the █ of SC█,
  in ink, in a clear ring the characters leave round them. They are what
  makes any arrangement of characters read as Aski. A figure too small for
  its characters to read stays solid ink, its eyes cut in the ground's
  colour.
- Settled forms step on the sprite clock (12 a second), so an edge
  changes glyph in beats, the way type does. Only characters in flight
  move at the display's rate.

### 3. Every change of form conserves its characters

- A shapeshift is the characters of one form flying to the places of the
  next: each is assigned a target (sorted along the shape, head to head,
  top to top), waits its turn, then springs there. The glyph shows its
  speed (`·` fast, `:` slowing, its own glyph at rest) and its colour
  blends from the old form's to the new.
- Nothing appears from nowhere and nothing vanishes: a Cell is made of
  Aski's characters, and Aski in its tab keeps a seed to regrow from.
  When counts differ, characters merge into one target or split from
  one source; they never pop.

### 4. The spawn: Aski gives its body to the Cells

One sequence, the same in every room. Timings are what the prototype
plays; `form-step` is 1/12 s.

| Beat     | What moves                                                                                                                             | Timing                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Take in  | The sent words lift off the composer and pour into Aski; it swells once as the last lands                                              | letters 20 ms apart, 420 ms each; swell 200 ms              |
| Disperse | Aski parts: its characters split into one stream per Cell, the side nearest each Cell first, and arc up and over like a fountain       | 750 ms spread, each flight 600–740 ms, eased in-out         |
| Body     | Each stream lands in its Cell's silhouette on the character grid and fills it from the ground up, each character stepping `. : + #`    | one glyph a `form-step`                                     |
| Resolve  | The silhouette turns to solid cells, a row at a time from the ground, then cuts to the Cell's own pixels with a single highlight frame | four steps, a row a `form-step` later than the one under it |
| Dress    | The outfit settles on, row by row from the top, each dropping 7 px with a little overshoot                                             | rows 30 ms apart, 180 ms each                               |
| Eyes     | The eyes open from a line, last of all, and blink once                                                                                 | 80 ms open; the blink 320 ms later                          |
| Alive    | A crouch, a hop with stretch, a landing squash and a wobble; its shadow shrinks as it rises                                            | 110 + 360 + 100 ms, hop 17 px                               |

- **In Aski's tab** Aski keeps 12 % of itself, its feet, as a seed on its
  ground line. Once every Cell is alive the seed regrows into Aski from
  the ground, on an underdamped spring (ζ 0.5), and its eyes open last
  again. That is the stem cell: it divides and stays.
- **In a new chat** Aski becomes the Cell entirely, or the Cells; with one
  Cell its characters fountain both ways and pour into one body.
- **Each Cell's order is its own**: body, then what it wears, then eyes,
  then life. The eyes are last because they are when it becomes someone.
- The planner's orbit (`aski-manager.md` decision 5, step 2) stays between
  Take in and Disperse when the plan takes time.
- **Reduce Motion**: forms cut with a 150 ms crossfade; the Cells appear
  standing.

### 5. Forms come from causes, never from a timer

Aski's tab shows one form at a time. Typing to Aski, or its turn, always
resolves it to its own form (decision 2) first; with the field empty and
nothing moving for 8 s, it returns to the form the moment calls for.

| Form          | When                                      | What it says                                                                                                                     |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The pond      | By day, every Cell landed or none started | A clean slate: the koi swims, rings where drops fall, lily pads. One line under it: "Shall we do something worth remembering?"   |
| The portrait  | Every Cell of a run has landed, once      | The pond stills and the Mona Lisa rises out of it (`scenes/the-pond.ts` already draws her); Aski's eyes settle on hers and blink |
| The garden    | Evening, Cells landed today               | Each landed Cell is a plant in a row, taller for the longer run; what got done today, worth looking at                           |
| The night sky | After dark, Cells still working           | Aski as a constellation; each working Cell a satellite crossing it                                                               |
| The rain      | The server doesn't answer                 | Rain down the window, `x x` in the eyes                                                                                          |
| Asleep        | Nobody at the Mac                         | Aski a still mound, `- -`, nothing moving                                                                                        |

New forms land as data: a form is a function from the stage, the time and
a seed to glyphs.

### 6. The blink

- Aski's eyes no longer blink like a cursor while a chat waits on the
  person (#269). With three to seven chats waiting at once, that beat ran
  all day; the cards already say what waits.
- Idle blinks stay on the wall clock: one about every 4.4 s, now and then
  twice.

### 7. A small engine, not a big one

Most of it exists. The moments already draw on a character grid
(`grid.ts`): a scene is a card and a pure `frame(t, stage)` (`scene.ts`),
Aski's cloud is cut from the canon's field, and a dissolve is a closed-form
function of time and seed (`particles.ts`). Under that sit the canon body
(`canon.ts`, `sdf.ts`), its springs (`aski.ts`) and the Cell compositor
(`cell/`). What's missing is making that grid Aski's live body, not only
its moments, and one idea added to it:

- **Form**: glyphs on the grid, each with a glyph, an ink and an order
  key. Aski's body, the koi and a Cell's silhouette are forms.
- **Morph**: characters from one form to another: assignment by order
  key, a delay by order, and a path, either a spring (leaps, settles) or
  an arc (streams). Springs solved in closed form, so a morph seeks,
  reverses and renders offline as a scene does.
- **Player**: the scene worker draws forms and morphs. A settled form
  draws on the sprite clock, a morph at the display's rate, and nothing
  draws while nothing moves or the page is hidden.

Physics stays first-principles and small: damped springs, quadratic arcs,
squash and stretch that keeps the area, a shadow that answers height. The
canon's lobes already carry their own springs (the crown soft, the feet
planted), so a walk is the lobes following the ground, not a new rig.

Budget: the pond is 1–2 thousand glyphs at 8–12 redraws a second in the
worker; a morph lasts under 1.5 s; zero frames while hidden.

## Slices

1. **The engine and Aski in characters.** Form and morph on `grid.ts`,
   played by the scene worker. Aski's figure draws as glyphs; the eyes keep
   their layers. Tests: a form's sampling, a morph's determinism and
   conservation.
2. **The spawn on it.** Take in, Disperse, Body and Resolve on the
   engine, replacing `copies.ts`'s flight and the glyph beats of
   `cell/forming.ts`; the Cell's own reveal gains Dress and Eyes in that
   order. Aski's tab keeps its seed and regrows; a new chat becomes.
3. **The pond in Aski's tab.** The ambient form, resolving on typing and
   returning when idle; the portrait moment moves onto it.
4. **The other forms**, one pull request each.
