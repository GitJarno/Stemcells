# The phone meets its Cells

The phone still shows T3's thread list and composer. This brings the
Stemcells layer to it, from the original app's phone and the Mac: each Cell's
creature, the ledge over its composer, a home where Aski greets you and the
Cells stand in cards, the pen that opens Aski, and the attachment card.

Research (2026-10-25): the original app's phone (`Companion/Phone`), the web's
creature, Aski and composer line, and the phone's own list, header and
composer. What it settled:

- **The creature ports, the canvas doesn't.** Everything from a thread id
  to a frame of role letters is plain TypeScript (`apps/web/src/stemcells/
  cell`); only `paint.ts` rasters to a canvas, and `art.ts` loads art
  through Vite's glob, which Metro bundles as nothing. The phone imports
  the web's modules (no package, no lockfile change), and draws a frame as
  one SVG path per colour.
- **"The bar" is the composer's.** On the Mac the Cell stands on the
  ledge over its composer with its name and what the chat is about
  (`CellComposerLine.tsx`); the original app's critter stands on its composer's
  roof, its one-liner on the shelf. The phone's header already says the
  title, so the header says the Cell's name and the ledge what it's about.
- **The one-liner is the title** (`composer/oneLiner.ts`): T3 writes it;
  no endpoint.
- **The home keeps T3's list.** A whole-view substitute would freeze its
  swipes, menus, shelves, search and pending tasks (memory: reuse
  upstream's fundamentals). Ours: the list's data (a tab filters the
  threads it's given), its header slot (`ThreadListFilters`, quiet), its
  row tokens (`thread-list-v2-row-appearance`, quiet: cards), and one
  seam in the row for the creature.
- **Tabs.** the original app had Asleep · Awake · Working · Decide (replaced
  there on 2026-10-18 by pages). Ours, as asked: Asleep (settled or
  snoozed) · Active (the rest) · Working (T3's row says Working) · Input
  (an approval or a question waits). A Cell is in a tab when its face says
  so, so the "?" and the Input tab agree. Android and searching keep T3's
  home: Android's list has no header to hold the tabs.
- **Cost.** Composing a Cell's scene takes about 7.5 ms with V8's
  interpreter alone (Hermes is the same order), so figures compose in 8 ms
  slices off the first frame (`compose.ts`), and only a working or cheering
  Cell plays its scene; the rest hold still and blink.

## Plan

### 1. Creatures and the ledge (first pull request)

- [x] `art.ts` reads its files through static imports, so Metro has them; a test fails on a file left out
- [x] The phone's figure: a frame as SVG paths per colour, blinking on a shared clock; a working Cell plays its scene
- [x] A Cell's mood from the phone's thread shell (the web's `moodAt`, T3's statuses)
- [x] The ledge: a substitute wraps `ThreadComposer`; the Cell stands on it with what the chat is about; the feed keeps clear of it
- [x] The header says the Cell's name (a substitute wraps `ThreadHeader`)
- [x] Contract tests for the statuses and the height we read; Metro bundles it for iOS, Hermes compiles it
- [x] The web's creature modules call nothing Hermes lacks (`toSorted`, `toReversed` were two); a phone test reads them

### 2. Home

- [x] Aski over the list with a line from its own bank that rolls on a tap (`greeting.test.ts` holds the lines to the persona); Aski drawn from the web's canon as SVG, blinking with the Mac's rhythm; a tap on Aski opens its chat
- [x] Tabs with counts (Asleep · Active · Working · Input), T3's segmented control; the list shows the tab's Cells; an empty tab keeps the header; opens on Input when anything waits
- [x] Cards: T3's row tokens (a substitute); the creature and its name on the left (a seam in the row: an import and two lines)
- [x] Asleep: the night over Aski, stars, the moon at today's phase, a shooting star now and then; the tab's shelves open
- [x] Aski's chat is the one the Mac and the server pick (`aski/chat.ts`), not every chat on its instance (fixes slice 1's header and ledge)

### 3. Aski on the pen

- [ ] The pen opens Aski's chat when the environment has one, else T3's new chat
- [ ] Cells Aski starts form on the home: blocks, then the hop

### 4. The attachment card

- [ ] Add to Chat: recent photos in a grid, camera first, picks numbered, Add N; Files from the same card
- [ ] T3's own picking, sizing and upload stay: the card hands its picks to T3's picker
