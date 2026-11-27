# Aski, the orchestrator: one message in, the right things out

A person talks to Aski, often by dictation, and says several things at
once: "a Fable Cell on high for the product page, a second for Harbor's
film page, one Sol Cell for the ad copy, and a new project called Vacuum
Cleaners". Or they ask: "where was that chat about the film page two days
ago, what came of it?" Or: "turn the sounds off." Aski must get each of
these right, fast, and never do harm from a misheard word.

This is the architecture. It changes parts of `prompting.md` and
`aski-manager.md`; "What changes" lists them. Nothing here is built yet.

## What was measured first

- **Today's reader on five messy requests: none right.** Run through
  `readWords` with the test roster. "Fable agent on high, one for …, the
  second for Harbor's …, one for Atlas …, and one Sol agent for …" read
  as 2 Cells, not 4. A request with a misheard model read as 1 Cell and
  no launch. "Start three agents. First one … Second one … Third one …"
  read as 6. Two of the five would have started at once with no check:
  one gave Sol to the wrong project's Cell, and both dropped "a new
  project called …" without a word.
- **One untuned call on the fast tier split the first request into 4
  Cells with the right places.** One sample, so a direction, not a score.
- **Where the time goes** (lean one-shot calls on this Mac, one small
  request, two or three runs each):

  | Call                  | First row   | All rows    |
  | --------------------- | ----------- | ----------- |
  | Haiku 5.5, low effort | 3.0 s       | 3.5 s       |
  | Haiku 5.5, default    | 4.4 – 4.7 s | 5.0 – 5.2 s |
  | Sonnet 5.5            | 5.3 – 11 s  | 6 – 12 s    |

  Starting the process costs about 0.25 s. Once the answer starts, every
  row is out within 0.6 s. The rest is the model reasoning before its
  first character: 600 to 1,500 tokens of it. Three ways to switch that
  off through the CLI changed nothing.

- **Today's Aski** is an ordinary chat with full access. It can call
  `t3_project_delete` with no question asked, starts Cells one tool call
  at a time, and its persona gives every Cell its project's default model,
  so "on Sol" can't be honoured. Dictation exists in the composer, and
  nothing marks a message as dictated.
- **Recall today**: search has no time filter, nothing stores what a Cell
  did, and a digest means reading transcripts one by one.
- **Isolation today** is a rule in the persona. Any Cell can read any
  project's chats through its tools.

## What others do

Read from their public docs, 2026-11-27.

- Claude Code's teams and Devin's managed sessions start children with no
  confirm by default. Devin has a switch for a review per batch.
- A common complaint about manager agents: the manager rewrites the task
  and pads it with stale context.
- Codex caps a fan-out at 6 threads and one level deep.
- Firstmate keeps its manager read-only over projects, and its voice path
  only queues work.
- T3 Code: an agent can't approve its own permission request.
- None documents what happens when dictation mishears, and none scopes a
  manager's memory by project.

Taken from them: consent only a person can give, a manager with no power
to change projects, a cap, and the review switch. Ours alone: Cells get
the person's own words, the check is set by harm, and the plan streams in
as Cells forming.

## Principles

1. **Aski routes; the Cell interprets.** Aski decides who, where and with
   what. It never rewrites what. A garbled sentence is best understood by
   the Cell standing in the repository, which can also ask.
2. **The model proposes, code decides.** A model reads the mess. It
   returns data, and code checks every field before anything happens. The
   model holds no tool.
3. **Fuzzy to read, exact to act.** Finding a chat may guess: a wrong
   guess costs a glance. Starting a Cell in a project needs the project's
   exact name, or the person's tap.
4. **Harm sets the check, not the model's confidence.** A wrong model on a
   Cell costs a click to fix. A wrong project costs a run in the wrong
   repository. A deletion can't be taken back. Three tiers follow.
5. **One boundary: what goes into a Cell.** Aski knows every project, as
   the person does. So the one place to guard is the text Aski hands a
   Cell.
6. **Aski can't destroy.** No path from words to a deletion exists
   without a person's hand on the named thing.
