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

- **One deriver**, `factsOf(thread)`: every fact true of a chat now, from
  upstream's records of it. It decides and does nothing else.
  - Landed is a run that completed, with a start and a landing. One that
    stopped, failed, was cancelled or rolled back didn't land.
  - Time alone is growth's own count (`stemcells/ledger/alone.ts`, which
    the web's `cell/growth.ts` now imports): the run less its blocking
    waits, clipped to the run, overlaps once.
  - Asks are every request the run made of the person, blocking or not.
  - The close-out is the kind `needs/closeOut.ts` reads from the run's
    last reply with words in it: `done`, `left` or none.
  - Each settle the ledger reads is its own fact, keyed by its time.
  - A merge is dated by the forge's `mergedAt`, or by upstream's last read
    when the forge gave none.
- **Cells only:** not Aski's chat, a subagent's thread or a side chat. A
  deleted chat still reads, as upstream keeps its rows.
- **Live**, the tap is upstream's own event stream, the one the needs list
  follows. Only an event that can make a fact has its chat read: a chat
  made, a run completed, a chat settled, a pull request's state read. A Cell
  streams thousands of other events an hour.
- **The tap notes the sequence it has read through**, so a restart carries
  on from there: nothing that happened while the server was down, or
  between a failure and its restart, is missed.
- **The tap and the backfill each run on a loop of their own**, so a tap
  that can't read doesn't keep the backfill from finishing. The backfill
  waits to be asked by the tap, so no chat is read before the tap knows
  where it starts.
- **The backfill** is the same deriver over every chat, once: 20 s after
  the server is ready, 10 chats at a time with 200 ms between, on SQLite's
  reader as `upstream/arcs.ts` reads. It notes its cursor after each batch
  and that it finished. When upstream's log no longer reaches the tap's
  note (pruned, or another database), the tap starts from now and every
  chat is read again; nothing is kept twice. A note the log can't be
  replayed from (an event this build can't read) is given up the same way,
  once a run, so a broken stream doesn't read every chat over and over.
- **`GET /api/stemcells/ledger`**, read scope as the arcs': a page of facts
  in the order they were recorded. `threads=a,b` reads those chats alone;
  `after` and `limit` page; `backfilled` says whether the past is all in.

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
- **The driver is the one at first read.** A chat that switches provider
  later keeps the driver it was born with here.
- **The ledger's own tap, not the needs list's.** It needs each event's
  kind to skip the ones that make no fact, and its sequence to carry on
  after a restart. Both come from the same upstream call.
- **No worker of its own.** The ledger's file is written a few rows at a
  time and read a page at a time, on one connection.
- **The server runs without it.** A file that won't open is logged, and
  the endpoint answers 503.

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
  once; an update or a delete is refused; a file that won't open leaves the
  service standing.
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
- **Not measured:** a real database of 10 GB, read cold. Its batches will
  read slower, and a request whose session read queues behind one waits
  that long; the small batch and the pause are what bound it.
- An earlier run that seemed to show the backfill slowing requests had
  compared a start-up with an idle server. Start-up alone held requests
  for up to 4 s on that database, with or without the ledger.

## Left

- Achievements over the facts, and their place in Settings › Lineage
  (`cell-marks.md`).
- A fact for a fork's parent, a provider switch or a failure: none is
  needed by a mark yet.
