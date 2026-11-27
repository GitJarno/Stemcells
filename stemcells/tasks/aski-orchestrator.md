# Aski, the orchestrator: one message in, the right things out

A person talks to Aski, often by dictation, and says several things at
once: "a Fable Cell on high for the product page, a second for Harbor's
film page, one Sol Cell for the ad copy, and a new project called Vacuum
Cleaners". Or they ask: "where was that chat about the film page two days
ago, what came of it?" Or: "turn the sounds off." Aski must get each of
these right, fast, and never do harm from a misheard word.

This is the architecture. It changes parts of `prompting.md` and
`aski-manager.md`; "What changes" lists them. Slices says what is built,
and Open what isn't.

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
the person's own words, the check is set by harm, and the plan arrives
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
  It runs on the server (`apps/server/src/stemcells/aski/`), so the Mac,
  the phone and the Duo share it, and the checks are code in one place
  (`stemcells/orchestrator/`).
- **The chat** is Aski's conversation as today: it answers, recalls and
  talks. It starts nothing by itself. When it wants Cells started ("ok,
  do it"), it calls `stemcells_propose`, which makes a plan in which
  every Cell waits for the person (decision 4).
- **Which part gets a message** is decided by code, at once
  (`orchestrator/gate.ts`): a sign of setting something up (an agent or
  Cell to start, a count, "new project", a deletion, a project's name at
  the head) sends it to the compiler. A question stays the chat's unless
  it also says to start something.
- **The message still goes to Aski's chat at once, as written.** The
  client first tells the server a plan is coming (`/expect`), so the
  chat's turn waits for it; beside the message Aski then reads one line
  from code saying a plan is being carried out. Aski starts nothing,
  reads what came of it (`stemcells_plan`) and answers in one line with
  each Cell linked. When the server doesn't hear in time, the message is
  the chat's alone and Aski can only propose.
- **The client carries the plan out**, with the person's own commands
  and access: the server never starts a Cell for a plan. It keeps the
  plan, what came of each act, the plan history and the learned names.

### 2. The plan is a list of acts

| Act       | What it is                                            | Tier (decision 4) |
| --------- | ----------------------------------------------------- | ----------------- |
| `start`   | A Cell: place, model, effort, its words, a title      | Start or Check    |
| `start`   | The same in a project to make first ("a new project") | Check             |
| `destroy` | Delete a project from the app, archive Cells          | Hold              |

Everything else in a message is **talk**: a question, a setting, a word
to a running Cell, Sleep and Wake. It stays with Aski's chat, which has
the tools for it and reads the plan's report to know what is its to
answer. One message can hold both: "start these three, and what happened
in Harbor yesterday?" is three `start` and a question for the chat.

### 3. The compile call

- **Code cuts the message into numbered pieces first**
  (`orchestrator/pieces.ts`): at sentence ends, line breaks and list
  marks, and, since dictation has no punctuation, at the words that open
  a new item ("one for", "the second", "another", "then in Harbor").
  Pieces are small on purpose.
- **The model sees**: the pieces; every project's name and the names the
  person taught (names are cheap, and a shortlist would drop a misheard
  one); the models and their effort ladders; the awake Cells' names.
- **The model returns one answer**: per act its piece numbers, the place
  and model with the word each was heard from, the effort, a count and a
  title; and which pieces are setup or talk. A piece can stand in
  several acts (an instruction for all).
- **It returns no prose for a Cell.** The only words it writes are the
  title, six words at most. A Cell's message is put together by code from
  its pieces (decision 6). This is why the answer is short.
- **A group's setting covers its items.** "Fable on high, one for A, a
  second for B, one Sol for C" gives A and B Fable at high and C Sol at
  the default. Reading this is the model's job; it is what the reader
  could not do.
- **A correction replaces.** "the second one, I meant Sol" changes that
  Cell's model and adds none.

### 4. Checks, and three tiers

Code checks the answer (`orchestrator/check.ts`):

- Every piece belongs to an act, or is setup or talk. A piece left over
  makes every Cell wait.
- Every heard word is in the message, word for word. A model that was
  never said is dropped.
- A name is real: in the person's projects, the catalog or the model's
  own ladder.
- No more Cells than the cap (decision 5).

An answer that fails is asked for once more, on a stronger model, with
what failed; then code weakens what it can't prove, or nothing starts.

Then each act gets a tier:

- **Start**: begins at once. A Cell's place is its exact name, said in
  its own pieces, carried forward from the place said before them, or
  the message's one place. Its words hold nothing risky.
- **Check**: waits for one tap, or Enter on an empty composer. Any of:
  the place was heard near, not exact ("harbour"); Aski picked it; none
  was named; it was said, but as code reads the sentence it may be
  another Cell's; a new project; a risky sentence (decision 7); past the
  cap; words left over; a deletion in the same message; anything
  `stemcells_propose` made.
- **Hold**: a `destroy`. Decision 7.

A model or effort read from a group never forces a Check: it shows on the
row and costs a click to change. A place always must be exact to start.

**Settings › Aski › Check every plan**: off (the default), a Cell Aski is
sure of starts at once; on, every Cell waits. There is no Never: a Hold
can't be switched off.

### 5. Starting, calling back, and caps

- The client starts the Start tier at once, side by side, as a
  multi-Cell send starts its threads, each in the person's default
  access mode. The plan mints each Cell's thread id, so its name and its
  row are known before it exists.
- **Cells Aski starts open no tab.** They form in the Awake list, at the
  top, and the person stays with Aski. A click opens one.
- **Call back** stands on a Cell's row for ten seconds: it stops the
  Cell and archives it. A provider's session takes seconds to come up,
  so a Cell called back has done nothing.
- Six Cells a message start freely (Settings › Aski). More is a Check.
  Twelve is the ceiling.
- When the call fails or times out, nothing starts: the plan says Aski
  couldn't read it, and the message is the chat's.
- A Cell with no model named runs on its project's default, with the
  effort the person said when that model has it.

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

- **Aski can't start or destroy.** The server refuses, from Aski's
  instance and whatever its mode, here or bound for a linked machine:
  `t3_thread_launch`, `create_threads`, `t3_project_create`,
  `t3_project_clone`, `t3_project_delete` and an archive
  (`upstream/askiTools.ts`). Reading a hostile page or a Cell's reply can
  no longer make Aski do more than propose.
- **No agent deletes a project.** `t3_project_delete` is refused to every
  Cell too, so Aski can't have a Cell do what it can't, and a Cell told to
  delete one in misheard words says the person does that by hand.
- **A Hold is confirmed by hand on the thing itself.** The card names
  what was resolved, as the app writes it, quotes the person's words and
  says what stays on disk. The person presses and holds its button.
  Words never confirm it: not "yes", typed or spoken, not Enter, not
  "Start all", not a click. The deletion is the client's own command,
  sent only when the hold completes; no tool of Aski's reaches it.
- **A deletion never rides along.** When a message holds a `destroy`,
  nothing else in it starts until the person has dealt with the Hold:
  mishearing often breaks a whole message, not one word of it.
- **A risky sentence in a Cell's words** (the six classes of the risk
  floor: history, deletion, access, outreach, money, release) makes that
  Cell a Check, with the sentence marked: "Is this what you meant?" This
  holds for typed and dictated words alike. The other Cells start.
