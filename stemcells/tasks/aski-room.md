# Aski's page: talk on the left, what needs you on the right

Aski's tab becomes a page with two parts. On the left is the chat with Aski:
start Cells, ask how things stand, ask about settings, find past Cells and
bring them back, and answer by dictation. On the right is a live list of
what needs the person. Each item is a card the person can decide from
without opening the Cell: a brief of two lines at most and two to four
options, the recommended one first. Settings gains a page of its own for
Aski.

This is the design. Nothing is built yet; the prototype is a page outside
the repo. The PR slices are at the end.

Kick-off from Aski's chat (the composer reading places, models and counts,
the readout before Send, the fan-out) is designed in `tasks/prompting.md`.
This page builds on it and doesn't redo it.

## What the waiting is made of

The Swift app measured 14 days of one person's work: 2,941 waits on the
person across 389 chats.

| The Cell stopped with | Share of waits | How it ended |
|---|---|---|
| a report, no question | 79 % | 70 % got a new task |
| a question or offer in prose | 15 % | 54 % redirected |
| a usage limit or an error | 4 % | 15 % a bare "go on" |
| a structured question | 3 % | 59 % took the recommended option |
| a permission | 0.2 % | 75 % allowed |

- Three to seven Cells wait at once (median 3, p90 7). Finding them was the
  work.
- 12 % of report stops ended mid-task ("next I'll…", "3 of 8 done").

What this means for the page:

- The structured asks are the easy, small part.
- Most of what blocks is prose: a question, an offer, a stop short of done,
  a run gone quiet. Those need reading before they can become a card.
- A finished report is not a need. It stays where T3 already shows it (the
  "Completed" status, unread).

## Decisions

### 1. One list, derived on the server, the same on every screen
- The server derives the list from T3's own thread state each time a
  thread's shell changes. It reads the shell for presence and the thread's
  projection for the details: the command, the question, the plan.
- It streams the whole list, which is small, at `/api/stemcells/needs`.
  The desktop, the web client and later the phone render that one stream.
- There is no parallel store of thread state. Next to the derived list the
  server keeps only:
  - the numbers it handed out (in memory);
  - Aski's briefs, cached by item key;
  - a few counters for Settings.
- Actions don't go through the server. The client sends T3's own commands
  (decision 7).

Why the server:
- The numbers must agree on every screen, so "for 2" means the same item on
  the Mac and on the phone.
- Aski's read of a stuck Cell (decision 4) must run once, not once per open
  window.
- The server already holds the projection that the details live in.

### 2. One card per Cell, for what only the person can unblock
- A Cell has at most one card. When it shows several signals, the most
  blocking one makes the card. When that resolves, the next signal becomes
  a new card.
- A subagent's thread gets its own card, under its parent's name
  ("Floof › reviewer").
- These never get a card:
  - Aski's own chat and its subagents: their asks show inline in it. Aski's
    chat is the one the web picks (the top-level chat on Aski's instance,
    the pinned one first, else the first made); another chat on Aski's
    instance is a Cell like any;
  - a snoozed, archived or deleted Cell;
  - a settled Cell, for prose kinds only;
  - a Cell that is working, connecting or waiting on its own background
    work;
  - a finished report.
- The kinds and their signals are in "Item types" below.

### 3. Numbers are addresses: given by arrival, never moved or reused
- A card keeps its number for as long as it lives.
- New cards take the next number and join at the bottom. The list never
  re-sorts.
- Numbers start again at 1 only when the list empties.
- Urgency shows as ink: an amber edge on a request that blocks a running
  turn. It never shows as position.

Why: the person reads the numbers, then speaks. A dictation app may type
the whole sentence at once when they stop talking, so the page can't know
when they started. If an item left in that time and the rest renumbered,
"for 2" would land on the wrong Cell. The Swift app tried a "most urgent
first" order and dropped it for this reason. Each part of the routing
preview names its Cell ("2 → Bongo"), so a stale number shows before Enter.

### 4. How a brief is made depends on the signal
- **As the Cell asked, with no model:**
  - A permission shows the request whole: the command in monospace, with
    every line kept. It is never summarised, because the person approves
    exactly what they read.
  - A structured question shows the Cell's own question and options, in
    the Cell's order. That way option 2 here is option 2 in the Cell's own
    panel. A "(Recommended)" in a label becomes the tag.
  - A plan, a limit, a known failure and a sign-in use fixed words filled
    from the shell.
- **Read by Aski (the triage call):**
  - a question or offer in prose;
  - a Cell that stopped short;
  - a quiet (stuck) run;
  - a failure whose message T3 can't classify.

  For these, Aski's model reads a bounded context and returns a typed brief
  and two to four options, which code then validates (see "Aski's read").