7. **Evidence first, prose after.** A question about the past shows the
   Cells it found at once; Aski's sentence follows.

## Decisions

### 1. Aski is two parts: the compiler and the chat

- **The compiler** turns one message into a plan. It is one model call
  with no tools, no memory of earlier messages and no project's files.
  It runs on the server, so the Mac, the phone and the Duo share it, and
  so there is one place where the checks are enforced.
- **The chat** is Aski's conversation as today: it answers, recalls and
  talks. It starts nothing by itself. When it wants Cells started ("ok,
  do it"), it calls `aski_propose`, which makes a plan that takes the
  same checks and always waits for the person (decision 4).
- **Which part gets a message** is decided by code, at once: any sign of
  setting something up (a Cell noun, "agent", a count, a model, a launch
  word, "new project", a deletion word) sends it to the compiler. The
  test leans toward the compiler: a miss there costs a second, and the
  compiler hands back whatever is talk. Everything else goes to the chat.

### 2. The plan is a list of acts

| Act           | What it is                                          | Tier (decision 4)    |
| ------------- | --------------------------------------------------- | -------------------- |
| `start`       | A Cell: place, model, effort, its words, a title    | Start or Check       |
| `project.new` | A project by name, and the Cell that starts in it   | Check                |
| `tell`        | The person's words to a live Cell ("Otter, rebase") | Start                |
| `set`         | A setting, shown as its live control                | The person's tap     |
| `tend`        | Sleep, Snooze, Wake or stop for named Cells         | Start; stop is Check |
| `destroy`     | Delete a project, archive Cells                     | Hold                 |
| `ask`         | A question or talk, handed to the chat              | none                 |

One message can hold several kinds. "Start these three, turn the sounds
off, and what happened in Harbor yesterday?" is three `start`, one `set`
and one `ask`.

### 3. The compile call

- **Code cuts the message into numbered pieces first**: at sentence ends,
  line breaks and list marks, and, since dictation has no punctuation, at
  the words that open a new item ("one for", "the second", "another",
  "also", "and then"). Pieces are small on purpose.
- **The model sees**: the pieces; every project's name and aliases (names
  are cheap, and a shortlist would drop a misheard one); a line about the
  dozen most recent projects; the models and their effort ladders; the
  live Cells' names; and what the reader found for certain (exact names).
- **The model returns one line per act, as it thinks of it**:
  `{act, pieces: [3,4], place: {name, heard: "harbour"}, model: {name,
  heard}, effort, title}`. `pieces` are numbers. `heard` is the word or
  two it read the name from, copied from a piece. A piece can be marked
  setup ("on high"), shared ("all of them write tests") or talk.
- **It returns no prose for a Cell.** The only words it writes are the
  title, six words at most. A Cell's message is put together by code from
  its pieces (decision 6). This is why the answer is short, and so fast:
  about 40 tokens a Cell.
- **A group's setting covers its items.** "Fable on high, one for A, a
  second for B, one Sol for C" gives A and B Fable at high and C Sol at
  the default. Reading this is the model's job; it is what the reader
  could not do.
- **A correction replaces.** "the second one, I meant Sol" changes that
  Cell's model and adds none.
- **Changing a plan by words** is the same call with the waiting plan as
  input: "the second one goes in Atlas" comes back as an edit.

### 4. Checks, and three tiers

Code checks each line as it arrives:

- Every piece belongs to an act, or is marked setup, shared or talk.
  A piece left over stops the plan from starting on its own.
- Every `heard` is in the message, word for word.
- A name is real: in the roster, the catalog or the model's own ladder.
- The reader and the compiler don't disagree on an exact name.
- No act is more than the cap allows (decision 5).

Then each act gets a tier:

- **Start**: begins at once. A Cell's place is its exact name or alias,
  said inside its own pieces, or the message's one place. Its model and
  effort are exact names, or defaults. Its words hold nothing risky.
- **Check**: waits for one tap or Enter. Any of: the place was heard
  near, not exact ("harbour"); Aski picked the place; a new project; a
  risky sentence (decision 7); past the cap; a `stop`; anything
  `aski_propose` made.
