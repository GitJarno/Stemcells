# Motion

One motion system for the Mac and the phone. Every transition is one of the
primitives below, on its token; a change cites the primitive it uses. A motion
says what happened (something came, went, moved, changed, or is working) and
then stops. Nothing moves for its own sake.

The tokens live in `apps/web/src/stemcells/tokens/stemcells.css`
(`--sc-motion-*` curves and lengths, `--sc-timing-*` plain times), read from
script by `tokens/motion.ts`. The timed primitives are plain numbers in
`motion/listMotion.ts`, which `listMotion.test.ts` holds to the tokens; the
phone runs those same numbers through Reanimated (`home/listMotion.ts`:
`ENTER`, `LEAVE`, `MOVE`).

The grounding: Apple's HIG on motion (brief and precise, optional, never
gratuitous, interruptible; springs that carry a gesture's velocity, WWDC
2018's "Designing Fluid Interfaces"), and Material's speed and easing
guidance (decelerate in, accelerate out, exits quicker than entrances, about
200 to 300 ms for a phone's small and medium changes).

## Primitives

| Primitive | Means                                                         | Curve                                   | Length                                 | Tokens and code                                                                       |
| --------- | ------------------------------------------------------------- | --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Enter     | Something new appears where it lands                          | ease out `(0, 0, .58, 1)`, opacity only | 200 ms                                 | `--sc-motion-fade`; `LIST_MOTION.enter`; phone `ENTER`                                |
| Leave     | Something goes, where it stood                                | ease in `(.42, 0, 1, 1)`, opacity only  | 140 ms                                 | `--sc-motion-leave`; `LIST_MOTION.leave`; phone `LEAVE`                               |
| Move      | Something changes place, or others make room                  | ease out `(0, 0, .58, 1)`, no overshoot | 350 ms                                 | `--sc-motion-recede`; `LIST_MOTION.move`; phone `MOVE`                                |
| Change    | A thing changes state in place: hover, press, colour, a count | ease out                                | 120 ms                                 | `--sc-motion-flick`; a content swap is a leave and an enter                           |
| Follow    | The view keeps the end of growing content                     | none: tracks the content each frame     | 0 ms                                   | LegendList `maintainScrollAtEnd`, `animated: false` (phone, `threadFeedEndFollow.ts`) |
| Beat      | Work in progress: one band of light crosses each lit surface  | `BEAT_CURVE` `(.3, .1, .7, .9)`         | 3200 ms pass, 1000 ms rest             | `--sc-timing-glow-pass`, `--sc-timing-glow-rest`; `motion/beat.ts`; phone `GLOW`      |
| Turn      | The stage changes: a page, a tab, Settled's night             | spring, critically damped               | `page` (response .5) settles in 735 ms | `--sc-motion-page-*`; `tabs/pageStrip.ts`; the phone's segment is UIKit's             |
| Spring    | Motion handed over from a gesture, or with momentum           | spring, response and damping            | from the spring                        | `settle`, `travel`, `unfold`, `keyboard`, `lift`, `land`, `nudge`; `tokens/spring.ts` |

Why each:

- **Enter** decelerates: it arrives quickly and settles, and the eye lands
  where it rests. It fades where it lands rather than sliding in: its place
  is the information, and a slide would claim it came from somewhere.
- **Leave** accelerates away and is quicker than an entrance. What goes needs
  less attention than what comes.
- **Move** is the one curve for every change of place, so a reorder, a fold
  and a flight read as the same kind of event. Longer than an enter because
  the eye follows a path, not a fade.
- **Change** is short enough to read as the control's own response.
- **Follow** is direct, like content under a finger: an eased scroll would
  lag the words it follows. When the person jumps to the end, that is a move.
- **Beat** glides, never lunges, on one wall clock, so every lit surface
  crosses in step.
- **Turn** and **Spring** keep the velocity of the hand that started them
  (Apple's fluid interfaces). Critically damped (1) unless an overshoot
  means something.

## Rules

- **Fixed lengths.** A primitive's length doesn't scale with distance, so the
  app keeps one rhythm. The exception is a flight across the screen, which
  scales by its length within a floor and a ceiling (`needs/stroll.ts`).
- **Interruptible.** A new target starts from where the motion is now, never
  from its start, and never waits in a queue. A touch takes over a spring at
  its velocity (`tokens/spring.ts`).
- **Reduce Motion.** Nothing travels. On the Mac every motion token becomes a
  200 ms ease-out fade (the `prefers-reduced-motion` block in
  `stemcells.css`) and `reducedMotion()` gates what script plays. On the
  phone Reanimated skips entrances and exits (`ReduceMotion.System`) and
  views check `useReducedMotion`. What tracks a finger still tracks it.
- **Nothing repaints while idle.** Motion animates `transform` and `opacity`
  only, as one animation that ends. A still screen draws no frames.
- **No continuous animation.** The beat is the only loop. It runs on the
  compositor and holds still out of sight, while the app is away, and under
  Reduce Motion (`motion/sight.ts`, the phone's `glow/Wave.tsx`).
- **Springs only for hand-offs.** A spring is for motion a gesture started
  or that carries momentum: the page strip after a swipe, a thrown window,
  the media viewer, the spawn's flights. An enter, a leave or a change is
  never a spring.
- **Upstream's motion stays upstream's** until it shows in a view of ours;
  then a substitute or an extension point puts it on a primitive, and until
  then it is listed below.
- **A new token needs a new meaning.** A motion with a meaning above takes
  that primitive's token.

## The send

The chat is where these meet, on both surfaces.

- A chat reads from the top. A short chat sits under the header, however it
  was reached: a new Cell sent from the home, a draft becoming its chat, a
  short chat reopened, Aski's chat, the chat beside the list on an unfolded
  Duo, the full-screen chat. Once its content is taller than the screen it
  follows its end: content grows downward until it reaches the composer,
  and from then on the view follows it, with no switch between the two.
  - The phone: upstream's feed asks its list to hold a short chat at its end;
    a substitute turns that off for every chat
    (`upstream/substitutes/legendapp-list-keyboard.tsx`).
  - The Mac: the timeline has always laid out from its top.
- The sent message enters, and so does each reply as it arrives.
- Rows that stream in under the message add below it; nothing above them
  should move.
- An ask at the chat's end enters and leaves on the same primitives
  (`line/ChatAsk.tsx`).

## Not yet on the system

Phone:

- The feed's rows enter on upstream's own fade: a sent message rises 25 px
  over 220 ms (`FadeInDown`), a reply fades over 220 ms, both on Reanimated's
  default ease-in-out: `features/threads/ThreadFeed.tsx:2400`, `:2688`. That
  hot file is at its budget, and a package substitute can't reach one file
  alone (Metro caches a package's resolution per importing folder), so this
  waits for an extension point or a raised budget.
- A short chat still jumps briefly: at a send and as a turn ends, its
  content snaps up some 20 to 60 pt and eases back over about 300 ms. It
  did so before the chat read from its top, bottom-aligned; the cause is
  not proven (likely the end follow scrolling to an end measured with a
  new row's estimated size, 180 pt, `ThreadFeed.tsx:4383`).
- A send in a long chat scrolls to the end on UIKit's own animated scroll,
  not on `move`: `features/threads/ThreadDetailScreen.tsx:1389`, `:1466`
  (upstream's).
- A row's light: `glow/RowLight.tsx:19-20` (200 ms in, 400 ms out), and the
  band's end in `glow/Wave.tsx:68` (400 ms).
- A feat's arrival rises (`FadeInDown`, 200 ms) and leaves in 150 ms:
  `collection/FeatMoment.tsx:58-60`.
- The stages' switch: `home/StagePages.tsx:25` (200 ms, cubic out).
- The copy's flight: `home/CopyLayer.tsx:41` (cubic in-out, not `move`).
- The night: `home/nightfall.ts:6-8,25`.
- The bloom rises in 250 ms where the Mac's glow arrives in 450 ms:
  `motion/listMotion.ts:18` against `--sc-timing-glow-arrive`.

Mac:

- The arrival ring: `tabs/workspace.css:238` with `tabs/arrival.ts:6`
  (900 ms, said twice).
- A caught word's bloom: `words/words.css:68` with `words/plugin.ts:20`
  (600 ms, said twice).
- Aski's button sinks and rises on curves of its own:
  `aski/askiButton.css:109,112`.
- A second curve for a change in place: `--sc-motion-icon-hover` (220 ms,
  ease in-out, `tokens/stemcells.css:15-16`) beside `flick`.
- A walk's curve: `needs/stroll.ts:75` (`(.2, .8, .2, 1)`, not `move`).
- The tabs' arrival wait: `tabs/glide.ts:15` (500 ms).
- The row bloom's ease-in-out: `rail/rowMotion.ts:67`.
