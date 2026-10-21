# Smart prompting: the composer reads where, on what and how many

A person says what they want in one sentence and the composer understands
the parts that set things up: the project ("Harbor fix the header"), the
model and effort ("with Opus 5.5 at max"), how many Cells ("2 Sol"). The
words it reads light up as tokens, each one moves the control it sets, and
before Send a readout says what will start. One Cell starts at once. When the
words ask for several, with different projects, models and efforts, Aski
starts them all from one message. The words fix what they say. One model
call fills only what they leave open, code checks its answer, and the
person sees any place Aski chose before anything runs.

This is the design; the prototype is a page outside the repo. The PR
slices are at the end, with what each built.

## Decisions

### 1. Only an anchored word acts; a mention stays quiet
A project name switches the destination only where the sentence points it:

- **The address**: the first words of the message or of a line, after
  nothing but leads (a count, a spawn verb, a model, "hey", "please"), and
  not followed by a determiner. "Harbor fix the header" and "3 Harbor: …"
  point; "Review this Mac's disk" doesn't, so a project called Reviews stays
  out of it.
- **A cue**: "in/into/inside/within X", "project/folder/repo X", "X Cell(s)",
  "a Cell for X".
- **The whole message**: "Harbor" alone opens the draft there and waits.

An anchored name switches at once, with the flight (decision 5). Anything
else is a mention, and a mention never routes. A project's exact name
mentioned inside a sentence gets a quiet dotted underline; clicking it
offers "Start in Atlas", which points the draft there (decision 2). The
name must be written as the project writes it, capital and all: "the board"
isn't the Board project. A sentence's first word says nothing by its
capital ("Resume the session"), and sound-alikes and the other number
("Lantern" for Lanterns) never get the underline.

**One Cell takes one place, and a Cell has one folder.**

- When the address and a cue both name a place, the address wins and the
  cue's place becomes a mention. "Harbor fix the header so it looks as it
  does in the Atlas repo" starts in Harbor.
- Two places pointed at with a cue in one sentence are two Cells, each with
  its own clause. "Fix the header in Harbor and the docs in Atlas" starts
  one in each. The readout says "2 Cells: Harbor, Atlas" before Send, and
  one click on a place token folds it back to one (decision 6).
- Otherwise the ladder picks the winner: the address, then a cue, then the
  whole message, the earliest first.

The other number routes only behind a cue or alone ("a Cell for Lantern" is
Lanterns): at the address, "Review notes" is a verb, not Reviews. Each word
of a heard (sound-alike) name must be part of the name, and it never ends
with a cue or a determiner: in the prototype, "review the" read as Reviews
until that rule went in. A fixture pins it.

Why: replaying 263 real births in the Swift app showed that every route from
an unanchored mention was wrong ("Review this Mac's disk" went to Reviews 20
times). Only anchored words route. "for/on/at X" doesn't count as an anchor
here either: "release notes for Atlas" may be about Atlas, not in it. The
quiet underline keeps the easy case one click away without guessing.

### 2. The text is the one truth; the draft's project sits under it
- The destination is the place the words point to, or else the draft's own
  project (the one the hero names when the draft opens, or picked there).
- Picking from a menu edits the words when the words set that thing: picking
  Atlas from the hero while the words say "Harbor fix…" makes them "Atlas
  fix…". When no word sets it, the pick sets the draft (T3's existing
  behaviour: the hero re-files the draft, the model picker sets the draft's
  model).
- Undo is the editor's undo. Delete the word and the hero goes back to the
  draft's project. There is no hidden pinned state.
- The draft stays filed under its own project until Send. The hero shows the
  destination, and Send creates the thread there, on that project's default
  model unless the words or a pick say otherwise.
- "Just a word" in a token's menu puts the word in quotes, which makes it
  literal, so nothing reads it. This is the escape hatch for a misread
  address, like "Atlas is a good name, write a tagline". It edits the text
  only on the person's own pick.

Why: the Swift app learned this the hard way. Every surface (phone, drafts,
dictation, the server) carries text already, and a hidden pin drifts from
it.

