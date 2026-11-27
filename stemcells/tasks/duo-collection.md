# The Duo's rail: Aski where the group ends, and the Collection from Usage

Two asks from the person, on the Duo (2026-11-27):

1. **Aski stood in one place.** In the rail, Aski took the place after a top
   group of two (a chat's new chat and code). Usage has one (its filter), a
   pull request three, so Aski floated a place too low or sat on a button.
2. **No way to the feats on the Duo** worth the name: the Collection was a
   row deep in Settings. It belongs by Usage (what the Cells spent beside
   what they earned), in the rail, by Aski; and on a screen that wide it
   should read in one look, the same feats and rules as the Mac and the
   phone.

## Decisions

1. **The rail's top group is read where UIKit is handed it.** Every screen's
   header items pass through T3's `V5StackHeader`; a seam hands its trailing
   buttons' count to a store (`aski/rail.ts`) while its screen has focus and
   its workspace tab is the one shown (T3 keeps every tab's header
   mounted), the newest such header winning. Ours stand a pitch after the
   group's last button, in both postures (unfolded 156 pt then 63 apart,
   folded 198 then 60), and glide when the group changes. Never into the
   tabs: the last of ours stops just above them. With no Aski, the trophy
   closes up to the group.
2. **The trophy is ours in the rail.** T3 folds a second header tool on the
   Duo's rail into one "…" menu (it cannot overflow), so a header action
   would vanish there. On Usage the trophy stands after the group and Aski
   after the trophy, drawn in the same layer as Aski. Off the rail it is a
   plain button in Usage's header (iPhone, Android, the Duo upright).
3. **The trophy opens Settings › Collection** by pushing it, so back returns
   to Usage. Same read, same rules, same words as the Mac's.
4. **On a screen 720 pt wide or more the feats are a board** (`FeatsBoard`):
   beside, the summary, the climb through the ranks, next up and the
   secrets; across, every ladder as a track whose rungs are stops, evenly
   apart, the stretch between two read by tens (`trackOf`), each stop's
   mark under it ("1k", "30 min"). The rung being climbed is ringed, an
   earned one filled in its rarity's hue, so the hues still mean rarity
   alone. A ladder opens on its rungs side by side. Narrower, the list as
   before. The wardrobe keeps a phone's width, centred.

## Steps

- [x] Rail store, placement (pure, tested), the header seam
- [x] Aski follows the group; glides between screens
- [x] The trophy: in the rail on Usage, a header button elsewhere
- [x] `trackOf`, `rungMark` (shared), tests
- [x] The board; the screen picks it by width
- [x] Seam rows
- [x] Seen on an iPhone Duo simulator, folded and open: the trophy one
      pitch under Usage's filter, none on Chats, the board, a ladder open
- [ ] Seen on the person's Duo, with Aski in the rail

## Review

- In the simulator (a lab server, made-up feats): folded, Usage's filter
  at 198 pt and the trophy at 258; open, 156 and 219. The trophy opens the
  Collection and back returns to Usage. The lab had no Aski chat, so
  Aski's own place after the trophy is covered by the placement tests only.

- The rail's measures (156 pt, 63 pt a button, tabs at 0.649) are the ones
  measured on the Duo before; the group's count is now real. A Live
  Activity pushes UIKit's group down and ours don't follow it; nothing
  reports that offset yet.
- Upright, the Duo has no rail, and T3 groups Usage's filter and trophy into
  one "…" menu there.
