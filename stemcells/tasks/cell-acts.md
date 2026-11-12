# Acts: what a Cell can do, and when

A Cell had about thirty moves, each a list of frames written out by hand, and
four moments wired into `cast.ts` one by one. Nothing answered the person's
hand except the throw. This makes acting a system that grows: an act is a few
lines, it plays on every look, and a table says when.

## The design

**An act is a score** (`cell/score.ts`, art in `art/moves/acts*.json`). A score
is a list of phrases: `leap`, `spin`, `sway`, `nod`, `wobble`, `hold`. A phrase
carries the craft once (the crouch before a jump, the hang at the top, the
faster fall, the damped settle), so every act made of it moves well. Face,
arms and lean persist between phrases; marks (notes, stars, z's) ride a span
of frames by name. The kit expands a score into the frames every other scene
has, so the rig, the wardrobe, the tools and the phone treat it as one more
scene (`act/<name>`). A raw frame is still allowed where no phrase fits.

**Acting is a table** (`cues` in the same files). A cue is something true that
just happened; the table names the acts that may answer it, per temperament
where a manner differs. The pick is the Cell's own and never the same twice
running.

| Cue                               | What it is                                            |
| --------------------------------- | ----------------------------------------------------- |
| `poke/rest`, `/2`, `/3`, `/dazed` | the person taps a resting Cell: once, again, a flurry |
| `poke/work`                       | taps one at work: it answers without stopping         |
| `poke/ask`                        | taps one that waits on them: it insists               |
| `poke/landed`                     | taps one that just landed: it celebrates again        |
| `poke/asleep`                     | taps a sleeper: it stirs and sleeps on                |
| `poke/crashed`, `poke/away`       | taps one that failed, or whose line is down           |
| `granted`, `answered`             | leave given, a question answered: it takes it up      |
| `failed`                          | its run failed: the daze before `x x` holds           |
| `fidget`                          | at rest with the person there, now and then           |
| `sleeping`                        | asleep with the person there, now and then            |

**True or nothing still holds** (`cell-life.md`). An answer is cast for the
state the Cell is in and keeps that state's face: `! !` while it asks, `x x`
once failed, lids while asleep; `^ ^` only for a landing. `check` fails an act
that shows a face its state doesn't own.

**The person's hand.**

- A tap on the Cell over the composer is a poke (a press that turns into a
  carry is still the throw). Taps in quick succession climb: an answer, a
  bigger one, a spin, then dazed with stars round its head, deaf to more
  until it shakes them off.
- A Cell in the air lands before the next act starts.
- A resting Cell over the composer watches the pointer while it is near.
- Every picture of a Cell plays its act in step; Reduce Motion plays none.

## Plan

- [ ] `score.ts`: phrases, marks, the expander; tests
- [ ] kit: `acts`, `marks` and `cues` in a move file; `act/<name>` scenes
- [ ] `acting.ts`: cues, the pick, the poke's climb, landing first; tests
- [ ] `cast.ts`: an act in flight, the new entrances, fidgets and sleepers
      from the table
- [ ] web: the poke and the gaze on the composer's Cell
- [ ] phone: the poke on a chat's Cell
- [ ] the repertoire, each judged frame by frame on a sheet at both sizes
- [ ] tools: `cells acts`, and the rules `check` holds for a score
- [ ] docs: `cell-art.md` (a score), `interaction.md` (the poke)
- [ ] one pass in the lab, captures for the pull request