### 3. What the composer reads
| Kind | Examples | Anchored by |
|---|---|---|
| Place | "Harbor …", "in Atlas", "a Cell for Ledger" | address, cue, whole message |
| Model | "with Opus 5.5", "using Codex", "2 Sol", "Fable Cells", "Opus: …" | a cue (with, using, use, via, on, run, be, meant); a following Cell noun; a count after a launch word or at the address; plural; at the address when followed by ":", a connector, a place or an effort |
| Effort | "at max", "max effort", "xhigh", "extra high", "Opus 5.5 high" | the unambiguous words (xhigh, ultracode) anywhere; everyday words (low, medium, high, max) only with a qualifier ("effort", "reasoning", "thinking"), after "at/with" in a message that routes, or right after a model |
| Count | "2 Sol", "3 Harbor: …", "Harbor ×3", "spawn 3 Cells" | joined to a model, a Cell noun or an address place |
| Plan mode | "plan first", "just plan" | the address or the end |

- **Several Cells come only from typed words that ask for them**: a count,
  more than one model, a counted Cell noun ("3 Cells"; "Fable Cells" is two),
  one project opening each line, or two places pointed at with cues in one
  sentence (decision 1). A counted group shares itself out over its "one in
  X" phrases: "2 Cells, one in Harbor and one in Atlas". A count before its
  model is that model's: "3 Cells on Sol" is three Sol Cells. A mentioned
  place never adds a Cell. The readout shows the count before Send.
- **Access never loosens from words.** "Full access" is never read; access
  opens only from the picker. Words can only tighten it, to plan mode. This
  keeps every Cell safe by default.
- **Literal words never act**: anything in quotes, backticks or code blocks,
  in a markdown link, a `$skill` or a `/command`. Text in `[brackets]` after
  a spawn noun is one Cell's prompt, word for word (the Swift ⟦Pn⟧ rule).
- **Writing a model's name doesn't pick it.** "write a haiku" and "the flash
  message" stay text. A count anchors a model only after a launch word
  (spawn, start, want, need) or at the address.
- **In Aski's chat**, a live Cell's name ("Otter, rebase") is read as an
  address, in the Cell tone (`--sc-peer`).