- **Every message is read as if it were dictated**: a place must be its
  exact name to start, and a name heard near waits. A client that knows
  speech wrote the message says so, and its Cells get the fixed line
  (decision 6).
- **Access never loosens from words**, as before. A Cell starts in the
  person's default mode.
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
value suggested, and the person's tap applies it. A setting named in a
message is talk (decision 2), so it reaches Aski's chat as before. Aski
still changes no setting itself. The guarded rows stay guarded.

Settings › Aski › Starting several Cells has the plan's own rows: Aski
divides the work (off, no compiler runs), Check every plan, Most Cells
one message starts, and Names Aski learned with Forget.

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

| Way                               | Wait for the plan             | Accuracy on messy words       |
| --------------------------------- | ----------------------------- | ----------------------------- |
| Code alone (the reader)           | none                          | 0 of 5                        |
| One call, fast tier, low effort   | 3 to 3.5 s alone; 4.7 s (p50) | 22 of 22 on the corpus        |
| One call, strong tier             | 5 to 12 s (Sonnet)            | the second call only          |
| Aski's chat calling tools (today) | one turn per Cell             | the persona can't set a model |

- **The compiler runs on the fast tier at its lowest effort**, on the
  driver Aski's own chat runs on. The checks catch its misses and turn
  them into a Check, so a miss costs a tap, not a run. When the checks
  fail, one retry goes to the strong tier.
