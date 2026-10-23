# Aski runs the floor: the manager's room

The person talks to one manager, Aski, and the Cells do the work. Before,
the person worked with each agent directly, terminal by terminal. Now they
start work by telling Aski what they want, answer what's on the right, and
settle what's done. The more they stay with Aski, the less they have to
hold in their head. A Cell's own tab is still there for the curious, and it
says the same things the room says.

This page settles the open questions about Aski's tab and the Cells'
lifecycle, from first principles. It builds on `aski-room.md` (the needs
list, cards, holds, answers by words) and `prompting.md` (words, readout,
planner, spawn), and changes them where noted.

## What the person does all day

1. Start work: one sentence, one or many Cells.
2. Go do something else.
3. Come back to Aski's tab: what needs me, what's done.
4. Unblock (answer), settle (done), or look closer (the Cell's chat).

Everything on Aski's tab serves 1, 3 and 4. Anything else is noise there.

## Decisions

### 1. Aski's tab is one fixed room

- Three parts: Aski's chat, the roster under it, and the decision column on
  the right.
- **The column is always there** on a wide pane, with its head ("Nothing
  needs you" when empty). It no longer slides in and out: a room whose
  furniture moves isn't a room. Narrow, it stays the count and the sheet,
  as there is no room beside the chat.
- **No surfaces, no terminal, no splits.** Aski has no project and runs no
  code, so a browser, a diff, files or a shell under Aski has nothing to
  show. The pane shows none of upstream's panel toggles, and their
  shortcuts do nothing there.

### 2. Aski has no project

- Aski's chat is a chat without a project (upstream's own: its folder is a
  private scratch folder of its own, not a repository). It reaches every
  project through its tools, so asked what it can do, it doesn't answer
  from inside one project.
- What it can touch: upstream's orchestration tools (list, search, read,
  launch, send, organize), across every project on this server. It never
  edits files or runs commands (the persona).
- Existing installs: the first Aski chat made without a project becomes
  Aski's; the old chat in a project stops being Aski's and is settled, its
  history kept and findable. Where upstream can't make a chat without a
  project (its data folder inside a repository, as in a dev worktree),
  Aski falls back to the most recent project, as before.

### 3. One Aski chat, not tabs of them

- Bleeding is the worry: talk about one project leaking into another. It
  can't reach the work, by construction:
  - a Cell starts with a clean context in its own project's folder;
  - what reaches it is the person's own words, copied exactly
    (`persona.md`), and the readout names where it goes before Send.
- What could still go wrong is Aski's judgement: "it" read as the wrong
  Cell, a project guessed from earlier talk. Guards: the readout, the
  persona's "ask when two fit", and Aski reading the live list through its
  tools every turn rather than from memory. Upstream's auto-compact keeps
  the chat bounded, and nothing that matters lives only in Aski's history.
- Sub-tabs would ask "which Aski?" on every visit. New work already gets a
  space of its own: every Cell is its own chat.

### 4. A new tab is Aski, waiting to divide

- ⌘T opens a new chat with Aski standing in it, where upstream would say
  "Send a message": what you write there, Aski carries into Cells. From
  Aski's tab it opens in the first project, not in Aski's no-project.
- On Send, Aski becomes the work: one Cell, and Aski condenses into it on
  the chat's line; several, and Aski divides, each part flying to where its
  Cell will stand (decision 5).

### 5. The spawn is one motion: Aski divides

- Stem cells divide, and so does Aski. One sequence, from any room:
  1. The words pour into Aski.
  2. While the planner thinks, they orbit (only then: an orbit means Aski
     is working out who does what).
  3. Aski divides into one small Aski per Cell. Each flies to where its
     Cell will stand: the Cell's line in its pane when that pane is on
     screen, else the Cell's chip on its tab.
  4. Each one condenses into its Cell (`. : + # @`, then the blocks, then
     the hop), as `cell/forming.ts` already plays.
- In Aski's tab, Aski stays and its copies leave. In a new tab, with one
  Cell, Aski is the copy: it condenses on the line and becomes the Cell.
- Reduce Motion plays none of it.

### 6. Cells land in their project's tab

- A tab belongs to the project of its first pane.
- Each new Cell goes to the most recently used tab of its project, in any
  window (a detached window holding that project's tab gets it), as a new
  column while the tab has room (`prompting.md` decision 15: 300 px
  columns, 4 panes). When the project's tabs are full, a new one opens
  after them. A project with no tab gets a new tab at the end of the strip
  Aski's tab heads, so Cells keep the order they started in.
- Cells an agent launches through the tools land as their chats arrive,
  placed once, by the lead window.
- From a new tab's chat, the first Cell takes that chat, wherever its
  project's tab is: the person is looking at it.
- Aski's tab never takes a Cell. You stay where you are; the spawn shows
  where they went.

### 7. Three stages, from facts first

Every Cell is at one stage, the same in the roster, on its tab and in its
chat:

| Stage     | Colour | When                                                                                                                    |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Working   | yellow | a run is under way, or it said it waits on its own work (`Left: waiting`)                                               |
| Needs you | red    | anything in the needs list: a permission, a question, a plan, a limit, a failure, a stall, an ask in prose, `Left: you` |
| Done      | green  | its turn ended, nothing is asked, and it isn't settled                                                                  |

A settled Cell has no stage: it leaves the roster and the slate.

What decides, in order (the Swift app's lesson: facts first, then the
agent's own words, then a model):

1. **Facts** from upstream's shell: a run, a pending request, a failure, a
   limit, the stall clock.
2. **The Cell's own close-out.** Every Cell is told (one section in the
   instructions upstream gives every chat) to end each final reply with one
   line: `Done: <what it delivered>`, or `Left: you — <what it needs>`, or
   `Left: waiting — <on what>`; and to ask a choice through its question
   tool, not in prose. Code reads the line. The agent knows whether it is
   done better than anything reading it afterwards, and the line costs
   nothing.
3. **The pre-read** (`needs/preread.ts`), free code, when the line is
   missing: a question or an offer is "needs you", else done.
4. **Aski's read** (`aski-room.md` slice 4), a model, only for an ask in
   prose: it writes the card, it doesn't decide the stage.

**Done is the costly mistake** (a person settles a Cell that still asked
something), so every tie goes to "needs you": a `Left: you` wins over
anything, and a question in the last paragraph wins over a `Done:` line.
No model reads every turn: with the close-out and the facts, almost every
stop is decided for free.

### 8. A card is the Cell's own question, asked well

The person must decide in seconds. The best distiller is the Cell, at the
moment it asks: it has the whole context. So the close-out also says how
to ask:

- through the question tool: one question saying what waits on it, at most
  two lines of context for someone who hasn't read the chat, two to four
  options saying what each causes, the recommendation first;
- single or several choices, as the decision is (`multiSelect`);
- an option's preview for what words can't show quickly: a few lines of
  ASCII, a table, a diff.

The card shows exactly that, as upstream's question (header, question,
options, previews, Other…). The answer goes back as data: no model and no
words written for the person.