- **Hold**: a `destroy`. Decision 7.

A model or effort read from a group never forces a Check: it shows on the
row and costs a click to change. A place always must be exact to start.

**Settings › Aski › Check Aski's plan**: When unsure (the default),
Always. There is no Never: a Hold can't be switched off.

### 5. Starting, calling back, and caps

- Acts in the Start tier begin while later lines are still arriving.
  Launches run side by side, through T3's `orchestration.launchThread`.
- **Cells Aski starts open no tab.** They form in the Awake list, at the
  top, and the person stays with Aski. A click opens one.
- **Call back** stands on the plan for ten seconds, or until the person
  leaves: it stops those Cells and removes them. A provider's session
  takes seconds to come up, so a Cell called back has done nothing.
- Six Cells a message start freely (Settings). More is a Check. Twelve is
  the ceiling. A Cell Aski started can't have Aski start more for it.
- A provider near its plan's limit says so on the plan, as the readout
  does today.
- When the call fails or times out, nothing starts. The plan shows what
  code alone is sure of as rows to check, and says Aski couldn't read the
  rest.

### 6. What a Cell is told

- Its own pieces, in the person's order, word for word, then the shared
  pieces. Setup words are left out. Nothing else from the message.
- One fixed line from code when the message was dictated: a name may be
  misheard, ask before guessing.
- So a Cell in Harbor never sees the task given to the Cell in Atlas. The
  old shape sent every Cell the whole message with "Your part: …".
- A sentence that names another project on purpose ("match the one in
  Atlas") goes as said: the person chose that.

### 7. Safety

- **Aski's chat loses its powers.** It runs with reading tools,
  `aski_propose` and the settings card: no shell, no file edits, no
  `t3_project_delete`, `t3_project_create`, `t3_thread_launch` or archive.
  The server refuses these from Aski's instance, whatever its mode.
  Reading a hostile page or a Cell's reply can no longer make Aski do
  anything but propose.
- **A Hold is confirmed by hand on the thing itself.** The card names
  what was resolved: the project as the sidebar writes it, how many Cells
  go, what stays on disk. The person presses and holds on that name.
  Words never confirm it: not "yes", typed or spoken, and not Enter. The
  server takes the confirm only from a person's client, never from an
  agent's tool call.
- **A deletion never rides along.** When a message holds a `destroy`,
  nothing else in it starts until the person has dealt with the Hold:
  mishearing often breaks a whole message, not one word of it.
- **A risky sentence in a Cell's words** (the six classes of the risk
  floor: history, deletion, access, outreach, money, release) makes that
  Cell a Check, with the sentence marked: "Is this what you meant?" This
  holds for typed and dictated words alike in Aski's chat. The other
  Cells start.
- **A message knows how it was made.** The composer marks it dictated
  when speech put any of it there. Dictated messages get the fixed line
  (decision 6) and never use the instant path (decision 11).
- **Access never loosens from words**, as before. A Cell starts in the
  person's default mode, or tighter.
- **The compiler can't add an instruction.** It returns piece numbers,
  and code builds the message. A sentence the person didn't say can't
  reach a Cell through it.

### 8. Recall: what happened, and where

- **Every Cell keeps a card**, written by the server each time it lands:
  its project, title, what the person asked (the opening of each of their
  messages), its close-out line and verdict, the facts already computed
  (lines changed, checks, pull request), its model, and when it was born
  and last landed. No model call makes it: the Cell's own close-out is
  the summary.
- Cards live in our own store on this machine, with full-text search.
  The ledger stays wordless. A card goes when its Cell is deleted.
