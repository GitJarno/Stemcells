# The phone's polish pass

The person's list (2026-10-29), from two phone screenshots: the home and a Cell's chat.

## Decisions

1. **Disk.** The plate stood above the home's scroll view with no inset, under the
   status bar. It moves into the home's own header, under the rail, shaped as a card: every
   tab, both homes, never over the clock.
2. **Opening and jank.** The home swapped trees as the machines answered: T3's home, then
   the four-tab home, then the line, each a new list with Aski remounted. The line now
   applies unless every machine says it has none, so the home opens on the line and stays there.
   While a saved machine connects, the home already stands as it will. Every page of the
   home scrolls the same way (`automatic` insets under the header), so Aski and the rail
   stand at one height on every tab.
3. **Scope.** T3's chips left the list for good: the header's top right holds a projects
   button and, with two machines or more, a machines button. Each is a native menu that stays
   open while you tick: any number of projects, any number of machines; none ticked is all.
   The choice is ours, kept on the phone (`home/picks.ts`), and T3's single pick stays unset.
4. **A card's marks.** The Cell's colour already says its agent, so the agent's mark goes.
   The project's mark leaves the title's left, where it cost every title its first 28
   points, for the bottom right where the agent's stood, beside the pull request: the marks
   say where, the title says what. A settled row's project moves beside its time, too.
5. **Edges.** Darken, not blur: an eased scrim to the page's colour under the header and
   under the composer. A blur keeps bright text bright behind the clock and the glass
   buttons; a scrim takes it away. A scrim is one static layer, where a blur re-samples
   every scrolled frame. Eased stops, so no band shows where it starts.
6. **Needs you.** An ask is a card like the others: its Cell on the left with its name,
   the question as the title, its age top right, its project's mark bottom right. Open, it
   grows the options and the reply under the same head.
7. **Usage.** Opens on Cost over 30 days. "Raw token cost (API rate)", no footnote. The
   chart is the Mac's: a smoothed line per agent over a faint fill, in the agents' colours.
8. **The Cell in its chat.** The Cell leaves the composer for the header, beside its name,
   with what its chat is about under the name. The room over the composer is for what asks
   for action now: approvals, questions, the working chip, the queue. A name already lives
   in the header; the Cell beside it is the pair the Mac's ledge shows, kept where the phone
   keeps who you talk to, and it stays in view with the keyboard up.
9. **Aski.** One skin on the Mac's Cmd+T home and the phone, from one source
   (`apps/web/src/stemcells/aski/skin.ts`); its eyes are the ground's (black), never the
   ink's white, open, shut or blinking. A black eye can't sit in the skin's empty ring round
   it, so the cells round both eyes are one solid band the eyes are cut from. Aski's scenes
   (`paint.ts`, its own reference images) still draw ink eyes while one plays.
10. **Shelves.** On the rail's tabs the list draws no shelf headers ("Flying ⌃",
    "Settled (365) ⌄"): the rail already says which Cells these are, and every shelf is open.

## Plan

- [x] 1 Disk plate in `AskiHome`, card-shaped
- [x] 2 `lineApplies` holds the line until a machine says none; `HomePage` scrolls as T3's list
- [x] 3 Scope store + multi-select menus; HomeScreen filters by it; no chips on pages
- [x] 4 Card marks: project bottom right, no agent mark
- [x] 5 Top and bottom scrims
- [x] 6 Ask cards in the row's shape
- [x] 7 Usage: Cost, 30d, API rate label, Mac's chart (helper)
- [x] 8 Cell in the chat's header; no ledge
- [x] 9 Aski's skin and eyes (helper)
- [x] 10 No shelf headers on the rail's tabs
- [ ] seams.md, tests, typecheck, lint, drift

## After the first install

- [x] The home crashed on an ask from a Mac older than an ask's steps (#357): the phone's reader
      now fills what an ask gained since (`needs/wire.ts`, `line/read.test.ts`).
- [x] One machine without the line took it away from all of them, back to the four old tabs:
      now only every machine saying so does (`line/line.ts`).
- [x] The header said "Syncing threads...": it says Cells (a substitute of
      `workspace-connection-status.ts`).
