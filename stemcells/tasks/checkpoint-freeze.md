# The server froze while SQLite checkpointed

Chats on the Mac running the server showed "<Mac> is reconnecting" (and the
phone dropped) several times a day. The window's own server, on the same
machine, had stopped answering its 15-second heartbeat.

## What the system showed (2026-10-26)

- The server's freeze log: 20 freezes of 15 s or more in five days, the
  longest 45 s. The traces show longer ones it missed (89 s, 30 s): a
  freeze that crosses its 30-second sample can go unrecorded.
- Every freeze of 5 s or more used almost no CPU (median 5% of its
  length): the main thread was waiting, not working.
- Four stack samples of the server during freezes, all the same: the
  checkpoint worker in `pwrite` into `statev2.sqlite`
  (`PRAGMA wal_checkpoint`), the main thread and the reader worker in
  `pread` of that file, for the whole sample.
- An independent process reading `statev2.sqlite` blocked for as long
  (12.6 s, 5.4 s), cached or uncached; uncached reads of another file on
  the same disk stayed fast. macOS holds readers of a file while a write
  to it is stuck; the disk itself was readable.
- The writer connection lives on the main thread. While the checkpoint
  worker's write into the database file is slow (a 98%-full disk under
  load), every statement the writer runs that needs a page from the file
  blocks the event loop, and with it the heartbeat.

## Plan

- [ ] The writer runs nothing while a checkpoint is in flight: statements
      wait asynchronously for the worker's reply, so a slow write delays
      queries instead of freezing the event loop.
- [ ] The worker checkpoints only when the main thread asks (its idle retry
      asks instead of checkpointing on its own).
- [ ] A test that fails on main: a statement issued while a checkpoint
      reply is outstanding does not run until the reply arrives.
- [ ] Seam listed in `stemcells/seams.md`.
- [ ] Prove it on this Mac: install, then the freeze watchdog and
      heartbeat stay quiet under the same load.

## Review
