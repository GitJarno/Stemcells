# Performance pass: smooth swipes, no stalls, still when idle

The person asked for the app to feel buttery smooth on the desktop and the
phone: a swiped-to tab is ready before it arrives, no beach balls, nothing
drawing while nothing changes.

## What the Mac showed (2026-10-27)

- The server's own `event-loop-stalls.ndjson`: 52 stalls of 10–55 s in a
  week, with almost no CPU while frozen (a synchronous wait on the disk, not
  work). The disk is 99% full.
- macOS flagged the server six times for 2–8.6 GB of SQLite writes an hour.
- The updater keeps its 4.6 GB build checkout on disk after every build, and
  deletes it with `rmSync` on Electron's main thread.
- With nobody at it, the app's GPU process sat at 59% CPU and its page at 36%.

## Plan

- [x] Updater: delete off the main thread; drop the build checkout's heavy
      untracked files once the build is staged.
- [x] Idle: the "?" over a waiting Cell steps instead of bobbing every frame,
      and rests off stage.
- [x] Restyle: no `:has()` on a subject that names nothing (Look's rows and
      columns, the composer's halo), with a guard test.
- [x] Swipe: two pages either side stay mounted, so the page a second quick
      swipe reaches was mounted a turn earlier; Cell marks no longer
      re-render on every streamed word, the storm that held mounts back.
- [x] Phone: home Cells under a chat hold still; a Cell keeps its last look
      while its next composes; the night, the attach sheet and the chat's
      inset are right in their first frame.
- [ ] Phone: the home keeps one tree shape across tabs and search (left: it
      leans on upstream's empty list, which wants a device to check).
- [x] Project icons: set through the app's project API on this Mac.
- [ ] Upstream: take T3's newest work (its own pull request).

## Review

- The beach ball's likeliest cause is the server, not the window: its own
  stall log shows freezes of 10–55 s with almost no CPU, a synchronous wait
  on SQLite and the disk. The disk was 99% full. Freeing space is the
  person's to do; the updater now gives back what its builds took.
- Found by tests that failed first: the updater's build output staying
  behind, the reach of a second swipe past the mounted pages, and two
  `:has()` rules that ran on every element.
- Not measured in the real app: the frame and restyle gains rest on the
  repo's own earlier measurements and on how Chrome matches selectors.
