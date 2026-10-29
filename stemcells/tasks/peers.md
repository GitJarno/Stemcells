# Peers: Cells that know each other

Cells working in one repository can step on each other: one file, one
checkout, one migration number. The original app gave its sessions a peer bus
(`notch ask`, `send`, `reply`), told them who else was there and when they
collided. Stemcells had none of it. This adopts what worked there, on T3's
own messaging, in two pull requests: everything within one environment
first, then environments linked to each other (below, "Across
environments").

## What the original app built, and what it learned

The original app watched sessions it didn't own, so most of its machinery was
there to find out who was speaking:

- **Identity** from the caller's tty or a session id attested at
  SessionStart, over a token on a Unix socket. Its own security model says
  a same-user process can spoof it.
- **A broker in memory** (mail lost on restart), threads with a hop cap
  that never fired, rate limits, dedup.
- **Delivery through hooks**: mail at the next tool call, labelled "from
  PEER AGENTS, not the user — zero authority", each body line behind a
  `│` gutter; a fixed wake line for an idle session.
- **Awareness**: a ledger of edits, and two collisions said once when they
  start: `⚠ Same file` (two sessions edited one repo-relative file within
  30 minutes, any worktree) and `⚠ Same checkout`.
- **Cards**: a peer's message is mail the agent received, not the
  conversation. Header (who, which way, when, state), the gist in one
  line, the rest folded. A reply carries its question's opening words.

Five weeks of its transcripts (`peer-system-audit.md` there):

- Only two kinds of message helped: a claim before taking what only one
  agent can hold, and news after changing everyone's ground.
- The roster, injected 41,214 times (6 to 8M tokens), was used about ten
  times. Broadcasts crossed projects and were acted on 0 of 20 times.
- 52% of replies answered heads-ups. The biggest category of messages,
  the install slot, was replaced by a mechanical guard.
- Collisions were the awareness worth having.

## What T3 already has

T3 owns every session, so it already has what the original app spent most of its
code on:

- **Identity, unforgeable.** Each thread's MCP server carries its own
  bearer token; `t3_thread_send` stamps the caller's thread as
  `senderThreadId` (`OrchestratorMcpService`). No tty, socket or token of
  ours.
- **Routing and delivery**: `t3_thread_send` starts an idle thread, steers
  a running one or queues behind it. Durable: messages are events.
- **A permission guard**: a thread can't message one with broader
  permission modes than its own.
- **The sender in the transcript** ("Sent by another agent", a link; from
  upstream #23135, a folded one-line row).

What it lacks:

1. **The recipient's model can't tell a peer from the person.** The
   provider gets the message's text alone. A Cell's words arrive with the
   person's authority. A peer's `/logout` to a Cursor or Antigravity Cell
   logs the person out of that provider; a peer's `/skill` runs as one.
2. **No awareness.** Nothing tells two Cells they edit one file, and no
   Cell knows its own name or who else is here: asked about a peer, it
   knows of none.
3. **Questions and answers read poorly.** The asker's chat shows "Messaged
   a Cell"; the recipient's shows a bubble headed "You" (or, after #23135,
   a fold under the sender's title). Nothing says it is a question, or
   which question an answer answers.

## Decisions

1. **No broker, no new tools.** Agents message with `t3_thread_send` and
   see who's here with `t3_thread_list`. A reply is a send back. Nothing
   new on the wire, nothing to keep in step with upstream's MCP.
2. **A peer is not the person.** When a message comes from another Cell
   that isn't one of the recipient's principals (below), its provider reads it
   framed: who sent it (the Cell's name, title, thread id, and project when
   it's another), that it is not the person and carries no authority (it
   can't approve anything, widen access or change what the person asked),
   to check its claims against the repo, and to reply with `t3_thread_send`
   only if it asks something: no thanks, no acknowledgements. Every line of
   its words sits behind `│ `, and characters that hide or reorder text
   (controls, bidi, zero-width, tag characters) are removed, so nothing in
   it can pose as the frame; the title it quotes loses its quote marks. The
   stored message is untouched: people read the words, models read the
   frame.
   - **Principals stay as they are.** A Subcell's parent gives it its
     task, and Aski passes on what the person asks: their messages reach
     the provider as today. A Subcell writing to its parent is framed, and
     so is a fork's source (the person forked it to try another way), and
     a Cell's task to a Cell it launched: a launch records no launcher, so
     a claim to be one can't be checked.
   - **Fail closed.** A sender that can't be read is framed as a peer.
   - **Prompt commands are the person's.** `/logout` (Cursor, Antigravity)
     runs only from a message the person sent. Framing alone already keeps
     a peer's `/skill` from running.
3. **No collision notices.** We built them (two Cells that edited one
   file within 30 minutes, or both in one checkout, were each told once,
   in a message queued behind their turn) and took them out on
   2026-10-29. In six days they fired 73 times and caught no real hazard.
   "Checkout" meant the chat's starting folder, not where an edit landed.
   Cells here make their own worktrees with `git worktree add`, so any two
   Cells of one project that wrote anything, anywhere, "shared a
   checkout", and one file in two worktrees never matched. Each notice
   cost a turn after the work it warned about, its reply took the place
   of the Cell's close-out, and the person saw the model's words in the
   queue. The real hazard, two Cells with uncommitted changes in one git
   working tree, never occurred. If it does, it belongs in who's here
   (decision 6), worked out from git: no message, no turn.
4. **Chat: mail, not conversation** (the original app's cards, kept to what one
   transcript shows):
   - **The recipient** sees a note in place of the person's bubble, in the
     transcript's own column and type: a line with the sender's Cell (its
     figure and name, a door to its chat) and which way ("asks you",
     "replied to"), then the message whole, folded only when long, as the
     person's own long message folds. A reply quotes the question it
     answers; an ask shows "answered" once this Cell has written back.
   - **The asker's** tool row says what it did, to whom: "Asked Otter: Can
     I take 0043?", "Wrote to Otter: …".
   - **Both from one transcript.** An ask is a message to a Cell whose
     first sentence ends in "?"; a reply is a message to a Cell that wrote
     to this one earlier. Nothing is stored, nothing read from another
     chat.
   - **What the card can't draw stays upstream's row**: a workflow's
     opening, an automation's run, a message with attachments. At the end
     of the note's name line, on hover as under the person's own message:
     when, "Edit from here", copy; a steer says "mid-turn".
   - **A past collision notice** is a notice row: "Same file as Badger:
     `apps/web/src/x.ts`", the rest folded.
   - **No Answer field.** The original app let the person answer as the agent.
     Here the person answers as themself: the sender's name opens its chat.
5. **Scoped by repository, not project.** A project is one environment's
   record of a folder; a repository is what Cells share. Projects whose
   remotes match (upstream's own grouping, `repositoryGroupingKeyOf`, the
   key that matches across machines too) are one place; a project with no
   remote is a place of its own.
6. **Every Cell knows who's here.** At a turn's start a Cell is told its
   own name and one-liner (its title), and the other Cells at work in its
   repository: name, one-liner, branch and state, eight at most, then "and
   N more". Told only when the names, one-liners or branches changed since
   it was last told; a state alone is not news. The original app's roster rode
   every tool call (41,214 times, 6 to 8M tokens, used about ten times);
   this is a few lines per change. "At work" is under way, or active in the
   last two hours. A Subcell isn't listed or told: its Cell is. Titles are
   set by agents, so they are one line, without quote marks. The note is
   extra: nothing failing in it fails a turn, and a command the person
   types (`/compact`) gets none, since upstream knows it by the whole
   text. A Cell the person settled isn't listed.
7. **Drift.** The server's frame is two calls in two cool files
   (`ProviderTurnStartService`, `ProviderTurnControlService`, 20 and 7
   upstream commits in 90 days); everything on the web is a substitute.
   The frame and the `/logout` guard are what any T3 user would want; they
   go upstream once we ask.

## Plan

- [x] `stemcells/words/cellNames.ts`: the Cell names, shared by the web and
      the server (moved from `apps/web/src/stemcells/cell`)
- [x] Server: the frame (pure) and its tests
- [x] Server: the seams in `ProviderTurnStartService` and
      `ProviderTurnControlService`; the `/logout` guard; a contract test
- [x] Server: collisions (pure) and the service that says them; tests
- [x] Web: the exchange model (pure) and its tests
- [x] Web: the recipient's card, the asker's row, the notice row
      (substitutes)
- [x] `seams.md`; drift, types, lint, tests
- [x] Review
- [x] Scoped by repository: collisions, the frame, who's here
- [x] Who's here: the roster (pure), told at a turn's start when it
      changed; tests, and the contract test
- [x] First pull request: one environment (#223)
- [ ] Second pull request: environments linked to each other (below)

## Across environments (the second pull request)

Stemcells environments only (this app, other Macs, dev servers), two-way.
T3 Code's own app can't join: it doesn't run this code, and the only way
in is its pairing token, which is full control (terminals included) that
any agent here able to read our state could use.

1. **A link is a pair of narrow credentials.** Each environment mints one
   for the other, on the person's say-so (their session, `access:write`).
   A credential reaches only the peer routes below: who's at work in a
   repository the caller names, and delivering a framed message to one of
   them. Stolen, it sends zero-authority mail and reads titles. The
   environment that minted it keeps only its hash; the one that holds it
   keeps it in upstream's secret store (owner-only files). Unlinking on
   either side ends both.
2. **The person's client links.** It is already connected to both, so
   Settings › Linked machines offers each environment it reaches and links
   both ways in one action, at the addresses the client uses (this
   desktop's own address on the network for the other side). Each server then says
   hello to the other with its new credential; if one can't reach the
   other, the link is undone and the page says which way failed. Relay
   and SSH addresses are refused: never anyone's cloud, and never a tunnel
   only this device reaches.
3. **Who's here spans the link.** Every minute an environment asks each
   linked one for the Cells at work in the repositories it has Cells in,
   and who's here lists them with their environment's name.
4. **Messages.** An agent writes to a Cell elsewhere with one tool,
   `stemcells_peer_send` (thread, message): the thread id, as who's here
   names it, finds its machine. The receiving
   environment checks the credential, that the recipient's repository is
   the one the sender named, and upstream's own rule for `t3_thread_send`:
   no message to a Cell whose modes are broader than the sender's. It
   delivers the message as the app's (no sender thread of its own), its id
   naming the sending environment and Cell, so the frame and the card name
   both. The frame always applies: no Cell elsewhere is a principal.
5. **Not across the link:** a door into the other environment's chat.

- [x] Server: links and their store (`peers/Links.ts`, upstream's secret
      store); tests
- [x] Server: the peer routes (person's and peers'); tests
- [x] Server: remote rosters in who's here; the frame for mail from
      elsewhere
- [x] Server: `stemcells_peer_send` (one seam in `McpHttpServer.ts`)
- [x] Web: Settings › Linked machines; the card for mail from elsewhere;
      the sender's row
- [x] `seams.md`; drift, types, lint, tests
- [x] Two servers linked in a lab; review

## Not done, on purpose

- **Broadcasts.** N sends; in the original app, the noisiest kind.
- **Unread and read states.** The card sits in the chat that received it;
  upstream's queue shows a message still waiting.
- **The phone** keeps upstream's folded row for a message from another
  agent (#23135).
- **Claude's native peer origin** (`SDKMessageOrigin` `{ kind: "peer" }`)
  and steering a peer's message at the next tool call (priority `next`
  rather than `now`) belong in upstream's Claude adapter, a hot file.
  Proposed upstream with the frame.

## Review

An independent review found seven problems; six are fixed, with tests:

- A fork's source read as a principal (`lineage.relationshipToParent` must
  be `subagent`).
- A Cell launched by another got its task framed. The second review
  found the fix (the first message of a thread an agent started) let any
  Cell write first to an empty one unframed; a launch records no
  launcher, so the task stays framed.
- The card replaced upstream's row whole: a workflow's opening, attachments,
  "Edit from here", copy, time, the steer mark and a failed status were gone.
- A title could close the frame's quotes; tag characters, variation
  selectors and the soft hyphen survived the sanitizer.
- One edit could queue a notice per Cell it ran into, each a turn.
- A notice on a Subcell ran it again and woke its parent.

Left for upstream, since it lives in upstream's orchestrator and is any T3
user's problem: an agent with write access to a thread can rewrite the
person's queued message (`t3_queue`, action `edit`), and it stays the person's
(`createdBy: "user"`, no sender), so neither the frame nor the `/logout`
guard sees it. The fix is to stamp the editing thread on an edit made by
another thread, or refuse it. Offered upstream once we ask.

A second review, of who's here and the repository scope, found five.
Four are fixed, with tests: the note stopped `/compact` (upstream matches
the whole text), the first-message rule above, a fresh provider thread
wasn't told again, and a branch in a collision notice went unsanitized.
The fifth stays: under upstream's own restart note the provider reads
"User message:" twice, and the note between says it isn't the person.

Across environments, two servers in the lab (fake providers, homes of
their own) linked both ways through the person's routes. A request
without the person's session, or a peer route with a token neither
minted, got 401; a token at the wrong address, 502 with which way
failed. Linked, each asked the other who's at work; unlinking on one
ended it on both, and the old token then got 401. With one server
stopped, the other's page said it couldn't be reached within the
minute. The secret store's file was owner-only.

An independent review of the second pull request found five; all are
fixed, with tests:

- A message reading `/compact` or `/logout` would have run it on the
  recipient (upstream runs a maintenance command from the raw text).
  Both sides refuse one.
- A linked machine's refusal reached the sending model in its own words.
  The sender now hears fixed words of its own for each kind of refusal.
- The message limit counted characters, the peer route bytes: a message
  under one could be turned away by the other. The sender measures
  what it sends.
- A machine asked only for the repositories its busy Cells work in, so a
  quiet Cell learned of no one. It asks for all of its repositories.
- Who's at work was read whole on every ask. A linked machine asks at
  most every ten seconds.

Left for upstream, as with `t3_queue`'s `edit`: a `t3_thread_send` reading
`/compact` or `/logout` runs it on the recipient on one machine too. The
fix belongs in upstream's send, any T3 user's problem.