- **The floor is the model's reasoning before it writes.** Through the
  provider's CLI it could not be switched off (three ways tried), and a
  process start is a quarter of a second of it. So the answer is one
  call's wait, and the plan says "Aski is reading…" under Aski from the
  moment the message goes.
- **The answer is not streamed**: its rows would arrive within about
  half a second of each other. Code paces the rows a stagger apart.
- The message itself never waits for the plan, only for the server to
  hear one is coming (1.5 s at most).

### 12. The spawn in Aski's chat

One timeline on the Mac and the phone, built from what exists
(`interaction.md`, The spawn; `cell/forming.ts`).

1. **Send.** The message goes to Aski's chat, and the plan's card stands
   on the composer under Aski: "Aski is reading…".
2. **Each Cell arrives.** Aski pulses and throws a copy of itself to the
   top of the Awake list. There the Cell forms through `. : + # @` into
   its creature, and its line settles out of the same glyphs, left to
   right: the project's mark, the Cell's name, model and effort, then the
   title. Rows below glide down.
3. **A Check forms as an outline**: dim, with the unsure field marked,
   and stays that way until tapped; a click on it brings Aski's chat
   forward. A Cell with no project yet waits in the plan only. A Hold
   forms no row. It is a row of the plan's card.
4. **The plan's card** has a row per act: the Cell's name, project,
   model, effort and title; a waiting row says why, shows the words the
   Cell will be told, and lets the person pick the project and the model.
   It leaves once every Cell flies and can no longer be called back;
   Aski's reply is the line that stays, each Cell a link. A plan Aski's
   chat proposed stands in the reply itself, where its `plan` fence is.

Every motion is one-shot and moves only `transform` and `opacity`. Under
Reduce Motion the rows appear at once.

### 13. Aski learns the person's voice

When the person confirms a name heard near ("harbour" is Harbor, "table"
is Fable), Aski keeps it as an alias, on this machine. Next time it is
exact, and the Cell starts with no tap. An alias for a model counts only
where a model is named, so "table" stays a table elsewhere. Settings
lists them and removes them.

### 14. Evals decide

- A public corpus of invented messy messages with their right plans,
  dictation errors included (`stemcells/evals/compiler/corpus.json`), and
  its runner (`stemcells/scripts/aski-eval.ts`), which puts each message
  through the real pieces, prompt, checks and tiers with a real model. It
  spends the person's plan, so it runs by hand.
- Scores per model: the count of Cells, each field, the time, and how
  many needed the second call.
- **Two numbers gate a change**: no Cell in the Start tier that is wrong
  in place or words, and every `destroy` held. Both must be zero misses
  on the corpus. Everything else is tuned toward fewer Checks.
- The code checks, the tiers and the cutting into pieces are tested in
  CI with no model.
- The compiler's instructions are text a model reads: `evals/README.md`
  applies.

## What changes in what's built

- **The reader** (`words/`) and its planner stay the new chat's
  composer: ink, the flight, Cells from the words of a draft. The
  compiler is Aski's chat's. Both read Settings › Aski › Aski divides
  the work.
- **`prompting.md`**: decision 13 and slice 7 (Aski's chat starting
  Cells) are replaced by this file. Decision 15's tabs don't apply to
  Cells Aski starts. Decision 17's risk floor is shared now
  (`stemcells/risk/floor.ts`) and widened (decision 7 here).
- **`aski-manager.md`**: "Cells receive only the person's words" is code
  for a plan, not a rule in the persona.
- **The persona** loses its launch instructions and gains
  `stemcells_plan`, `stemcells_propose` and `stemcells_recall`.

## Slices

Each lands on the Mac and the phone together where a person sees it.

1. [x] **The floor and the corpus.** The corpus and its runner; the
       fast call measured on Claude (reasoning can't be switched off
       through the CLI). Codex's timing hung and is unmeasured.
