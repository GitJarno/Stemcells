# The ledger: facts about Cells, kept

Nothing about a Cell was stored. Its name is a hash of its chat's id, its
growth is worked out from upstream's runs each time it is drawn (a rollback
takes it back), and arcs and spend are read from upstream's tables when
asked. `stemcells/docs/fork.md`, rule 3, says our durable state lives in a
SQLite file of our own; this is that file's first use. A fact that happened
outlives its chat, upstream's schema and a recompute.

Achievements follow in `cell-marks.md`, as pure functions over these facts.

## What it is

- **One table of facts that only grows**, in `stemcells/ledger.sqlite` in
  the server's state folder, beside `asks.json`. Never upstream's database
  and never a migration in its sequence; the schema is versioned with
  `PRAGMA user_version`.
- **A fact:** a key, its kind, the chat's thread id, when it happened by
  upstream's clock, the environment's id, its data as JSON, and when it
  was recorded. The key is the fact's identity, so the same fact read twice
  is kept once (`INSERT OR IGNORE`). Two triggers refuse any update or
  delete, ours included.
- **Facts, version 1.** No title, no words a Cell or the person wrote, no
  path.

  | Kind      | Key                                        | Data                                          |
  | --------- | ------------------------------------------ | --------------------------------------------- |
  | `born`    | `born:<threadId>`                          | the Cell's name, its driver, its project's id |
  | `landed`  | `landed:<runId>`                           | run id, `ms`, `aloneMs`, `asks`, `closeOut`   |
  | `settled` | `settled:<threadId>:<settledAt>`           | none                                          |
  | `merged`  | `merged:<threadId>:<host>/<repo>#<number>` | the pull request's number                     |

- **One deriver**: every fact true of a chat now, from upstream's records
  of it, the chat's own (`factsOf`) and each run's (`landedOf`). It decides
  and does nothing else.
  - Landed is a run that completed, with a start and a landing. One that
    stopped, failed, was cancelled or rolled back didn't land.
  - Time alone is growth's own count (`stemcells/ledger/alone.ts`, which
    the web's `cell/growth.ts` now imports): the run less its blocking
    waits, clipped to the run, overlaps once.
  - Asks are the requests that held the run until the person answered,
    the same ones growth counts as waits. One asked in a message, which
    the run worked on past, is neither.
  - The close-out is the kind `needs/closeOut.ts` reads from the run's
    last reply with words in it: `done`, `left` or none.
  - Each settle the ledger reads is its own fact, keyed by its time.
  - A merge is a fact only at the forge's own merge time. Upstream reads a
    merge again until its forge gives one, and that read is told to the
    tap; a time of ours would stand for good, since the first write is
    kept.
- **Cells only:** not Aski's chat, a subagent's thread or a side chat. A
  deleted chat still reads, as upstream keeps its rows.
- **Live**, the tap is upstream's own event stream, the one the needs list
  follows. Only an event that can make a fact has its chat read: a chat
  made, its first run asked for, a run completed, a chat settled, a pull
  request's state read. A Cell streams thousands of other events an hour.
- **The tap only listens.** It names the chats to read and how far it has
  heard, and reads none itself: upstream holds what a slow listener hasn't
  taken in a buffer of 1,000 events that fails when full. A drain of its
  own reads the named chats at its pace, then notes the sequence the tap
  had heard when its round began, so a restart carries on from there:
  nothing that happened while the server was down, or between a failure
  and its restart, is missed. A tap that starts again waits for the drain
  first.
- **The tap, the drain and the backfill each run on a loop of their own**,
  so one that fails doesn't stop the others. The backfill waits to be
  asked by the tap, so no chat is read before the tap knows where it
  starts.
- **A read is bounded by its work**: 10 chats, and 50 of their runs, with
  200 ms before the next. A chat of hundreds of runs is read a slice at a
  time and never whole. A run's reply is read whole all the same: the
  close-out is told from a code block by the fences above it, so a reply's
  last lines alone can misread it.
- **A landing reads only what can be new.** The backfill reads a chat
  whole, oldest first. The tap's read takes a chat's 10 newest runs and
  goes further back only until a run whose landing the ledger holds, so a
  landing costs one small read however long its chat is. What it finds is
  kept oldest first: the landings held are then always every one up to
  some run, which is what lets the next read stop at the first it holds.
  A run that lands after ten newer ones have is the one it would miss.
- **A chat that can't be read is skipped**, not waited on. Chats that
  failed together are tried one at a time; one that fails alone three
  times running is left out, logged and counted (`skipped` on the
  endpoint), and the cursor and the note move on. Each start of the tap
  tries the skipped again, since a busy reader can skip a chat with
  nothing wrong of its own. Read fine later, it is counted no more. A
  failure of our own file skips nothing.