- **When the read is off, down, slow or over budget:**
  - the card shows the Cell's last paragraph word for word;
  - it offers the kind's fixed options: Go ahead (for an offer or a stop
    short; a plain question can't take it), Reply…, Nothing to do, Later
    and Open chat;
  - one dim line says "Aski couldn't read this one". Nothing waits on the
    model. Until the read exists (slice 4) the line stays away: nothing
    failed to read.

Why: a structured ask is already as clear as it gets, so a model would only
add cost and room for error. Prose is where the person loses time.

### 5. Options are app actions; Aski never writes what a Cell reads
- Every option maps to exactly one action in the catalogue (below). It goes
  through T3's own commands, so it works whatever the provider supports.
- What an option sends to a Cell is one of three things:
  - a verbatim span of the Cell's own message ("staging or a fresh local
    copy?" gives "a fresh local copy");
  - a fixed phrase from the catalogue ("Go ahead.");
  - the person's own words.

  Code checks every span. Aski may write the option's title and its
  consequence line, but never the words that reach the Cell.
- **An option that is one of upstream's own buttons wears upstream's
  label:** the provider's own, else Approve, Always allow this session,
  Decline; Implement and Refine for a plan; Retry for a failed run. The
  same choice reads the same on the card and in the chat. The headline
  stays in Aski's voice, and the order stays recommended first.
- **Recommended:**
  - Triaged options put the recommended one first.
  - A structured question keeps the Cell's order and tags the Cell's pick.
  - Permissions and limits carry no recommendation: that call is the
    person's.
  - Nothing that RiskFloor flags is ever recommended.
- **Every card has two ways out:** "Reply…" (when the Cell can take words)
  and "Open chat". A card also has "Later", which snoozes the Cell through
  T3's snooze for an hour.

Why: the same rule as the Swift app's decision memo. The model sorts and
summarises, but what reaches a Cell is always words the person saw. It also
blunts prompt injection: a Cell's message can at most mislead a brief. It
can't make Aski send or allow anything.

### 6. Words can say no; only a click says yes
- Words in Aski's composer, typed or dictated, can:
  - answer;
  - reply;
  - deny;
  - go ahead or retry;
  - wait, snooze or settle.
- Words can never:
  - allow a permission, once or for longer;
  - send an option or sentence that RiskFloor flags;
  - widen a Cell's access.
- For those, the preview highlights the button on the card ("needs your
  click"), and one click finishes it.
- ↩ never allows, anywhere on the page.

Why: we can't tell typed words from dictated or pasted ones once they're in
the field. A rule that holds for all three is simpler than trusting any one
of them. Denying fails safe; allowing doesn't. The orchestration MCP tools
draw the same line (`t3_pending_request_respond` answers questions and can't
approve), and RiskFloor is the one floor shared with `tasks/prompting.md`
(decision 15 there).

### 7. Every answer waits out the undo window, then goes as T3's own command
- **A click or a confirmed dictation** puts the card into its hold:
  - the options fold to the one chosen;
  - a flat fuse runs under it, with Undo (and ⌘Z for the newest hold).
- **When the fuse ends**, the client re-reads the item from the live shell
  and checks its key: thread, kind, and the request, message, run or plan
  id. If the key still matches, it sends T3's own command. If not, nothing
  is sent and the card says why (see "Failure modes").
- **Holds live in a store outside the page,** so switching tabs doesn't drop
  them. When the window closes, a hold is sent at once if the socket is up.
  Otherwise nothing was sent and the card is still there next time.
- **The window** is 3 s by default (the `answerUndo` timing token), with
  Off, 3 s and 10 s in Settings › Aski. A permission holds too: undoing a
  mis-clicked Allow is the most valuable undo there is, and a blocked Cell
  barely notices 3 s.
- **State actions** (Later, carry on at the reset) hold the same way, so
  Undo never has to send a reverse.

Why the client sends: the approval keeps going through T3's own
authenticated path, with T3's checks (a resolved request can't be answered
twice). Nothing new can approve.

### 8. Dictation: a reader first, a preview in the cards, Enter confirms
- **Aski's composer reads item references as the person types.** The
  reader is deterministic, and the grammar is below.
- **Each part shows in two places at once:**
  - in the cards: the chosen option gets a ring and "from your words", and
    a reply shows as a pending bubble in its card;
  - in the readout line, which stands in the model picker's place in the
    composer's controls row, as a new chat's readout does; cut short, a
    click opens it whole:

    > **1 Floof** Remove it first · **2 Bongo** stop, then reply "use staging"