2. [x] **The compiler on the server.** Pieces, the call, the checks, the
       tiers, the plan book, the history. Tested with a fake model.
3. [x] **Aski's chat uses it.** The gate, the plan's card, Start and
       Check, Call back, Cells without tabs. Aski's chat can't launch.
4. [x] **Hold.** `destroy`, the press-and-hold confirm, the server's
       refusals for Aski's instance, risky sentences as Checks.
5. [x] **The spawn in the Awake list.**
6. [x] **New projects and heard names.** A new project as a Check, near
       names as Checks, names learned from confirms.
7. [x] **Recall.** Cards, the search, the pills under a question,
       `stemcells_recall`.
       Built: a card per Cell in `stemcells/recall.sqlite` (FTS5), written when a run starts
       or lands and checked against every chat at each start; `GET /api/stemcells/recall` and
       `stemcells_recall` (a Cell reads its own repository's); the pills under a question in
       Aski's chat on the Mac and the phone; search took 0.2 to 6 ms over 5,000 cards.
       Left: time words are English only; the phone's pills stand on the reply's side of the
       feed; the persona's new lines and the tool's description have no eval (upstream's
       runner offers neither the persona nor our tools), and no client was run to look at them.
8. [x] **Cells read their own repository.** The read scope.
   - [ ] **Aski's own text as a Check.**
9. [x] **Settings › Aski's rows.**
   - [ ] **A named setting's card at once**, with no model call.

Slices 2 to 4 are the core and ship in that order. 5 makes it a joy. 7
and 8 stand alone.

## Review

- Slices 1 to 6 and 9, the compiler and its plan. On the corpus, the
  fast tier at low effort read 22 of 22 messages clean (184 of 184
  fields, no second call, no wrong start, no deletion unheld); one
  sample, on a corpus written beside the rules, so it measures the rules
  more than the world. A pass in the real app, on a lab home with fake
  providers, sent a three-Cell message and a deletion: two Cells formed
  in Awake and flew, the third waited for its project; Enter and a click
  left the deletion alone, a held press removed the project from the app
  and left its folder, and the Cell after it then started on Enter.
- That pass found what tests had not: a Cell with no project yet crashed
  the Awake list (it waits in the plan only now); "No project" was
  offered to the compiler as a project; and the compiler asked for a
  provider that is ready, where Aski needs one only installed and on.
- Where the build left the first design: the answer isn't streamed, the
  client supplies the person's world and carries the plan out, the
  compiler's acts are start and destroy only (the rest is the chat's),
  and the reader keeps the new chat's composer. Decisions say it as
  built.
- Slice 8, the read scope: one gate where upstream builds every toolkit's
  handlers (`seams/server.md`, `McpToolAccess.ts`) asks one pure rule
  (`apps/server/src/stemcells/readScope/rule.ts`). A Cell reaches its
  repository's chats, its family, a chat it launched and one the person
  attached (read only); `allProjects` is its repository; Aski's chat and a
  client outside the app reach every chat. `stemcells_standing` answers
  the same way.
- Left open by it: a call to a linked environment is answered there, where
  the caller is a client with no project; a launch into another project
  still starts, and its launcher reads it; issue, pull request and worktree
  tools take a thread id and aren't asked, since they read no chat.

## Open

- The wait: a provider's SDK session with reasoning off, and Codex's
  fast models, are unmeasured. Until then one call is 3 to 5 s.
- A message that is one Cell with an exact place could start with no
  call at all (the instant path), as the new chat's reader does.
- Changing a waiting plan by words ("the second one goes in Atlas").
- The Mac's composer can't tell that its own speech wrote a message:
  upstream's speech hook has no seam its own tests leave room for. The
  rules don't depend on it (decision 7).
- A message's attachments stay with Aski's chat: a plan's Cells get
  words only.
- A plan that still waits is forgotten by a reload of its window: nothing
  starts, and the person says it again.
- Aski's own shell and file tools are still its provider's; the persona
  forbids them, and the server refuses only what starts or destroys.
- Aski's own text as a Check (slice 8).
- A private corpus of real messages, and a harvest of corrected plans.
- The cap of twelve is a guess until someone hits it.
