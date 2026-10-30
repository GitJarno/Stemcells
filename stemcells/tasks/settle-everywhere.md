# A settle by hand on any device closes the chat everywhere

Settling a Cell by hand closes its pane in every window of the Mac it was
settled on (`aski-manager.md`, decision 10). Settled from the phone or
another Mac, the pane stayed open: a pane leaves only for a fresh mark in
this device's local storage, because upstream's auto-settle (a quiet day, a
merged pull request) turns the thread settled just as Settle does and must
never pull a chat from under its reader. The phone never closed a chat for
a settle at all.

## Plan

- [x] Server: tell a settle by hand from upstream's own. The stored event
      carries its command's id; upstream's settles send ids starting
      `server:` (`auto-settle`, `settle-after-run`), a client's its own
      (`upstream/needs.ts`, `settledByHandAt`)
- [x] Server: the needs list keeps, in memory, each Cell's latest settle by
      hand for a day, at most 200, and forgets it once the Cell is unsettled
      or gone; it sends them as `settles`, so the stream carries each to
      every Mac and a phone's read finds it hours later. A restart loses them
- [x] Wire: `settles` optional on the web's copy, which the phone reads
      through its kit; an older server omits it and nothing closes
- [x] Mac: a pane closes at once for this device's mark; the server's
      entries close panes as each window hears them, once
      (`landing-elsewhere.md`); a Cell opened settled stays open, Undo
      brings it back
- [x] Phone: a chat open when the app comes back to the front reads its
      machine's list; a settle by hand of its Cell later than when the app
      went to the background shows the home instead
      (`chat/closesOnReturn.ts`, `chat/useClosesOnReturn.ts`, from the
      `ThreadDetailScreen` substitute). Never while the chat is in front:
      only on the return, and only for an answer within 10 s of it, as the
      route reconnects
- [x] Phone, in columns (the iPad, an open foldable): the same, through the
      Threads tab opened without columns (`useShowHome`), so the detail
      stands empty beside the home; a sidebar that floats over the content
      opens. A Cell previewed in the inspector beside another chat stays
- [x] Tests: the command-id rule and a batch keeping the settle
      (`needs.contract.test.ts`), the list's day, latest per Cell and
      unsettle (`Needs.test.ts`), the JSON (`wire.contract.test.ts`), the
      pane's choice (`settled.test.ts`), a settle heard only from the server
      (`SettledPanes.browser.test.tsx`), the phone's choice
      (`closesOnReturn.test.ts`) and the tab's state it closes to
      (`showHome.contract.test.ts`)

## Decisions

- No store: the phone reads the list on its return, and each Mac follows
  every connected server's settles (`landing-elsewhere.md`). A day in
  memory covers a phone away for hours, and a restart reads it back from
  the event log.
- Time is the settle's own (`settledAt`, else when it happened), sent as ISO
  like the list's other times. The phone compares it with its own clock's
  time of leaving; clocks a second apart change nothing a person sees.
- An agent's settle through MCP (`mcp:` ids, such as Aski's when asked)
  counts as the person's; only `server:` ids are upstream's own.
- The phone closes on return, never while the chat is looked at: a settle
  from before it left came while the chat was in front, or was there when
  it was opened, on purpose. The way back is the Settled tab; a chat opened
  there stays, its settle older than any later leaving.
- The server, not the phone, says whether the Cell is still settled: on
  return the phone's own record of the chat may not have caught up yet,
  and a settle undone on the Mac must not close it.

## Review

Each new test fails without the change (the wire test by its timeout, as
the list never carries `settles`; the unsettle case the same way) and passes
with it. A Mac away, or showing a linked machine's Cell, closes it too since
2026-10-30 (`landing-elsewhere.md`). Only a device shows the close itself: the app
backgrounded for a while, the Cell settled on the Mac, the app brought back,
on a phone and on an iPad.