An ask in prose that slips through gets the fallback card (the Cell's last
paragraph and the fixed options) until Aski's read writes a brief. Aski
never writes what a Cell reads (`aski-room.md` decision 5): an option sends
the Cell's own words back, which it understands exactly; when no option
fits, Reply… sends the person's.

### 9. Open chat is a peek, not a trip

- "Open chat" on a card, or a click on a roster row, slides the Cell's chat
  in from the right over Aski's room, its composer focused.
- Send closes the peek once the message is on its way: the Cell is moving
  again, and the person is back with Aski. Esc or a click outside closes
  it too. "Open in its tab" takes it to its tab (decision 6).
- A Cell link in Aski's chat opens the same peek.

### 10. Done, and settling, look the same everywhere

- **The roster** (under Aski's chat): one row per Cell, newest first: its
  dot, its name, its one-liner (the chat's title), its project. A click
  peeks.
- **The column**: what needs you (numbered cards), then "Done": one line
  per done Cell with its `Done:` line and Settle. "Settle all" when two or
  more are done.
- **The Cell's own tab**: the line the Cell stands on above its composer
  turns green when it is done, with Settle at its end.
- **Settle** puts the Cell away: upstream's settle, and its pane closes
  wherever it is open (the tab too, when it was the last pane). Undo, for
  the usual few seconds, brings back both. Upstream's auto-settle (a merged
  pull request, a quiet day) closes nothing: a chat never leaves under its
  reader unless the person settled it. Asked, Aski brings a settled
  Cell back, into its project's tab.
- Writing to a done Cell makes it working again: the green goes.

### 11. What Aski says it is

Asked how this works: "You talk to me; I run the Cells. Each Cell is one
chat doing one job, like a person on your team, and I'm their manager.
Tell me what you want, answer what shows on the right, and settle what's
done."

### 12. Finding past work

- Sure which chat the person means: Aski links it, and the link opens the
  peek.
- Not sure: up to three, linked, one line each, and "Which one?". A click is
  the answer.
- "Summarise it": Aski reads it (`t3_thread_read`) and answers in two or
  three sentences. "Carry on with it": unsettle, then send.

## Slices

Each is one pull request.

- [x] 1. The room's shape: the column always on, no surfaces or terminal
      in Aski's tab, this page.
- [x] 2. The close-out: the section every Cell gets, and the server reading
      each Cell's stage from facts, the line and the pre-read.
- [x] 3. The roster under Aski's chat, and "Done" with Settle in the column.
- [x] 4. Settling puts a Cell away: its pane closes; the green line and
      Settle in the Cell's own tab.
- [x] 5. Aski has no project.
- [x] 6. The peek.
- [x] 7. Cells land in their project's tab.
- [x] 8. Aski divides: the spawn, and Aski standing in a new tab.
- [x] 9. Aski's words: the manager, finding past work, links that peek.

## Review

All nine slices landed: #243 (the room), #245 (the close-out), #246 (the
roster and Done), #248 (settling), #249 (no project), #250 (the peek),
#251 (Aski's words), #252 (landing), #253 and the standing Aski (the
spawn).

- **Seen running.** A pass through the hidden lab app, on fake CLIs
  (2026-10-23), played every piece: the room, the roster's stages, the
  column's cards, the peek, Aski dividing into its tab chips, landing by
  project, the green ledge and Settle. It found four problems.
  - #257: from a new tab, Aski's flight was black and half a second late.
  - #258: a new tab without a project had no Aski, and a new chat from
    Aski's tab (on a fresh install, from anywhere) started in no project.
  - #259: the welcome listed Aski in Claude's place.
- **Colour.** The roster's stages are yellow, red and green as asked; the
  app's "needs you" elsewhere is amber. One of them should give.
- **Edges left.** A Cell that lands in another window gets no copy from
  this one. Every chat an agent launches through the tools lands and gets
  a copy, not only Aski's. A project's tab with room in the front window
  wins over one used more lately in a window behind it.
- **Review.** An independent review after #254 found six problems, fixed
  in #255. Extra Cells landed before their chats were known, so they
  missed their project's tab. A landing on the desktop dropped an unsent
  new Cell's tab. Esc meant for a menu in a peeked chat closed the peek. A
  failed send hid the standing Aski. A stacked column counted as room. A
  copy could land where its timing didn't plan. Also, after a reload,
  chats launched in the last two minutes landed again.
- **Next.** Aski distilling a Cell's prose ask into a card (decision 8's
  model step) is the one piece of the design not built.
