# The Cell heads its chat again on the iPhone

Upstream's sync of 2026-11-08 (`a9e709f15`) made every phone screen draw
one `AppBar` (`components/ui/AppBar.tsx`) and deleted the two modules our
iOS chat header wrapped: `features/threads/useThreadHeaderOptions.tsx` and
`thread-header-appearance.ts`. Their substitutes went with them, so on iOS
a Cell's chat lost:

- the Cell standing beside its name, what the chat is about under it
  (`apps/mobile/src/stemcells/chat/CellTitle.tsx`, which went with them:
  `git show 52d173f08:apps/mobile/src/stemcells/chat/CellTitle.tsx`);
- git, files and terminal folded into one Code menu (`chat/code.ts`);
- the home button's words, "Back to the Cells";
- the header with no band behind it (`NO_HEADER_BAND`).

The name itself stays: `ThreadHeader`'s substitute still titles the chat
with the Cell's name, Aski's with Aski.

## Design

Upstream's `AppBar` takes a `titleContent` that iOS ignores, and its
`menus` and `actions` arrive from `ThreadHeader`. Prefer, in order:

1. A substitute of `ThreadHeader` that hands `AppBar` our title and one
   Code menu (git's and terminal's menus and the files action as its
   items), if `AppBar`'s props carry all of it.
2. Else a substitute of the smallest module `AppBar` reads for its iOS
   title, rather than an edit in `AppBar.tsx`, which upstream edits often.

## Plan

- [ ] Read `AppBar.tsx` and `NativeStackScreenOptions` for how the iOS
      title, subtitle and items are set; pick 1 or 2
- [ ] The Cell beside its name, its about under it
- [ ] One Code menu
- [ ] "Back to the Cells"
- [ ] No band behind the chat's header
- [ ] Contract test: the substitute's module and its importers
- [ ] Prove it on the simulator (`test-t3-mobile`): a Cell's chat, Aski's,
      a draft; before and after
