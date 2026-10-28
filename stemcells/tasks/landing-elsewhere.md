# Chats started elsewhere land in the Mac's tabs

The person's ask (2026-10-28): a chat started on the phone shows on the
phone's line but never opens as a tab on the Mac, and they hop between the
two all day.

## Decisions

- What the two devices share is the set of open Cells, not their
  arrangement. The phone arranges them by stage, a list for one thumb; the
  Mac by project, in tabs. Settling, on either, closes a Cell on both.
  Closing a tab only stops showing it on this Mac: the column still lists
  it and the phone still shows it.
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

## Plan

- [x] `arrivalsAmong` and `subscribeArrivals` (`upstream/landing.ts`), on
      the quiet shell list so a run's streaming costs nothing; the lead
      window lands them (`windows/landing.ts`). Aski's copies still fly
      only for its own launches.
- [x] Tests: the phone's chat, another Mac's and an agent's land, each
      once; one started while closed lands, one seen before doesn't.
- [x] Checks, drift, check-local; merge.

## Review

Done. Typecheck, lint, drift and the landing tests pass; check-local
passed. Not run in the desktop app against a phone: the rule is the one
Aski's launches already take, and the tests pin which chats arrive. A
chat started on a second Mac against its own server lands only on a Mac
connected to that server.
