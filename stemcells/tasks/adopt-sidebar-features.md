# Three of T3's sidebar features, in the Cells' column

Upstream at 7103527dc changed its sidebar three ways. Our column stands in its
slot, so none reached the person there; upstream's own list (the column's wide
state) has all three as upstream ships them.

## Decisions

1. **New starts in the project the column shows** (upstream #35185). The
   column's New Cell hands the project it is filtered to, and upstream's
   `resolveScopedNewThreadProjectRef` picks where: that project, on the
   machine of the chat on screen when the chat is one of its own, else its
   first member (`upstream/newCellProject.ts`). Unfiltered, and from ⌘T, a new
   Cell starts where it did. No Shift escape: ⌘T already starts in the chat on
   screen's project.
2. **The project menu adds a project** (upstream #33057). Add project heads
   the column's project menu and opens upstream's add-project palette, as in
   upstream's. The menu still shows only with two projects or more: a column
   with one stays as calm as it was, and Search and a dropped folder still add
   one there.
3. **No machine on a row** (upstream #40736). The column lists this Mac's
   Cells only (the needs stream and the shelves are the primary server's,
   `left-column-v3.md`, decision 9), so every row would name the same machine.
   The rows never showed the branch, and the hover card keeps it. The wide
   list shows the machine as upstream does.

## The phone

- New: the home's header picks stand in T3's list filter on iOS, but T3's New
  still read its own, hidden pick. A seam hands it ours: a new Cell starts in
  the one project (and on the one machine) the home is narrowed to
  (`home/newTask.ts`). T3's phone order stays: the chat on screen's project
  first.
- Add project: T3's phone has none in its project menu; it adds projects from
  a new chat's picker and Settings, as ours does.
- Machine on a row: the phone's cards already show the machine once it knows
  two (`home/RowCell.tsx`).

## Steps

- [x] New Cell in the column's project, with the adapter and tests
- [x] Add project in the column's project menu
- [x] The phone's New follows the home's picks, with its seam row
- [x] Captures from the desktop lab
- [x] Gates and the pull request

## Review

- Seen in the desktop lab: the menu's Add project opens upstream's palette,
  and with the column on one project New Cell opened its draft there where it
  had opened the focused draft's project.
- The phone's change is tested in its logic and typechecked, not yet seen on
  a phone: a simulator build needed more free disk than the Mac had.
