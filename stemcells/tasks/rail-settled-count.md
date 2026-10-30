# The Mac's Settled count matches the phone's

The server sends each window only its 25 newest settled chats and keeps the
rest back, counted per project. The phone's Settled counts both
(`phone-home-still.md`); the Mac's column counted only the 25, and its
"N more · search finds them" line was 25 minus the 30 it lists, so never
shown.

## Plan

- [x] `upstream/column.ts`: `keptBackOf` counts the kept-back settled Cells
      in the projects the column's filter shows, less those a page brought
      in (upstream's `unloadedOlderSettledCount`); `useSettledKeptBack`
      reads the primary server's counts with no pages mounted.
- [x] `rail/Cells.tsx`: Settled counts its own plus those kept back; the
      "more" line says how many it doesn't list.
- [x] Tests: `keptBackOf` by project; the column's Settled count and "more"
      line, failing on the old code.

## Review

Settled on the Mac now says the same number as the phone's Settled tab, with
or without a project picked, and the line under the list names the rest.
Opening the column reads one count from the server, no pages.
