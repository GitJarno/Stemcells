# The phone's home holds still across tabs

The person's report (2026-10-30): switching the home's tabs moved Aski's head and its line
about two rows for a couple of frames, then they snapped back. A switch should change only the
list under the tabs.

## Cause

Each tab mounts its own list, and Aski's header with it (`home/AskiHome.tsx`). The header
ends on the disk cards (`disk/DiskPlate.tsx`), which drew nothing until their machine's
figures came in. The figures live in T3's `hostResources` query, which lets a value go the
moment nothing reads it (`idleTtlMs: 0`), and the cards were its only readers. So a switch
mounted a header without its card; when the figures came back the header grew, and T3's list,
keeping its first row in place, scrolled Aski up and back.

## Plan

- [x] Keep each machine's last figures for the app's run (`disk/kept.ts`); a mount draws them
      on its first frame and the next answer replaces them, "no figures" too
- [x] One reader per connected machine beside the home's list, outside it
      (`DiskReaders` in `line/LineHome.tsx`), so the query never loses its last reader
- [x] Audit the rest of the header for values a mount lacks on its first frame
- [x] Test the store; phone tests, typecheck, lint, drift

## Review

The store's test fails without it. The phone's tests, typecheck, lint and drift pass. The
audit found nothing else: Aski's line, rolls and height are kept already, the greeting comes
from counts outside the list, the copies and the warn threshold are module stores, Aski and
the tab strip have fixed sizes, the night is drawn over the header, and the card's Free space
button and cog read the connection and server config the app holds anyway. Settings › Disk,
the asks and a stopped Cell's words read the same kept figures, so they no longer blank while
reading again. Only the phone can show the header standing still through a switch.
