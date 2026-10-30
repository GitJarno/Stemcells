# Chats started elsewhere land in the Mac's tabs, and settles close them

The person's ask (2026-10-28): a chat started on the phone shows on the
phone's line but never opens as a tab on the Mac, and they hop between the
two all day. Then (2026-10-30): a Cell settled on the phone stays open on a
Mac that was asleep or closed meanwhile, and one living on the Mac mini
never closes on the MacBook at all.

## Decisions

- What the devices share is the set of open Cells, not their arrangement.
  The phone arranges them by stage, a list for one thumb; each Mac by
  project, in tabs. Settling, anywhere, closes a Cell everywhere. Closing a
  tab only stops showing it on this Mac: the column still lists it and the
  phone still shows it.
- A chat that arrives from elsewhere is placed by the rule Aski's launches
  already follow (`aski-manager.md`, decision 6): its project's tab used
  last, with room, as a new column; else a new tab after the project's
  tabs; else a new tab at the strip's end. Nothing comes to the front: the
  person is on the phone, and the Mac is where they come back to.
- Arrived means made after the newest chat this app has seen on that
  server, kept per server across restarts. A chat started on the phone
  while the Mac slept lands when the Mac wakes; one whose tab the person
  closed never comes back on its own.
- What lands: a Cell of its own, started by the person (any device) or by
  an agent through the tools. Not a subagent's chat, a fork, Aski's chat,
  one the system made (an import, the first-run chat), nor one already
  archived or settled.
- A settle closes panes the way an arrival opens them: each window keeps,
  per server and across restarts, the newest settle by hand it has acted
  on, and closes its panes of each Cell settled after it, live or at the
  next start or reconnect (`windows/settling.ts`). Once acted on, a settle
  never closes anything again, so a Cell reopened after it stays. A window
  with no mark for a server starts it at now, so nothing older closes.
  Each window keeps its own mark, so none moves it under another; marks of
  a window gone a month are dropped. Undo anywhere brings a pane back
  (`ComeBack`), as for a settle made here, which still closes at once from
  this device's mark.
- Every connected Stemcells server streams its settles by hand alone
  (`/api/stemcells/needs/settles/stream`), with that server's own
  credentials, as upstream's clients reach it: sent whole on connect and
  only when one comes or goes. The shell stream already reaching every
  window can't tell the person's settle from upstream's auto-settle, which
  writes the same `settledOverride` and `settledAt`; the needs stream would
  carry every Cell's stage on every change. A server reached through T3's
  relay, or an upstream one (404), has no settles to follow.
- A server's day of settles lives in memory, so a restart reads them back
  from the event log: each Cell settled in the last day, whose latest
  `thread.settled` event carries a client's command id (`server:` ids are
  upstream's own). The shell's settled fields can't stand in for it, for
  the reason above.

## Plan

- [x] `arrivalsAmong` and `subscribeArrivals` (`upstream/landing.ts`), on
      the quiet shell list so a run's streaming costs nothing; the lead
      window lands them (`windows/landing.ts`). Aski's copies still fly
      only for its own launches.
- [x] Tests: the phone's chat, another Mac's and an agent's land, each
      once; one started while closed lands, one seen before doesn't.
- [x] Server: the settles-only stream, and the day's settles read back from
      the event log on start (`needs/http.ts`, `Needs.ts`,
      `upstream/needs.ts`).
- [x] Web: every connected server's settles (`needs/settles.ts`), each
      window's marks and closes (`windows/settling.ts`, `leaveSlateOf` and
      `settlesAmong` in `tabs/settled.ts`); a pane's own hook keeps only
      this device's instant close.
- [x] Tests: away and back closes once; reopened after its settle stays; a
      first start closes nothing old; a settle on a second machine closes
      its pane once; a restart's list from the event log.
- [x] Lab, checks, drift, check-local; merge.

## Review

2026-10-30: in the lab app (fakes only, a home of its own), a Cell started
over RPC with `creationSource: "mobile"` landed as a tab. With the app
closed, a server alone on the same home took a settle by hand over RPC;
the app started again (its server restarting, the settle read back from
the event log) and the tab closed. Not run against two machines: the
second machine's case rests on its test and on the same stream code the
lab ran for the Mac's own server.

2026-10-28: typecheck, lint, drift and the landing tests pass; check-local
passed.
