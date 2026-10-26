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

- [x] The writer runs nothing while a checkpoint is in flight: statements
      wait asynchronously for the worker's reply, so a slow write delays
      queries instead of freezing the event loop (#317).
- [x] The worker checkpoints only when the main thread asks (its idle retry
      asks instead of checkpointing on its own) (#317).
- [x] A test that fails on main: a statement issued while a checkpoint
      reply is outstanding does not run until the reply arrives (#317).
- [x] Seam listed in `stemcells/seams.md`.
- [x] The freeze log records the freezes that drop clients: a sample counts
      a gap no timer has recorded yet, so one that crosses the 30-second
      tick is no longer lost.
- [x] Prove it on this Mac: installed at 20:45. In the 8 minutes before,
      the old build froze 8 times (a watchdog's 3-second probe; its own
      log, 55 s at the longest). The new build froze none in the 24
      minutes up to a reboot, with the disk still 98% full and the server
      writing 1.7 MB/s. After the reboot, under the boot's load, it
      stalled once for 4.7 s: as it spawned `git`, with no SQLite
      statement running, so another cause, and too short to drop a client.

## Review

- The cause was found by sampling the running server during freezes,
  not by reading code: the first theory (a slow query, then the whole
  disk) was wrong both times. Five samples, and an independent reader
  blocked on the same file while other files stayed fast, pinned it.
- The freeze log missed every freeze that crossed its 30-second tick (all
  three long ones), which is why the app said "disconnected" and never
  "froze for": the second PR.
- Left outside this task: the disk is 98% full, which is what makes the
  checkpoint's writes stick, and the server writes 0.4 to 2.4 MB/s to its
  4 GB database (macOS files a disk-writes report against the app daily).
  The Claude status check (`claude --version`, 20 s limit) also failed
  once during such an episode, with macOS's space reclaimer hung.
