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
`menus` and `actions` arrive from `ThreadHeader`, so neither a substitute
of `ThreadHeader` alone (it can't reach the props it hands the bar) nor
one of a module the bar reads would do. Chosen: `ThreadHeader`'s
substitute says which chat it heads (`chat/header.ts`), and a substitute of
`AppBar` (iOS's file only; Android's `.android.tsx` stays T3's) changes that
one bar: `chat/code.ts` folds whatever `ThreadHeader` hands it as actions
and menus into one Code menu, and screen options set the Cell's title
(`headerTitle`, which the stack header draws as its title item) and
`NO_HEADER_BAND`. Every other bar passes through untouched.

## Plan

- [x] Read `AppBar.tsx` and `NativeStackScreenOptions` for how the iOS
      title, subtitle and items are set; pick 1 or 2 (neither: above)
- [x] The Cell beside its name, its about under it (`chat/CellTitle.tsx`,
      back from history, sized by the bar's own `HeaderItemsWidthContext`)
- [x] One Code menu
- [x] The Code menu's contract again (`upstream/codeMenu.contract.test.ts`
      pins what `ThreadHeader` hands the bar; `chat/code.ts` folds it)
- [x] "Back to the Cells": dropped. Upstream's home button said "Go to
      threads list"; its bar's button now says "Back", with no T3 word left
      to replace
- [x] No band behind the chat's header
- [x] Contract test: the substitute's module and its importers
- [x] Prove it on the simulator (`test-t3-mobile`): a Cell's chat, its
      Code menu and git's submenu, a draft; before and after. Aski's chat
      needs Aski's instance, which a lab home has none of: its title is
      `CellTitle`'s Aski branch, as before the sync

## Review

The bar's title, menu and edge come back through one substitute that
passes every other bar through, and the fold no longer keys on item ids:
it takes whatever upstream's chat header hands its bar, and a contract
test says what that is today. The first simulator build also stopped at
launch on Expo's precompiled media library, fixed on its own (#93).