- **One readout line for everything Enter will do.** It is a single line
  of tokens, in this order:
  1. answers, because unblocking matters most;
  2. launches (`tasks/prompting.md`'s readout parts: "Aski starts 2
     Cells: …");
  3. "rest → Aski" for words that go to Aski's chat.

  Enter does all of it at once. This design owns the line's component;
  `tasks/prompting.md`'s reader feeds its launch tokens into it. Whichever
  slice lands first builds the component in this shape.

- **Enter:**
  - sends every resolved part, each into its hold;
  - leaves "needs your click" parts highlighted on their cards;
  - keeps unresolved words in the composer, marked.
- **Words that aren't answers** ("…and what's Goose doing?") go to Aski as
  an ordinary message. A launch ("Harbor fix the header") is
  `tasks/prompting.md`'s.
- **A model is used in one place only:** free text aimed at a Cell's own
  structured question ("the safer one", where the Cell offered options).
  Everything else the reader can't resolve stays in the composer, marked.

  It is one structured call after 600 ms of idle, through the structured
  one-shot operation `tasks/prompting.md` builds (its slice 5). It returns
  an option index, or a span of the person's own words to send as the
  custom answer. Its parts show "Aski read this" in Aski's tone. It never
  returns a permission, never returns a risky option, and never returns
  words the person didn't type.
- **The reader doesn't send dictation to Aski's chat turn.** Answering four
  cards costs no model turn and lands in under a second.

Why: the cards are where the person is already looking. Lighting them up
as they speak is the confirmation; the readout line is the summary.

### 9. The page holds still while you work
These freeze the right column:
- the composer has text;
- the pointer is over the list;
- a card has keyboard focus.

While it is frozen:
- **No card leaves.** A card resolved elsewhere greys in place, with its
  options disabled and a reason ("Answered in Floof's chat").
- **No card's options change.** A brief that lands while frozen waits.
- **New cards may still join at the bottom.** They never move the others.

When it unfreezes, everything queued plays as one motion.

### 10. Layout: Aski in its chat, the column beside it
- **Aski is in its chat, not over it** (the person, 2026-10-21: "they should be
  combined"). There is no band of Aski's own. It stands over the composer,
  where a Cell's line stands in a Cell's pane, in the composer's flow, so
  the transcript keeps its foot clear of it:
  - In a chat not yet started, Aski floats whole in the middle of the empty
    transcript, where upstream would say "Send a message": you speak to it.
  - Once the chat has started, Aski perches on the composer's edge at half
    its size, centred. It leans in while it answers, and stands whole while
    a moment plays.
  - The first message glides it from the middle to its perch. A pose is
    only a transform, so its eyes and moments never restart.
- **The pane's buttons keep their band.** Nothing lies under them: the
  transcript starts under the band, as in any pane; the column's head
  shares the band's row, with its cards below it; the narrow count sits at
  the band's left end; the sheet hangs from the band's foot.
- **Wide (Aski's pane ≥ 880 px):**
  - The chat keeps its reading width.
  - The column (380 px; 420 px past 1,400 px) always stands on the right
    (`aski-manager.md`, decision 1), its head saying "Nothing needs you"
    when it's empty.
  - After the last card, one line: "All clear · 4 answered in 1 min 12 s".
    That is a true fact and the page's one beat of reward.
- **Narrow:**
  - The list becomes a count in the pane's band: "4 need you", the one
    accent in view.
  - Tapping the count opens the list as a sheet over the chat. The sheet
    stops above Aski on its perch, so the person can dictate while reading
    the numbers, to Aski in sight.
- **Two screens (Duo, a foldable held as a book):**
  - Under `@media (horizontal-viewport-segments: 2)`, the page lays out on
    the segments. The chat is `env(viewport-segment-width 0 0)` wide, the
    hinge gap is skipped, and the list fills segment 1.
  - The list's screen stays on even when empty. It then shows Aski at rest
    and one line: "Nothing needs you · 3 at work". Text never spans the
    hinge.
  - With two vertical segments (a foldable held like a laptop), the list
    takes the top and the chat and composer take the bottom, near the hands.
  - The sidebar folds away while the window spans two segments, so the
    page's columns line up with the screens.
- **Aski's tab chip carries the count** on every tab, so the list is one
  glance and one click away from anywhere. The list lives only on Aski's
  page.

### 11. What Aski's chat does besides answers
- **Start Cells.** As in `tasks/prompting.md`: the words set where, which
  model and how many, the readout shows it before Send, and Aski launches.
- **"What's up?"**
  - Aski gets one read-only tool, `stemcells_standing`: the list (numbers,
    kinds, briefs), the Cells at work, and the Cells finished unread with
    the first line of their last reply.
  - Aski answers from that one call in two to three sentences. It uses the
    card numbers and links every Cell.
  - It costs one tool call where today's persona needs a list per project.
- **Settings questions.** Aski answers in a line and links the row
  (`Settings › Aski › Undo window`). Changing a setting from the chat is a
  later slice: it would come as an action card the person clicks, never a
  silent write.
- **Past Cells.** Aski finds them with `t3_thread_search` and
  `t3_thread_list(settled)`. It brings one back with `t3_thread_organize`
  (unsettle or unsnooze) and links it, and one click opens it in a tab
  after Aski's. Archived Cells are out of the tools' reach, so Aski says so
  (open question below).

### 12. Settings › Aski is a page of its own
One page holds this design's rows and `tasks/prompting.md`'s fan-out rows.
This design owns the page. Its rows, in this order:
- **Aski's model.** The provider, model and effort of Aski's instance,
  through T3's own instance settings. Aski uses it to plan fan-outs, read
  stuck Cells and talk with the person.
- **Read stuck Cells for you.**
  - A switch, on by default.
  - Below it, what it does: "When a Cell asks in prose, stops short, goes
    quiet or fails oddly, Aski reads its last turn and writes the card. A
    Cell's own questions and permissions are never read."
  - Below that, what it cost this week: reads, tokens, and tokens per read.
  - When it's off, cards fall back to the Cell's own words.
- **Undo window:** Off, 3 s or 10 s.
- **At a usage limit:**
  - "Carry on at the reset" is on by default, through T3's `limitRecovery`.
  - With it on, a limit reaches the person only when the reset is more
    than 5 hours away, unknown, or the carry-on failed.
- **New Cells:**
  - model (the project's default, or one fixed model), effort, account per
    provider, and access;
  - each is bound to T3's own setting where one exists.
- **Starting several Cells** (owned by `tasks/prompting.md`): the most
  Cells from one message, and when to show the split before starting.
- **Telling you:**
  - On this device: T3's own `notificationMode`, shown here.
  - Also when a Cell finishes: off by default.
  - Nothing pings while Aski's page is in front.

Settings that Aski's page or Aski's reads depend on live server-side, in
our store, so every screen reads the same. Notification settings stay per
device, as T3 has them.

### 13. The Cell's own history stays true by T3's records, not by our lines
Everything that sends or answers shows in the Cell's chat exactly as if the
person had done it there:
- a reply is a user message;
- an approval or answer is T3's resolved request;
- a plan built is T3's implement message.

State actions show where T3 shows that state: the snooze in the sidebar,
the model in the picker, auto-resume in the limit banner. We write no extra
line into a Cell's transcript. Any line we wrote there would be text the
Cell's model reads next turn, and the history would no longer be only what
the person and the Cell said.

### 14. What this design shares with smart prompting
Settled with `tasks/prompting.md`:
- **The readout line in Aski's composer:** one component, owned here.
  Answers come first, then launches, then "rest → Aski" (decision 8).
- **A bare leading number** names a card only before ":", ",", "." or an
  answer word. "for N" and "#N" always name a card. "2 Sol in Harbor …"
  stays a count, and the composer's reader skips our anchors' spans.
- **A live Cell's name with an open card** ("Otter, …") answers the card
  when the rest parses as an answer. Otherwise it takes the message route.
- **The structured one-shot call** is `tasks/prompting.md`'s operation
  (its slice 5). Aski's read and the free-text mapping both use it.
- **RiskFloor** is one module, in `stemcells/risk/`, built by whichever
  design lands first.
- **Settings › Aski** is one page with both designs' rows, owned here.

## Item types

Signals are fields of T3's thread shell (`OrchestrationV2ThreadShell`)
unless noted. "Words can" is what dictation may do (decision 6). A dash in
the options means none is recommended.

| Kind (tag) | Signal | Brief | Options (recommended first) | Words can |
|---|---|---|---|---|
| Permission | `pendingRuntimeRequest.kind` ∈ command, file-read, file-change, permission | "Wants to run a command" / "edit 3 files" / "read outside the project"; the request whole (projection) | The provider's own `options` (`ProviderApprovalOption`: label, warning), in its order, else upstream's own: Approve, Always allow this session, Decline; "Decline…" takes a note | decline, decline with a note |
| Question | `pendingRuntimeRequest.kind = user_input` | The Cell's header and question verbatim; one block per question (1a, 1b) | The question's own options (label + description), "Other…" when `allowCustomAnswer` | pick, custom answer |
| Question | Turn completed; the last reply asks or offers (pre-read, then Aski's read) | Aski's title (≤ 8 words) and context (≤ 25), the Cell's ask quoted on expand | 2–4 read options (reply span or "Go ahead."), Reply…, Nothing to do | everything |
| Stopped | Turn completed mid-task ("next I'll…", "3 of 8 done") | Aski's: what's done, what's left | Go ahead (rec), Reply…, Nothing to do | everything |
| Plan | `hasActionableProposedPlan`, plan mode, latest run settled | "Plan ready: {title}", the first three steps verbatim | Implement (rec), Implement in a new Cell, Refine… | everything |
| Stuck | Running, and nothing heard from the Cell for 12 min, or 30 with a tool call in flight (server clock) | Aski's: what it's on ("`pnpm test:migrate`, no output for 14 min") | Read options from: Stop and reply…, Nudge…, Wait 15 min, Open chat | everything |
| Limit | `status = failed`, `lastErrorClass = usage_limit`, and (no auto-resume, or the reset > 5 h away or unknown, or resume failed) | "Out of its weekly limit · resets Mon 09:00" (`usageLimitResetAt`) | — Wait for the reset, Switch account…, Open chat | wait, open |
| Failed | `status = failed`, other `lastErrorClass`, unseen | By class in plain words; `unknown` is read by Aski | Retry (rec for transport and provider errors), Switch model…, Open chat, Dismiss | retry, dismiss |
| Sign-in | `pendingRuntimeRequest.kind = auth_refresh` | "Needs you to sign in to {provider} again" | Sign in (opens the provider's sign-in), Open chat | open |
| Input | `kind` ∈ mcp-elicitation, dynamic_tool_call | "{app} asks for input" | Open chat (the Cell's own form) | open |

- A prose question appears once Aski has read it, which is 20 s after the
  turn ends, if the person hasn't answered by then. With the read off, it
  appears at once from the pre-read.
- The pre-read is free code (`needs/preread.ts`). It reads the reply's
  last paragraph, with a list that ends the reply kept with the question
  that leads into it, and leaves out code and links. It catches:
  - a "?" ending a sentence;
  - an offer ("Want me to", "Should I", "Shall I", "Would you like me
    to"), which Go ahead answers unless it has an "or" in it;
  - an ask with no "?" ("Let me know…", "your call"), but not a report's
    closing courtesy ("Let me know if you have any questions");
  - a stop-short phrase ("Next, I'll…", "3 of 8 done", "still to do").

  Everything else is a report.
- The activity clock: the server notes when it last heard any event from
  each Cell. A run quiet for 12 min with the model itself at work is stuck;
  with a tool call in flight, or before that is read, 30 min (a build or a
  test says nothing until it ends; the Swift app measured both). A Cell
  waiting on its own background work or on another Cell is never stuck.
  Time the server didn't see (the Mac asleep, the server down) restarts
  every clock.
- One account switch, unranked, with no suggestion of which account. A
  limit card that pointed at accounts read as dodging a plan's limits.

## Action catalogue

Every action is reached through `stemcells/upstream/needs.ts`, which wraps
T3's own command builders. A contract test pins each one to its command.

| Action | T3 command | Undo | Words |
|---|---|---|---|
| answer(requestId, answers) | `runtime-request.respond` with `answers` | in hold | yes |
| allow(requestId, decision) | `runtime-request.respond`, `accept` / `acceptForSession` / `acceptAlways` from the provider's options | in hold | **never** |
| deny(requestId, note?) | `runtime-request.respond` with `decline`, then `message.dispatch` of the note | in hold | yes |
| dismissQuestion(requestId) | `thread.user-input.dismiss` | in hold | yes |
| reply(threadId, text) | `message.dispatch`, `start_immediately` (idle) or `queue_after_active` | in hold | yes |
| goAhead(threadId) | `message.dispatch` with "Go ahead." | in hold | yes |
| nudge(threadId, runId, text) | `message.dispatch`, `steer_active` | in hold | yes |
| stopAndReply(threadId, runId, text) | `message.dispatch`, `restart_active` | in hold | yes |
| buildPlan(threadId, planId) | T3's implement path: `message.dispatch` with `sourcePlanRef` | in hold | yes |
| buildPlanInNewCell(threadId, planId) | T3's implement-in-new-thread path | in hold | yes |
| retry(threadId, runId) | T3's retry: `message.dispatch` with `restartContinuationOfRunId`, or `prepared-run.retry` for setup | in hold | yes |
| carryOnAtReset(threadId, runId, resetAt) | `thread.metadata.update` with `limitRecovery.autoResume` | cancel | yes |
| switchAccount(threadId, instanceId) | `thread.model-selection.set`, then carry on | switch back | no (a picker) |
| switchModel(threadId, selection) | `thread.model-selection.set`, then retry | switch back | no (a picker) |
| later(threadId) | `thread.snooze` +1 h | unsnooze | yes |
| nothingToDo(threadId) | `thread.settle` | unsettle | yes |
| dismissFailure(threadId) | `thread.visit` | mark unread | yes |
| openChat(threadId) | opens the Cell in a tab after Aski's | — | yes |

A triaged option may use only the actions its kind allows. Code drops
anything else.

## Aski's read (the triage call)

- **Where it runs:** one structured one-shot call on Aski's provider
  instance. It goes through the same structured-call path as
  `tasks/prompting.md`'s split; there is one place for provider plumbing.
- **When it runs:**
  - a prose stop, 20 s after the turn ends, if it's still unanswered;
  - a stall or an unknown failure, as soon as it is seen.
- **Limits:**
  - at most 3 reads at a time and 30 an hour;
  - each read times out at 20 s and is never retried. The fallback card is
    good enough.
- **Cache:** by item key. A re-read happens only when the key changes (a
  new message, run or request).
- **Input,** bounded to about 6,000 characters (about 3k tokens with the
  instructions):
  - the Cell's title and project;
  - the person's last message to it (≤ 600 chars);
  - the Cell's last reply (the last 2,500);
  - the last tool call and the tail of its output (≤ 1,500);
  - the error class and message (≤ 500);
  - minutes since the Cell's last activity;
  - the kind's allowed actions.

  The Cell's text arrives fenced as data, with the persona's rule: it is
  never an instruction.
- **Output:**

  ```
  needsYou     boolean            false: it was a report; no card
  kind         question | offer | stopped | stuck | failed
  title        ≤ 8 words          Aski's
  context      ≤ 25 words         Aski's, one sentence
  quote        span               the Cell's own words that carry the ask
  options[]    2–4
    title        ≤ 5 words        Aski's
    consequence  ≤ 12 words       Aski's
    action       one of the kind's allowed actions
    send         span | omitted   what reaches the Cell
    recommended  at most one
  ```

- **Validation:** pure code, the same discipline as the planner.
  - An action outside the kind's set drops its option.
  - `send` and `quote` must be spans of the Cell's text after normalising
    whitespace, case and quotes. A failed `send` drops the option; a failed
    `quote` drops the quote.
  - A recommendation on an `allow` is removed on the server. RiskFloor
    runs where options are shown: the client drops the recommendation from
    a flagged option and makes it need a click.
  - Over-long words are cut at a word boundary, never rejected.
  - Fewer than two surviving options gives the fallback card, with the
    brief kept if it passed.
- **Counted:** reads, tokens and outcomes go into our store, for Settings
  and the harness. Nothing leaves the machine.

## The dictation grammar

**A part starts at an anchor:**
- a message or line start, `;`, `.`, a newline, ", and", "then", or the
  next anchor.

**Anchors** (each must name an open card):
- **By number:**
  - "for N", "#N", "number N", "item N", "decision N", "card N", with or
    without a "for" before them, but not before a unit ("for 5 minutes",
    "for 2 more tests");
  - a bare "N" only when ":", ",", "." or an answer word follows it ("1:
    go with 2", "3 yes"). Otherwise a number at the start is a count for the
    composer ("2 Sol in Harbor …", `tasks/prompting.md`). The composer's
    reader skips the spans of our anchors, as it already skips literal
    text;
  - "the first" … "the ninth";
  - number words up to twenty ("for one"). Dictation often writes "for" as
    "four" or "4", so "four N" at a part's start reads as "for N" when N is
    an open card. The preview names the Cell either way.
- **By Cell name:** "Floof:", "for Floof", "tell Floof (to)", "Floof," —
  only when that name is unique among open cards, and only when the rest
  of the part parses as an answer. Otherwise "Otter, rebase" is a message
  to that Cell through Aski (`tasks/prompting.md`). In Aski's composer it is
  inked in the Cell tone, as `tasks/prompting.md` inks a live Cell's name.
- **A list:** "1 and 3:", "1, 3 and 4:" gives the same answer to each.
  Never a permission.

**The answer within a part,** the first that fits:
1. **An option by number:** "go with N", "pick N", "option N", "take N",
   "choose N", "the second", or a bare "N" as the whole part. The first
   number after the anchor is the card; a number after these words is the
   option.
2. **An option by title:** the part's content words all appear in exactly
   one option's title, or the part starts with a title's first two words.
3. **Yes or no:**
   - On a permission, "yes", "allow", "approve" or "ok" means Approve, which
     needs a click. "no", "deny" or "decline" means Decline, and any words after it are
     the note.
   - On an offer, "yes", "go ahead" or "do it" means Go ahead.
4. **Fixed verbs:** "go ahead", "carry on", "continue", "retry", "try
   again", "wait", "later", "nothing", "skip", "dismiss", "open".
5. **Reply:** "reply", "say", "tell it" or "answer" followed by text, or
   quoted text. The text goes as typed.
6. **Free text:**
   - Free text that names one of our option numbers ("don't go with 2") is
     kept. A Cell never sees our numbers.
   - On a card that takes words (prose, stopped, stuck): a reply, exactly
     as said, fillers like "let's" included.
   - On a structured question: Aski's read maps it to an option, or keeps
     it as the custom answer.
   - Otherwise: unresolved.

**Always:**
- A negation before an option ("don't go with 2") never picks that option.
- A number with no open card ("for 5") is kept in the message.
- Anything after the answers that is not an anchored part goes to Aski as
  a message.

Examples. The four cards are the prototype's:
1. Floof, a question read from prose: Commit, then remove / Remove it
   first.
2. Bongo, stuck: Stop and reply… / Wait 15 min.
3. Pip, a permission: Approve / Always allow this session / Decline / Decline….
4. Otter, a limit: Wait for the reset / Switch account….

| Typed or dictated | Preview |
|---|---|
| for 1 go with 2, for 2 reply use staging | 1 Floof: Remove it first · 2 Bongo: stop, then reply "use staging" |
| for one go with two. for two reply use staging | the same |
| 1: commit then remove | 1 Floof: Commit, then remove |
| Floof, remove it first | 1 Floof: Remove it first |
| for decision 1, let's go with 2; for decision 2, let's do use staging | 1 Floof: Remove it first · 2 Bongo: stop, then reply "let's do use staging" |
| 3 yes | 3 Pip: Approve (needs your click) |
| 3 no, use a normal push | 3 Pip: Decline, with "use a normal push" |
| for 3 go with 2 | 3 Pip: Always allow this session (needs your click) |
| for 2 go with 1 | 2 Bongo: Stop and reply… (say what) |
| for 4 wait | 4 Otter: Wait for the reset |
| 1 and 2 later | 1 Floof: Later · 2 Bongo: Wait 15 min (its own way to wait) |
| for 2, go with 2 | 2 Bongo: Wait 15 min |
| for 1 the safer one | 1 Floof: reply "the safer one" (a prose card takes words as said) |
| the safer one, on a Cell's own structured question | Aski's read maps it: Commit, then remove (Aski read this) |
| for 1 don't go with 2 | 1 Floof: ? a Cell can't read option numbers (kept in your message) |
| for 5 go with 1 | no card 5 (kept in your message) |
| 1 go with 2 and what's Goose doing? | 1 Floof: Remove it first · rest to Aski |
| 2 Sol in Harbor fix the export | not an answer: a count, read by the composer (`tasks/prompting.md`) |
| Harbor fix the header | not an answer: a new Cell in Harbor (`tasks/prompting.md`) |

## Failure modes, and how each just works

| What happens | What the person sees |
|---|---|
| The Cell was answered elsewhere first (its own chat, another screen) | The card greys: "Answered in Floof's chat" or "on another screen". It leaves after 1.2 s, or when the page unfreezes |
| …while the person's answer was in its hold | When the fuse ends the key no longer matches, so nothing is sent: "Floof already had an answer; yours wasn't sent". Dictated words come back to the composer |
| An item resolves while it is being read | It stays in place, greyed, with its options disabled (decision 9), and leaves when the pointer leaves or the composer empties |
| The Cell asks again while the person types | Old key, new key: card 1 resolves ("Floof asked again") and the new ask joins as 5. The preview shows "1 is gone: Floof asked again as 5", and nothing is sent for 1 |
| Aski's model is down, slow, off or over budget | Fallback card with the Cell's own words and the kind's fixed options, plus a dim line "Aski couldn't read this one". Settings says why |
| The read was wrong (a report read as a question) | "Nothing to do" settles the Cell, with Undo. It is counted as a false positive for the harness |
| Two signals on one Cell | One card for the most blocking. The next becomes a new card when the first resolves. A subagent's request is its own card under the parent's name |
| Two Cells share a name | Name anchors read only when unique. Otherwise the preview says "Two Cells are called Floof: use the number" |
| Enter with unresolved parts | Resolved parts go into their holds. Unresolved words stay, marked, with a hint |
| The command fails to send | The card returns to open with "Couldn't send. Try again". The words are kept |
| Reconnect, or the stream restarts | The server resends the whole list. Cards whose key is gone resolve quietly: the list is the truth |
| The window closes in a hold | Sent at once if the socket is up. Otherwise nothing was sent and the card is still there next time |
| Many cards (more than 9) | Numbers keep counting. The column grows with the page; it has no cap and no inner scroll |

## Evaluation harness

- **Derivation.**
  - Fixtures are recorded thread shells and projections: one per kind,
    plus each exclusion (snoozed, settled, archived, Aski's own chat, a
    working Cell, a report) and each tie-break (two signals, a subagent).
  - Contract tests pin the shell fields we read to upstream's schema.
- **Reader.**
  - A table of at least 120 utterances against item sets, with the
    expected parts. It includes the examples above, dictation artefacts
    ("for one", "four 2"), negations, shared names, numbers inside replies
    ("for 2 run 3 tests"), and quotes and code.
  - Two properties are tested:
    - no part ever resolves to `allow`;
    - every sent text is a span of the input or a catalogue phrase.
- **Aski's read.**
  - A golden set of stops, hand-labelled: needs-you or not, the kind, and
    acceptable options. Public-safe synthetic cases live in the repo. A
    replay of the person's own threads is read locally and never committed.
  - `stemcells/scripts/needs-eval` runs the live calls on demand, and CI
    validates recorded outputs only.
  - Targets:

    | Measure | Target |
    |---|---|
    | needs-you precision | ≥ 0.9 |
    | needs-you recall | ≥ 0.85 |
    | options surviving validation | ≥ 90 % |
    | latency, p50 / p95 | ≤ 4 s / ≤ 10 s |
    | tokens per read | ≤ 4k |
- **Actions.**
  - Each action gives exactly its upstream command; contract tests use
    upstream's schemas.
  - The precondition check refuses a changed key.
  - A hold survives a tab switch.
- **Live counters** stay local in our store and are read weekly:
  - cards by kind;
  - time from arrival to resolution (p50);
  - answered here vs elsewhere;
  - the undo rate (goal under 3 %);
  - preview corrections;
  - "Nothing to do" on read cards (false positives);
  - reads and tokens.
- **Retire numbers.** If read cards' options are picked less than 30 % of
  the time (people reach for Reply or Open instead), or false positives
  pass 15 %, the read isn't earning its cost: it goes off by default.

## What T3 gives us to build on

- **The shell:** `pendingRuntimeRequest` (id, kind, `blocking`), `status`,
  `lastError`, `lastErrorClass`, `usageLimitResetAt`, `limitRecovery`,
  `hasActionableProposedPlan`, `interactionMode`, `latestVisibleMessage`,
  `snoozedUntil`, `settledAt`, `lastVisitedAt`, `lineage`. Upstream's
  sidebar already ranks them in `resolveThreadStatusPill`.
- **The details:** the projection's runtime requests and turn items.
  Approvals carry `ProviderApprovalOption` (decision, label, warning).
  Questions carry `UserInputQuestion` (header, question, options with label
  and description, `allowCustomAnswer`, `multiSelect`). These are what the
  composer's own panels render (`derivePendingThreadRequests`).
- **The commands:** `runtime-request.respond`, `thread.user-input.dismiss`,
  `message.dispatch` (with `steer_active`, `restart_active`,
  `sourcePlanRef` and the continuation ids), `thread.model-selection.set`,
  `thread.metadata.update` (`limitRecovery`), `thread.snooze`,
  `thread.settle`, `thread.visit`, `prepared-run.retry`.
- **Aski's tools:** `t3_thread_search`, `t3_thread_list`,
  `t3_thread_organize`, `t3_thread_read`, and `t3_pending_request_*`, which
  answer questions only.
- **One-shot calls:** `TextGeneration`, shared with `tasks/prompting.md`'s
  split.
- **Notifications:** T3's `notificationMode`, completion and input alerts,
  and the badge.

Seams, each listed in `seams.md` with its PR:
- the Settings route for Aski, the same five files Settings › Disk took
  (one line, if upstream takes the "register a settings page from a
  module" offer in `seams.md`);
- one line registering the `stemcells_standing` tool with the MCP server.
  If `drift` marks that file hot, it gets an extension point first
  (`stemcells/docs/fork.md`, rule 7);
- the structured one-shot operation, owned by `tasks/prompting.md`;
- `stemcells/layer.ts` adds the needs routes; it is already mounted, so
  that isn't a new seam.

## PR slices

1. **The list, derived.**
   - Server: `apps/server/src/stemcells/needs/`, deriving the structured
     kinds (permission, question, plan, limit, failed, sign-in, input).
   - Numbering, and `GET /api/stemcells/needs` as an event stream and as
     JSON.
   - The upstream adapter, with contract tests.
   - No UI.
2. **The column.**
   - Web: Aski's pane gains the column.
   - Cards for the structured kinds with the provider's own options.
   - Clicks become T3's commands through `upstream/needs.ts`.
   - Holds and Undo, and the precondition check.
   - Resolved and cleared states, and the count on Aski's tab.
   - Wide, narrow (count and sheet) and two-screen layouts.
3. **Stuck and prose, with no model.** The server's activity clock, the
   pre-read, and the fallback cards.
4. **Aski reads.** After `tasks/prompting.md`'s slice 5, whose structured
   one-shot operation it uses.
   - The read's prompt, validation, cache and budget.
   - Settings › Aski, first cut: Aski's model, the read switch with its
     cost, and the undo window. A model call the person didn't start ships
     with its switch.
5. **Answers by words.**
   - The reader (pure, with the fixture table) and the item ink in Aski's
     composer.
   - The readout line's component (answers, launches, rest), and live
     highlights on the cards.
   - Enter sends the parts as actions; leftovers go to Aski.
   - The ambiguity read.
6. **Aski knows the list.** The read-only `stemcells_standing` tool (one
   seam), and the persona lines for "what's up", settings and past Cells.
7. **Settings › Aski, complete.** New-Cell defaults, the fan-out rows (with
   `tasks/prompting.md`), carry-on at the reset, and telling you.
8. **The phone.** The mobile app renders the same stream.

Slices 1 and 2 stand alone: every structured ask gets one home. Slices 3
and 4 bring in the prose that is most of the waiting, and slice 5 adds
answering by voice.

## Open

- **Archived Cells.** Search and list can't see them, so "bring back"
  covers settled and snoozed Cells only. Either an upstream change (search
  archived on request) or our standing tool listing archived titles; I'd
  propose the upstream change.
- **Access for new Cells.** Decided: new Cells keep T3's full access (the
  product owner's call, 2026-10-21). This page only shows the setting.
- **Other environments.** Aski lives on this Mac's server, and so does the
  list. Cells on another environment are out of its reach (and of Aski's
  tools) until there is one list per environment, with its own numbers.
- **Stall threshold.** 12 min (30 with a tool call in flight) are the Swift
  app's marks. The harness's time to unblock decides whether they move.