### 4. How a word the composer read looks
- **One shape for every token**: the house token plate (corner 0.3 of 1.95
  caps, a wash at half the skin's tint, edge at half the tint edge). It's
  drawn round the editor's own text with what never moves a word: block
  padding (an inline box's doesn't change the line) and a `box-shadow`
  reaching a third of a space past the word, never inline padding or
  weight. So a word never moves when it's read, the caret never drifts,
  and a plate never meets the next word. This is the Swift rule ("colour
  and an underline only, never weight or a glyph") with a plate added.
  A read word gets no spelling marks.
- **Neutral by default.** Places, models, efforts and counts share one
  neutral wash; a place adds an underline (a where you could open). Colour
  is state: the accent blooms once when a word is first read (the "heard
  you" beat, 600 ms back to neutral), and `--sc-warning` marks a model whose
  provider isn't ready ("Codex isn't signed in"). Models don't wear brand
  colours in the field; the readout shows the provider's mark beside the
  name, as the picker does.
- A quiet mention is a dotted `--sc-mute` underline, with no plate.
- **Only the winner is inked.** If two readings compete, the token shows the
  one that routes and its menu lists the others.

### 5. Words go where they act: the flight
When an anchored word is complete (a space, punctuation, the caret leaving,
or 500 ms idle, never mid-word), a ghost of the token lifts off the field
and travels to the control it sets:

- A place flies to the hero's project name. The old name drops away
  (`leave`), the new one settles in (`settle`), the width eases, and the
  "?" rides along.
- A model or effort flies to its picker in the footer. The picker's label
  rolls to the new value and keeps a small mark that says "from your words".

A name that is the whole message so far waits for the pause before it
flies. While you type it, the first word of every message is briefly all
the message says.

Removing the word plays the roll in reverse with no flight: nothing flies
when something goes away. A flight that lands after a newer change doesn't
roll the label back. Under reduced motion, names crossfade.

Why: the person sees cause and effect in one glance, and it's the spawn's
own language ("in, around, out") at the size of one word.

### 6. A click on a token
The click places the caret as usual, and a small menu opens under the word.
It never takes focus: typing closes it.

- **Place**: the current project ✓, up to 5 recent projects, then the
  readings the words also allow, then "Just a word". When two cued places
  made two Cells, it also offers "One Cell, in Harbor", which puts the other
  place in quotes.
- **Model**: the providers' current models by concise name, each with its
  provider's mark, then "Just a word".
- **Effort**: the bound model's own ladder.
- **Count**: 1 to 6.
- **Quiet mention**: "Start in Atlas".

Picking replaces the word. An alias is learned only when the person picks a
different place for a sound-alike reading (typed "harber", read as Harbor,
picked Harbor Web). A guess never teaches itself.

### 7. Tab completes a project at the address
Port of the Swift `PlaceCompletion`. After 3 letters at the address with the
caret at the end of the word, the rest of the best name shows as a ghost in
`--sc-mute` with "⇥" in `--sc-faint`. Tab inserts it plus a space, as one
undo step. Candidates are prefix matches, the most recently used first. The
ghost hides during IME composition, with a selection, or when the field
isn't focused.

### 8. Models come from the providers' own lists
- Keywords are derived, never hand-kept, from each provider's catalog (the
  manifest and the Codex `model/list`): each model's name and aliases, its
  concise name ("Opus 5.5", "Sol 6.1"), its family alone ("opus", "sol") and
  the provider's name ("claude", "codex").
- A family alone means its newest current model. A provider's name means the
  destination project's default model on that provider, or the provider's
  own default.
- A version the catalog doesn't have isn't inked, and the family before it
  reads as the newest. The readout says which model will run.
- Effort clamps to the chosen model's ladder (its `optionDescriptors`): the
  nearest rung, rounding up on a tie. The token's menu says "Sol 6.1 tops out
  at Extra High".

### 9. One path from words to Cells
Every message that starts Cells, from a new chat or from Aski's tab, goes
through the same steps:

1. **Facts**: instant, local and free. The reader (decisions 1 to 8) sets
   the count, the places, the models, the efforts, the `[verbatim]` prompts,
   and how the work is shared when the words alone say it. The facts drive
   the tokens and the readout, and nothing after them can change them.
2. **Plan**: one model call, only for what the words left open (decision
   11).
3. **Check**: code checks the plan. The person checks it too when Aski
   chose something they couldn't see in their words (decision 12).
4. **Launch**: each Cell is created with T3's own
   `orchestration.launchThread`, placed by decision 15, with the spawn
   (decision 16).

- **One Cell from facts alone** starts at once, with no model call and no
  wait. That's the common case, and the draft becomes the Cell.
- **Several Cells whose places are set and whose work the words already
  share out** (a list, a clause each) start at once too.
- **Anything else** calls the planner.

Aski's own chat (its tab) is for talking to Aski: steering running Cells,
asking how things stand, finding a chat. A message there that starts Cells
takes this same path (decision 13).

Why not send every first message through Aski's chat: that would put a
model call before every Cell (the Swift app measured about 3 s at best),
and gain nothing when the words already say where and on what. It would
also pass the person's words through a layer that may paraphrase them, and
fill Aski's chat with dispatches. The Swift app's draft worked this way and
was right. Its placeholder was "Tell Aski what you need…".

### 10. The readout: what Send will do
- **One Cell**: the hero and the footer pickers are the readout. The hero
  names the destination; the model and effort pickers show what will run.
  No new line.
- **Several Cells**: the model and effort pickers give way to one sentence
  of tokens, the person's words read back, normalised:

  > **3 Cells**: **2 Sol 6.1** in **Harbor**, **Opus 5.5** at **Max** in
  > **Atlas** · Aski divides the work

- Each part shows where it came from. Your words are tokens. A default is
  dim, with no plate ("High"). What Aski will choose says so: "Aski picks
  from Harbor or Atlas", "Aski divides the work". Every token opens its
  menu (decision 6), and a pick edits the words.
- **A place is open** (Aski picks it) when no word points one out and
  either the chat has no project of its own (Aski's tab) or several Cells
  start from a message that mentions projects without pointing at them. One
  Cell never gets an open place: the mention stays quiet (decision 1).
- The hero follows: "What should we build in Harbor and Atlas?", "in 3
  projects?" past two, or "in projects Aski picks?".
- The Send button carries the count, so Enter visibly starts 3.
- The task line says how the work is shared: "one list item each", "each
  its own part" (the words split it into clauses), or "Aski divides the
  work". A Cell with its own clause gets the whole message, minus the setup
  words, with its clause named as its part. The clause alone can lose its
  verb ("the docs in Atlas"), and the Cell should see what its siblings do.
- Past the most Cells per message (Settings, 6), the count wears the
  warning edge, the readout says "8 is over your 6", and only ⌘↵ sends.
- Near a plan's usage limit, the model's provider says so ("Claude: 94 %
  of this week"). That's a warning only: Cells never move to another
  account by themselves.

Why: the person corrects a wrong count, model or place before anything
starts, in the words they already typed. That costs less than closing three
wrong Cells.

### 11. Aski's planner fills only what the words left open
**When.** Only for a gap:

- several Cells, and the words don't share out the work (no list, no
  clause each);
- a Cell whose place is open (decision 10).

Count, model and effort are never gaps. The words set them, or the
defaults do (decision 14). The planner never picks a model by how hard the
task looks: the Swift app found no evidence that a fixed tier misses, and
it's the person's plan that pays.

**The call.** One structured call, a new operation on T3's `TextGeneration`
service beside titles. It runs on the model chosen in Settings › Aski
("Aski thinks with") at low effort. It runs lean: no hooks, tools, MCP,
user settings or saved session, in a temporary folder as titles are. It
has a 20 s time limit.

**What it sees.**

- The words, with literal spans and ⟦Pn⟧ verbatims marked.
- The facts as numbered Cells. Each Cell carries its model, its effort, and
  its place or "open".
- A shortlist of projects, each with one line:
  - the mentioned ones (exact and sound-alike) first, then the recent ones;
  - at most 12;
  - each line is the first paragraph of the project's AGENTS.md, CLAUDE.md
    or README, read by the server and cached by the file's date.

**What it returns.** Only the gaps, for each Cell: `{cell, project?, title,
prompt}`. `project` is allowed only on an open Cell. Code joins the answer
to the facts to make the launch plan, one
`{project, provider, model, effort, title, prompt}` per Cell. The answer has
no field that could change a typed word.

**Code checks the answer.** Nothing else reviews it: there is no second
model call.

- Every Cell is answered once, and there is no extra one.
- An open Cell's project is in the roster (any project, not only the
  shortlist). A new project is allowed only when the words ask for one
  ("new project called Receipts"), and the readout shows it with a "new"
  tag.
- Every ⟦Pn⟧ verbatim lands word for word in exactly one Cell.
- Every task span of the person's words is used somewhere.
- No risky sentence appears that the person didn't write (decision 17).
- Titles are short and prompts aren't empty.

**One retry.** The planner gets one retry, with the failed checks listed,
when its answer failed them or the call failed fast. It never retries after
a timeout: a timeout means the model is slow, and a second slow call
doubles the wait. Two of the Swift planner's "declines" turned out to be
timeouts.

**The floor.** After that comes the floor plan: the Cells exactly as the
facts set them, each with the whole task ("Cell 2 of 3"), and any open
place left empty. It's shown as rows to check, marked "Aski couldn't divide
this" (decision 12). It never starts by itself, and it never collapses N
Cells into one.

**At a usage limit** on the planner's provider there is no call. The
floor shows, with one line saying why. The planner never switches to
another vendor by itself: that vendor would see the person's words.

Why one call, checked by code: the Swift app's split worked exactly this
way (one strong-tier call, a code judge, a floor). It got the count and the
counted place right in 18 of 18 live runs on a 139-project roster, and the
birth path around it passed a 263-birth replay. A second
model reviewing the first adds a second wait and a second way to fail, only
to check what code checks exactly. Whether each Cell got a sensible part is
something only a model could judge, and the evals measure it (decision 19)
instead of paying for it on every Send.

Why a shortlist, not every project: the Swift split sent the six closest
names with their lines, plus every name for checking. Input size is
latency: cutting the input from 12.6k to 5.9k tokens took the median call
from 6.0 s to 2.9 s. Every extra name is also one more chance of a
collision: a word in the instructions that matched a project lost the
place in 2 of 6 Swift runs. For the same reason, the planner's
instructions are run through the reader against the roster in a test.

### 12. Checking a plan Aski filled
When Aski chose a place, or the floor came back, the plan shows as rows
under the words before anything starts, one row per Cell:

> Opus 5.5 · Max · **Harbor** Server: passkey sign-in endpoints
> Sol 6.1 · High · **Atlas** Passkeys in the sign-in library

- **Sources.** Each field shows where it came from: your words (the token
  plate), a default (dim, no plate, and its menu says whose: "Atlas's
  default"), or Aski's choice (the plate with an accent edge). A field you
  change becomes yours.
- **A field your words set edits the words**, as everywhere (decision 2).
  Picking Fable 5.1 on a row whose "Opus 5.5" came from the text changes
  the text.
- **A field no word set changes on its row only**: a default, a place Aski
  picked, a Cell's part. A part isn't written back into the message,
  because it's Aski's words, not the person's. When a place changes, that
  project's defaults come with it, unless your words or your pick set the
  model.
- **The task line** opens into the Cell's whole first message, which you
  can edit. Enter keeps the edit.
- **Enter starts the Cells; Esc** drops the plan and gives back the words.
- **Editing the words** keeps the plan while the Cells stay the same (a
  different model or effort). When the Cells change (the count, a place),
  Aski's choices go, and Enter plans again.
- **Division-only plans don't stop.** When Aski only divided the work
  among Cells the words fully set, the Cells start at once, while the spawn
  plays. Each Cell's first message shows its part, and the risk hold still
  catches a risky sentence that Aski moved. Settings › Aski › Check Aski's
  plan can show every plan (Always) or none (Never).

Why check places but not divisions: a wrong place costs a whole Cell's run
in the wrong repository, and the words don't show the place. A division is
visible in each Cell's first message and cheap to steer. The Swift app had
no check at all. One is needed here because Aski now picks places the
words never named.

### 13. Aski's chat uses the same reading and the same path
- Aski's composer inks the same words, plus the names of live Cells ("Otter,
  rebase"), in the Cell tone (`--sc-peer`).
- Aski's page reads its own words first (`tasks/aski-room.md`, decision 14):
  a card's answer ("#2 yes", "for 1"). The reader takes the spans it
  claimed as blank. A bare leading number stays a count unless ":", ",",
  "." or an answer word follows, so "2 Sol in Harbor …" is two Cells. A
  live Cell's name at the head ("Otter, …") is the address: the message
  goes to that Cell (or answers its card) and starts nothing.
- A message that starts Cells (a model, a counted Cell, a spawn word, or a
  place at the address) takes the path in decision 9. Its places are open
  unless the words point at one, since Aski's chat has no project of its
  own. Anything else is a message to Aski: "what's new in Harbor?" and "how
  many cells are free?" are questions.
- From Aski's tab, the Cells open in new tabs right after it (decision 15),
  and you stay with Aski. Aski's reply is one line with each Cell's name: "Started 3
  Cells: Otter and Badger in Harbor, Puma in Atlas."
- When Aski's own turn starts Cells (`t3_thread_launch`, say after "ok, do
  it"), a server-side guard runs the same checks (decision 11) against the
  person's last message. The guard refuses a model or a place that the
  words didn't name and that the planner's rules wouldn't allow, and it
  refuses a wrong count. Every launch goes through the same checks.
- The persona changes from "each Cell gets its project's default model" to
  "each Cell gets the model and effort its words name, else its project's
  default".

### 14. Defaults, and where the person sets them
A Cell's model, effort and account resolve in one order: **your words,
then your pick in this draft, then the project's defaults, then the global
defaults.**

- **T3 already has this.** `defaultModelSelection` (the provider instance,
  which is the account; the model; and the effort among its options) lives
  in the settings, and a project can override it (`ProjectSettingsOverrides`;
  an absent key inherits). We add no second store.
- **Settings › Aski** is ours:
  - **Aski thinks with.** A provider and a model from that provider's
    catalog. The default is the strong tier (Opus 5.5 on Claude) at low
    effort. The "Recommended" label and any change of default come from an
    eval report (decision 19).
  - **Check Aski's plan.** When Aski picks a project (the default),
    Always, or Never.
  - **Most Cells per message.** 6.
  - **Plan history.** Kept 30 days on this machine, with a button to clear
    it.

Why the strong tier first: it is the Swift app's recorded choice ("strong
for spawn parsing, where a miss costs a whole Cell's run"), and the only
one measured on this job. Aski's calls were under 1 % of the person's
spend. The planner's job here is smaller than the Swift split's, because
count, model and effort are now facts. So the fast tier (Sonnet 5.5) may
well match it, and the first eval runs both. "Recommended" means measured.

### 15. Where the Cells land
- The first Cell takes the draft's pane.
- The others open as columns right after it, in the same tab, while every
  column stays at least 300 px wide (the narrow pane this design works at),
  up to 4 panes in the tab. Panes already there keep their order and count
  toward the 4.
- The rest open in a new tab right after, by the same rule, and so on.
  With no room for a second column (a narrow window, a 300 px pane), each
  sibling gets its own tab.
- From Aski's tab, which never splits: new tabs open right after Aski's,
  and you stay with Aski. The tab chip shows the Cells arriving.

This ports the Swift `ChatPlacement` (the first takes the draft's slot, and
the siblings follow right after it in birth order), with the column floor
raised for this slate.

### 16. The spawn: in, around, out
Several Cells play Aski's spawn. One Cell from a draft plays only the last
beat (its figure forms on its line), so a single prompt never waits on a
show.

1. **In.** The hero headline gives way to Aski (in Aski's tab, Aski is
   already there). The sent words leave the composer as letters, staggered
   `min(22 ms, 460 ms / n)` apart, up to 48 letters, and pour into Aski
   along a curve (`travel`).
2. **Around.** The letters orbit Aski while it plans: one turn when there's
   nothing to plan, or until the plan passes its checks ("Thinking it over"
   after 10 s). The panes open as soon as the plan is good: columns slide
   in and the draft pane narrows (`settle`).
3. **Out.** One stream per Cell leaves Aski, carrying that Cell's readout
   words ("Sol 6.1 · Harbor"). The nearest pane goes first, each 90 ms
   after the last, with at most 4 in flight, and paths never cross. In each
   pane the stream condenses into the Cell's figure (`. : + # @`, then
   `░▒▓█`), which hops onto its composer line, and the Cell's first message
   appears as its own. Aski fades back into the hero spot, then the hero
   leaves: the draft is now the first Cell.

When the plan needs a check, Enter doesn't play the spawn yet. The
readout's task line becomes "Aski is planning", with the forming glyph
cycling, the rows unfold (`unfold`), and the next Enter plays in, one turn
around, and out. If the floor comes back during a spawn, the letters stop
and the words return with the rows.

Under reduced motion the panes appear and the figures stand.

### 17. One safety floor for risky sentences
This ports `RiskFloor`: six classes (history, deletion, access, outreach,
money, release), each a verb and its object, with match and miss fixtures
("don't force-push" doesn't match).

- A Cell is held before it starts when its task holds a risky sentence that
  Aski wrote or rearranged, or that came by voice.
- The hold reads "Is this what you meant?", with the trigger in
  `--sc-warning`. ⌘↵ sends anyway; Esc gives the words back.
- A risky sentence the person typed into one Cell starts as typed. The
  Cell's own permission mode is the guard there.

### 18. Narrow panes (300 px)
- Tokens are the text itself, so they wrap with it. Plates never widen a
  line.
- The hero already moves the project name under "What should we build?",
  and the flight targets it there.
- The several-Cells readout takes its own line above the footer buttons and
  wraps like prose. Past two lines it folds to "3 Cells · Harbor, Atlas ▾",
  which opens the full sentence in a popover.
- A plan row wraps to two lines: model, effort and place first, then the
  task.
- Menus open as popovers no wider than the pane, and the flight's arc stays
  inside the pane.

### 19. Evals and the plan history
- **Facts tests run in CI**, on every PR, with no model. A corpus of
  sentences with their golden facts (count, places, models, efforts, how
  the work is shared) must match exactly, every case. The corpus is
  public-safe: invented project names, the Swift cases ported, and
  SC-legacy's routing fixtures.
- **Planner evals run by hand or nightly.** They spend, so they're never in
  the gate. `scripts/aski-eval` runs the planner over golden plans for a
  chosen provider and model, and writes a dated report:
  - exact match per field: count, project, model and effort. Count, model
    and effort are facts and must stay at 100 %; the project on open Cells
    is the planner's real score;
  - division: every span used, the verbatims intact, nothing risky added;
  - how often the checks failed, the retry fixed it, and the floor showed;
  - latency p50 and p90, and tokens in and out.

  It runs for the strong tier and the fast one. The "Recommended" label in
  Settings › Aski reads the latest report, and the default model changes
  only on a report.
- **There are two corpora.** The repo holds invented sentences and plans
  only. The person's machine holds real prompts the person chose to keep,
  in `a folder outside every repo`, outside every repo. They come from
  the person's own past chats and the Swift app's birth log, with plans the
  person confirmed. Reports show numbers only.
- **The plan history** records every plan, one line each: the words, the
  facts, the planner's answer, the checks, the time and tokens, the
  person's edits, and what launched. It lives in the app's own data folder
  on this machine, is never sent anywhere, and is kept 30 days. Settings
  clears it.
- **An edited plan is a correction.** `scripts/aski-eval --harvest` offers
  it to the person as a golden plan for the private corpus, to keep or drop.
- A small triage model comes in only if the reports show the facts missing
  messages that need a plan.

## Ported from the Swift app, and what's new
| Swift | Here |
|---|---|
| `PlaceResolver` anchor ladder (address > cue > whole), determiner veto, Metaphone + Jaro-Winkler, no gram across a sentence | Ported. The weak "for/on/at X" tier no longer routes (a quiet underline); one Cell takes one place by the ladder; a heard name never spans a cue or determiner |
| `Places` roster, labels for shared names, `lastBirth` ranking, blurbs | The projects store (T3's projects, sidebar names), ranked by last thread; a project's line from its AGENTS.md, CLAUDE.md or README |
| `ModelRouter.facts`: anchors, counts, `[brackets]` → ⟦Pn⟧, literal spans, list items, `newProjectName`, effort anchors and mends | Ported. Model keywords come from the catalog, not provider aliases kept by hand |
| `SpawnKeywords` + `SpawnInk`: one detector, one style on every screen | Ported, with a plate drawn outside the glyphs |
| `PlaceCompletion` (ghost + Tab, `choose` edits the text) | Ported |
| `PlaceChip` in the draft's foot | Replaced by the hero name, which T3 already has |
| `AgentSplit` + `judge` + floor, `needsAski` | Ported as the planner. It fills only the gaps (parts, open places); the judge becomes the checks; the floor shows as rows and never starts by itself |
| `ChatPlacement` | Ported, with a 300 px column floor, at most 4 panes per tab, then new tabs |
| `AskiSpawn` in / around / out | Ported to the slate. Panes open once the plan is good |
| `RiskFloor` + `RiskHold` | Ported |
| `tasks/aski-models.md`: tiers, "Recommended means measured", facts only at a limit | Kept. The planner's model is a Settings choice, defaulting to the strong tier |
| `AskiEval` (manual, labels as ids and offsets, private copies outside the repo) | Grown into the eval harness: facts tests in CI, planner evals by hand or nightly, a private corpus |
| Decree after Send ("4 Cells · …") | **New**: the readout before Send; the decree is the readout frozen |
| (none) | **New**: the flight (words go where they act), quiet mentions, "Just a word", the count on Send, checking a plan Aski filled, the plan history, one set of checks for every launch |

From the TypeScript rebuild (`SC-legacy`), keep:

- the screen and the server read the words with the same function, so the
  readout is a promise;
- effort clamps to the nearest rung, rounding up;
- "I meant X" replaces the keyword before it (dictation's correction);
- the risk lexicon has match and miss fixtures.

## What T3 gives us to build on
- **Composer**: Tiptap (`ComposerPromptEditorTiptap.tsx`), with inline chips
  re-derived from the text (`composerInlineTokens.ts`). Our ink is a
  ProseMirror decoration plugin. It never touches the doc, so undo,
  selection and serialisation stay upstream's. It needs no seam: a
  substitute for `ComposerPromptEditor.tsx` (a 12-line wrapper) gives the
  editor a class of its own, finds it, and joins it through Tiptap's own
  `registerPlugin`.
- **Triggers**: `detectComposerTrigger` (paths, skills, `/model`). Our reader
  skips their spans.
- **Draft hero**: `DraftHeroHeadline` / `DraftHeroProjectHeading` already
  names the project, with a picker that re-files the draft and applies the
  project's default model. A seam passes it the destination.
- **Draft store**: `useComposerDraftStore` (prompt, model selection per
  provider, runtime and interaction modes) and `selectedModelSelection` into
  ChatView's send. A seam lets the words override at send.
- **Models**: `ServerProvider.models` (the manifest and the Codex
  `model/list`), effort as `optionDescriptors`, and `conciseModelName` for
  the names.
- **Defaults**: `defaultModelSelection` in the settings, overridable per
  project through `ProjectSettingsOverrides`. That is the whole resolution
  order below the words. The planner's own model follows the pattern of
  `textGenerationModelSelection`.
- **Launch**: `orchestration.launchThread` creates a thread with its
  project, model selection, modes, workspace and first message in one call.
  T3's fan-out (`startFanoutThread`) already starts one thread per model in
  one project.
- **Aski's tools**: `t3_thread_launch` (any project; never broader modes than
  the caller), `t3_project_list` and `t3_thread_list`.
- **One-shot calls**: `TextGeneration` runs structured one-shot calls on a
  provider instance (titles, commit messages), with JSON Schema output. Its
  Claude call turns off hooks, tools and MCP, but it doesn't pass
  `--setting-sources ""` or `--no-session-persistence`, so it may still load
  user settings and save a session for every call. The planner operation
  measures that against the Swift lean recipe and adds what's missing.
- **Slate**: `tabs/layout.ts` (tabs → rows → columns → panes) for placement;
  the motion tokens (`flick`, `fade`, `leave`, `settle`, `travel`) in
  `tokens/stemcells.css` and `tokens/motion.ts`.

## PR slices
1. **The reader.** Built: `apps/web/src/stemcells/words/`.
   - It lives in the web app until the server needs it (slice 5), then
     moves to `packages/stemcells-words`. A package before two apps share
     the code would rewrite upstream's lockfile for nothing.
   - Pure functions: places, models from the catalog, efforts with
     clamping, counts, literal spans and brackets, open places, and the
     facts (Cells with a place, model, effort and part).
   - The public corpus with golden facts (`fixtures/corpus.json`), run in
     CI. Each anchor rule has a case that fails without it: removing the
     rule turns a case red.
   - No UI. A 2,100-character message reads in about 10 ms against 200
     projects; a typical one in a fraction of a millisecond.
2. **Ink and completion.** Built: `words/plugin.ts`, `words/words.css`,
   `words/ComposerWords.tsx`, joined to the editor by a substitute
   (no seam), reading through `upstream/words.ts`.
   - The token plate, quiet mentions, the caught bloom (a word that only
     moves keeps its bloom's age), and Tab completion as one undo step.
   - A new chat's composer reads; a sent chat's doesn't. The document is
     read as text with code blank and a chip one character.
   - The reader takes spans Aski's cards claimed, and a live Cell's name at
     the head of a message to Aski (fixtures for both).
3. **One Cell from words.**
   - The hero shows the destination (a seam).
   - The pickers follow the words, edits go back into the words, and
     project defaults resolve in the order of decision 14.
   - Token menus, "Just a word" and the flight.
   - Send creates the thread in the destination with the words' model and
     effort, minus the grammar words.
4. **Several Cells from words alone.**
   - The readout sentence, the count on Send and the Cells cap.
   - A launch adapter over `orchestration.launchThread` (lists, clauses).
   - Placement in the slate, and the spawn.
5. **The planner.**
   - The `TextGeneration` operation, run lean, with its arguments pinned
     by a test.
   - The shortlist and project lines, the schema, the checks, the retry,
     the floor, and the risk floor with its hold.
   - The plan history.
6. **Checking a plan, and Settings.**
   - The plan rows: sources, edits, Enter and Esc, and keep-or-drop on text
     edits.
   - Settings › Aski: thinks with, check, most Cells, plan history.
7. **Aski's chat.** Cell names inked, the same path from Aski's tab, new
   tabs, the guard on `t3_thread_launch` (server), and the persona change.
8. **Evals.** `scripts/aski-eval` (planner evals and the report), the
   private corpus and `--harvest`, and the "Recommended" label reading the
   report. The first run compares the strong and fast tiers.
9. **Learning.** Aliases from picks, and the dictation mends if voice input
   lands.

Slices 1 to 3 stand alone and make the new chat smart for one Cell. Slices
4 to 7 make it many, and 8 says how good it is.

## Open
- Codex efforts come from the live `model/list` for each model. The clamp
  reads them there, never from a table.
- A project's line comes from its first paragraph today. If that reads
  badly for the planner, the project's settings get a one-line description
  the person can edit.

## Appendix: a suspected bug in the Swift reader
The Swift resolver probably hears "review the" as the Reviews project, at
the address of "review the showtime parser". From reading the code:

- its near-spelling check scores a gram of up to three words at 0.95 ×
  Jaro-Winkler, and "reviewthe" against "reviews" scores 0.86, over the
  0.85 route floor;
- `PlaceResolver.endsInCue` allows only exact names in a gram that ends
  in a cue word, but its cue set has no determiners, so "review the" stays
  a near-spelling candidate;
- the word after it isn't a determiner, so the gram stands at the address.

It's unconfirmed: nothing ran the Swift app on this sentence, and its
corpus has no case for it. It showed in this design's prototype, which
ported the same check. Here a heard name never ends with a cue or a
determiner, and `read.test.ts` pins it. Nothing is changed in the Swift
app.