- **The backfill** is the same deriver over every chat, once: 20 s after
  the server is ready, on SQLite's reader as `upstream/arcs.ts` reads. It
  notes its cursor after each batch and that it finished, each in one
  transaction with the check that the tap hasn't started over: a start-over
  clears both, and a note made a moment before one could else land after
  the clearing and outlive it. When upstream's log no longer reaches the
  tap's note (pruned, or another database), the tap starts from now and every
  chat is read again; nothing is kept twice. A note the log can't be
  replayed from (an event this build can't read) is given up the same way,
  once a run, so a broken stream doesn't read every chat over and over.
- **`GET /api/stemcells/ledger`**, read scope as the arcs': a page of facts
  in the order they were recorded. `threads=a,b` reads those chats alone;
  `after` and `limit` page; `backfilled` says whether the past is all in
  and `skipped` how many chats are left out.

## Choices

- **Milliseconds, not minutes.** The design said minutes. Growth sums
  milliseconds against its thresholds, and whole minutes summed over many
  short runs would fall short of what growth shows. `ms` and `aloneMs`.
- **A rolled-back run keeps its landed fact.** It landed; the ledger says
  what happened. Growth still takes a rollback back, as it reads upstream.
  A run rolled back before the ledger first read it has no fact.
- **A fact is what the chat says when it is read**, a beat or more after
  the event. A chat settled and taken up again before that read has no
  `settled` fact for that settle, and a settle from before the ledger shows
  only while the chat is still settled.
- **A Cell is born of its first run**, on that run's provider. The fact is
  dated when the chat was made and kept once it has a run, so a chat read
  as it is made and one read long after say the same: the first write is
  kept, and a chat made on one provider may first run on another. A chat
  that never ran has no `born`.
- **The ledger's own tap, not the needs list's.** It needs each event's
  kind to skip the ones that make no fact, and its sequence to carry on
  after a restart. Both come from the same upstream call.
- **No worker of its own.** The ledger's file is written a few rows at a
  time and read a page at a time, on one connection.
- **The server runs without it.** A file that won't open is logged, and
  the endpoint answers 503. A file from a newer build counts as one that
  won't open, and is left exactly as it is.

## Plan

- [x] `stemcells/ledger/facts.ts` (the fact types) and `alone.ts` (growth's
      count, moved from the web so the server counts the same).
- [x] `apps/server/src/stemcells/upstream/ledger.ts`: the reads, the tap,
      our file; `ledger.contract.test.ts` pins the tables and fields.
- [x] `ledger/facts.ts`, `store.ts`, `Ledger.ts`, `http.ts`; mounted in
      `layer.ts`.
- [x] Tests: the deriver's decisions, the service on a temp SQLite file.
- [x] A real server, and the backfill on a large database.

## Review

- **Tests.** `facts.test.ts`: what lands, time alone, asks, close-outs,
  settles, merges. `Ledger.test.ts`, on a temp file with a source the test
  edits: the backfill reads every chat once; a change told twice is kept
  once; a rolled-back run's and a gone chat's facts stay; the next start
  reads no chat again and carries on from its note; a pruned log starts
  over without a duplicate; a note that can't be replayed from is given up
  once; a chat of 120 runs is read 50 at a time; the tap takes what it is
  told while a read doesn't return; a chat that can't be read is skipped
  after three tries, live and in the backfill, and counted until it reads
  again; an update or a delete is refused; a file that won't open, or a
  newer build's, leaves the service standing and the file as it was.
- **A real server**, headless, on a scratch home with fake providers and
  one Replay chat: its `born` fact was recorded 0.3 s after the chat was
  made and its `landed` 0.7 s after the run completed; the endpoint
  answered 401 without a token.
- **The backfill, measured** on a scratch database of 3,000 synthetic
  chats (15,000 runs, 90,000 messages, 620 MB): 21,302 facts in 90 s.
  A batch of 10 chats read in 30 to 80 ms on the reader and was kept in 2
  to 10 ms on the server's own thread. Requests polled every 100 ms took a
  median 4.6 ms during the backfill and 4.1 ms after it (95th percentile
  58 ms and 46 ms, on a Mac busy with other work).
- **A run's close-out is read once**, as it lands. In the six Replay runs
  the last reply was final 30 to 150 ms before its run completed. Not
  checked on a real provider: a reply finished after its run would leave
  that run's close-out empty for good.
- **A review of the first commit** found the tap and the backfill sharing
  one loop, where a tap that kept failing kept the backfill from ever
  finishing. Each has its own now.
- **A second review**, with a real database of over 10 GB in mind, found
  a batch bounded by chats and not by runs, and the tap reading chats
  itself, which could fill upstream's buffer. Both are as above now, with
  the skip, the newer file, the merge time, the first run's driver and the
  asks. It also asked for a reply's tail alone to be read; that is left,
  for the fences.
- **A third review** found a skipped chat never tried again, every landing
  reading its whole chat, `born` written before the run whose provider it
  names, and a test that failed only at the run's timeout. All four are as
  above now; a milestone that never comes fails its test at once. It asked
  whether a start-over could leave a stale backfill cursor: it could, when
  the backfill's fiber gives way between its check and its write, and the
  transaction closes that.
- **Not measured:** a real database of 10 GB, read cold. Its batches will
  read slower, and a request whose session read queues behind one waits
  that long; the small batch and the pause are what bound it.
- An earlier run that seemed to show the backfill slowing requests had
  compared a start-up with an idle server. Start-up alone held requests
  for up to 4 s on that database, with or without the ledger.

## Left

- A fact for a fork's parent, a provider switch or a failure: none is
  needed by a mark yet.