- **A question shows its Cells first.** Code reads the time ("two days
  ago", "last week", "Tuesday") and the project, by ear here, since a
  wrong guess costs nothing. The matching Cells show under the question
  at once, each as its pill: a link into the chat. Then Aski's lines
  arrive, written from those cards alone: what was asked, what came of
  it, what is left.
- "What did we do in Harbor this week" is the same: cards by project and
  time, grouped by day, each line a link.
- Aski reads a transcript only when the person asks to go deeper into one
  Cell.
- `stemcells_recall` gives the chat the same search, with time and
  project filters, across Awake and Asleep.

### 9. Settings

Built already (`settings-in-chat.md`): Aski shows the live control with a
value suggested, and the person's tap applies it. Two additions:

- A message that plainly names one setting shows its card at once, with
  no model call. The names are matched by ear: the card changes nothing
  until tapped.
- A `set` inside a longer message gets its card in Aski's reply.

Aski still changes no setting itself. The guarded rows stay guarded.

### 10. Nothing bleeds between projects

- **The boundary is what Aski hands a Cell.** Two things may cross it:
  the person's own words (decision 6, checked by code), and a fixed act
  the person switched on in Settings (retry, go ahead, implement). Text
  Aski wrote itself crosses only as a Check that shows every word of it
  and names any other project or Cell it mentions.
- **A Cell reads its own repository's chats.** `t3_thread_list`, `read`
  and `search` from a Cell answer for its repository, as the peers'
  roster does. A chat from elsewhere comes in when the person attaches
  it. Aski's chat still reads everything.
- **Recall goes to the person**, in Aski's chat, so a digest across
  projects is fine there. It can't be forwarded into a Cell except
  through the boundary above.
- Not built: judging by meaning whether a text is sensitive. No check of
  that kind is reliable, and one that is right nine times in ten reads as
  a promise it can't keep. A project the person marks as sealed (out of
  Aski's reading and digests) can come later if the boundary proves too
  loose.

### 11. Speed

The choices, with what was measured:

| Way                               | Wait for the first Cell | Accuracy on messy words       |
| --------------------------------- | ----------------------- | ----------------------------- |
| Code alone (today's reader)       | none                    | 0 of 5                        |
| One call, fast tier, low effort   | 3 s today               | right on the one case tried   |
| One call, strong tier             | 5 to 11 s (Sonnet)      | unmeasured here               |
| Aski's chat calling tools (today) | one turn per Cell       | the persona can't set a model |

- **The compiler runs on the fast tier at its lowest effort.** The checks
  catch its misses and turn them into a Check, so a miss costs a tap, not
  a run. When the checks fail, one retry goes to the strong tier.
  "Recommended" follows the evals (decision 14).
- **The first slice finds the floor.** Nearly all of the 3 s is the model
  reasoning before it writes. With that off, the first row would arrive
  near 1.3 s. The slice tries the provider's SDK session and Codex's fast
  models, and records the numbers. The target is a first row within
  1.5 s and all rows within 2.5 s. If the floor stays near 3 s, the design
  stands: the spawn fills the wait honestly (decision 12).
- **A process stands ready** while Aski's composer has focus, which saves
  the 0.25 s.
- **The instant path** stays for what code can prove: a typed message
  that is one Cell with an exact place, or the same task for a count of
  Cells. No call at all.
- Rows arrive one at a time over about half a second. The spawn uses
  that rhythm instead of inventing one.

### 12. The spawn in Aski's chat

One timeline on the Mac, the phone and the Duo, built from what exists
(`interaction.md`, The spawn; `cell/forming.ts`).

1. **Send.** The words leave the composer as letters and pour round Aski,
   who reads them. Words code already knows (exact names) light as they
   go.
2. **Each act arrives.** Aski pulses and throws a copy of itself to the
   top of the Awake list. There the Cell forms through `. : + # @` into
   its creature, and its line settles out of the same glyphs, left to
   right: the project's mark, the Cell's name, model and effort, then the
   title. Rows below glide down. At most four form at once.
3. **A Check forms as an outline**: dim, with the unsure field marked,
   and stays that way until tapped. A Hold forms no row. It is a card in
   Aski's chat.
4. **The plan stands in Aski's chat** as rows, one per act: model, effort,
   place, title. Each field opens its menu. It closes into one line once
   everything has started: "Started 4 Cells: Otter and Badger in Harbor,
   Puma in Atlas, Wren in Vacuum Cleaners", each name a link.

On the phone the rows form in the home list, and on the Duo in the home
column beside Aski. Every motion is one-shot, on the 12-a-second beat, and
moves only `transform` and `opacity`. Under Reduce Motion the rows fade
in.

The row needs three new things: the Awake row's Cell must be able to form
(today only a pane's does), a copy needs a row to fly to, and a row must
show before the server lists its Cell. The plan gives the row its id.

### 13. Aski learns the person's voice

When the person confirms a name heard near ("harbour" is Harbor, "table"
is Fable), Aski keeps it as an alias, on this machine. Next time it is
exact, and the Cell starts with no tap. An alias for a model counts only
where a model is named, so "table" stays a table elsewhere. Settings
lists them and removes them.

### 14. Evals decide

- A public corpus of invented messy messages with their right plans,
  dictation errors included; a private one of real messages on the
  person's machine, as `prompting.md` decision 19 says.
- Scores per model: the count of Cells, each field, pieces assigned, time
  to first row and to all.
- **Two numbers gate a change**: no Cell in the Start tier that is wrong
  in place or words, and every `destroy` held. Both must be perfect on
  the corpus. Everything else is tuned toward fewer Checks.
- The code checks, the tiers and the cutting into pieces are tested in
  CI with no model.
- The compiler's instructions are text a model reads: `evals/README.md`
  applies.

## What changes in what's built

- **The reader** (`words/`) stays the composer's: ink, the flight, one
  Cell from words. It no longer starts several Cells with different tasks
  by itself (`prompting.md`, slice 4): those go to the compiler, in every
  door. It moves to `packages/stemcells-words` when the server reads with
  it.
- **The planner** (`words/plan/`, `server/planner/`) becomes the compiler:
  on the server, streaming, returning piece numbers, able to set model,
  effort and count. The floor, the plan history and `runLean` carry over.
- **`prompting.md`**: decision 9's "nothing after the facts can change
  them" holds only for one Cell. Decision 11's "count, model and effort
  are never gaps" goes. Decision 13 and slice 7 are replaced by this
  file. Decision 15's tabs don't apply to Cells Aski starts. Decision
  17's risk floor is kept and widened (decision 7 here).
- **`aski-manager.md`**: "Cells receive only the person's words" becomes
  code, not a rule in the persona.
- **The persona** loses its launch instructions and gains `aski_propose`
  and `stemcells_recall`.

## Slices

Each lands on the Mac and the phone together where a person sees it.

1. [ ] **The floor and the corpus.** Measure the fast call with reasoning
       off, on Claude and Codex. Write the public corpus and the scoring
       script. No product change.
2. [ ] **The compiler on the server.** Pieces, the call, the checks, the
       tiers, the plan stream, the commit. Tested with a fake model.
3. [ ] **Aski's chat uses it.** The gate, the plan rows, Start and Check,
       Call back, Cells without tabs, the dictated mark. Aski's chat
       loses its launch tools.
4. [ ] **Hold.** `destroy`, the press-and-hold confirm, the server's
       refusals for Aski's instance, risky sentences as Checks.
5. [ ] **The spawn in the Awake list**, Mac, phone and Duo.
6. [ ] **New projects and heard names.** `project.new`, near names as
       Checks, aliases learned from confirms.
7. [x] **Recall.** Cards, the search, the pills under a question,
       `stemcells_recall`.
       Built: a card per Cell in `stemcells/recall.sqlite` (FTS5), written when a run starts
       or lands and checked against every chat at each start; `GET /api/stemcells/recall` and
       `stemcells_recall` (a Cell reads its own repository's); the pills under a question in
       Aski's chat on the Mac and the phone; search took 0.2 to 6 ms over 5,000 cards.
       Left: time words are English only; the phone's pills stand on the reply's side of the
       feed; the persona's new lines and the tool's description have no eval (upstream's
       runner offers neither the persona nor our tools), and no client was run to look at them.
8. [ ] **Cells read their own repository.** The read scope, and Aski's
       own text as a Check.
9. [ ] **Settings at once**, and Settings › Aski's rows.

Slices 2 to 4 are the core and ship in that order. 5 makes it a joy. 7
and 8 stand alone.

## Open

- Whether reasoning can be switched off on each provider (slice 1).
- The cap of twelve is a guess until someone hits it.
