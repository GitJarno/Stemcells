# A settle by hand on any device closes the chat on every Mac

Settling a Cell by hand closes its pane in every window of the Mac it was
settled on (`aski-manager.md`, decision 10). Settled from the phone or
another Mac, the pane stayed open: a pane leaves only for a fresh mark in
this device's local storage, because upstream's auto-settle (a quiet day, a
merged pull request) turns the thread settled just as Settle does and must
never pull a chat from under its reader.

## Plan

- [x] Server: tell a settle by hand from upstream's own. The stored event
      carries its command's id; upstream's settles send ids starting
      `server:` (`auto-settle`, `settle-after-run`), a client's its own
      (`upstream/needs.ts`, `settledByHandAt`)
- [x] Server: the needs list keeps the last minute's settles by hand in
      memory and sends them as `settles`, so the stream carries each to every
      Mac; a reconnect gets them whole, a restart loses them
- [x] Wire: `settles` optional on the web's copy; the phone reads the same
      type and ignores it; an older server omits it and nothing closes
- [x] Mac: a pane's settle time is the later of this device's mark (at once)
      and the server's entry for its thread; everything else stays: the
      10 s window, a Cell opened settled stays open, Undo brings it back
- [x] Tests: the command-id rule and a batch keeping the settle
      (`needs.contract.test.ts`), the list's minute (`Needs.test.ts`), the
      JSON (`wire.contract.test.ts`), the pane's choice (`settled.test.ts`)
      and a settle heard only from the server
      (`SettledPanes.browser.test.tsx`)

## Decisions

- No new endpoint and no store: the needs stream already reaches every
  window, and a minute in memory outlives the 10 s a pane waits.
- Time is the settle's own (`settledAt`, else when it happened), sent as ISO
  like the list's other times, and the 10 s window counts from it.
- An agent's settle through MCP (`mcp:` ids, such as Aski's when asked)
  counts as the person's; only `server:` ids are upstream's own.

## Review

Each new test fails without the change (the wire test by its timeout, as
the list never carries `settles`) and passes with it. Left as it is: a Mac
hears settles only from its own server's list, so a pane showing a linked
machine's Cell doesn't close for a settle made on another device.
