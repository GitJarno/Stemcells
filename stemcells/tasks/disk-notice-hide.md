# A disk notice swiped away stays hidden until the disk has news

The phone's home shows a machine's disk once it wants attention: a card under the tabs,
"8 GB left" or "The disk is full", with Free space and a cog. The person can now swipe it
left to hide it.

## The rule

- Hidden until there's news, never on a timer. It shows again when free space falls below
  half of what it was when hidden (8 GB, then under 4 GB, then under 2 GB), or when the disk
  becomes full (under 2 GB) and it was hidden above that.
- A new episode: once the disk is calm again (free at or above its warn threshold), the hide
  is forgotten, so the next time it runs low the notice shows.
- A full notice can be hidden too, and returns by the same rules.
- A hide that news has spent is gone: the notice stays until it's hidden again, so it never
  flickers as free space wobbles around half.
- Per machine, on every device: the machine's own server keeps the hide.

Why no timer: a notice back after a day says nothing new, and teaches that it can be swiped
away again unread. Halving is news at any size: 8 GB to 4 GB means the cleanup didn't happen
and the disk is filling; full means Cells are about to stop. And a disk that was cleaned and
filled again is a new problem, so it gets a new notice.

## How it works

- The rule is one pure module the server and both apps read (`stemcells/disk/notice.ts`):
  `noticeShown` and `hideKept`, with the warn and full thresholds that were the web's.
- The server keeps the free space the notice was hidden at in
  `<state>/stemcells/disk-notice.json`, beside the warn threshold's file, and carries it in
  the host-resources snapshot (`diskHiddenAtBytes`) and on `GET /api/stemcells/disk` and
  `.../volume` (`hiddenAt`). Each reading of the disk forgets a spent hide, so the Mac's foot
  (every minute) and the phone's home (every 30 s) see a calm disk end the episode.
- `POST /api/stemcells/disk/notice` `{ hiddenAt }` hides it at that much free; `null` shows it
  again. The phone posts the figure it showed, as the cog posts its threshold.
- Phone: the card swipes as a Cell's card does (T3's `ThreadSwipeable`, one action, a full
  swipe hides); a light haptic, then the card slides out and its room closes up under the
  tabs, which stand still above it. The home's undo line says "Disk notice hidden" with Undo,
  for its usual five seconds; Undo shows it again on the server.
- Settings › Disk on the phone and on the Mac always show the disk, and while the notice is
  hidden, a row to show it again. The Mac's foot keeps its colour: it is the disk's gauge,
  not the notice.

## Plan

- [x] The rule and its table (`stemcells/disk/notice.ts`, `notice.test.ts`)
- [x] Server: the hide's file, forgotten when spent; the snapshot's field through the
      existing `HostResources` seam; the route, with its access and body tested
- [x] Phone: the swipe, the haptic, the undo line's act already done, the Disk page's row
- [x] Mac: Settings › Disk's row to show it again
- [x] seams.md, typecheck, lint, the tests beside the change, the phone's tests, drift

## Review

The rule's table, the server's storage and calm-forget, the snapshot's field, the route
(401, 403, 400, hide, show) and the undo line's new act pass; server, web, phone and
contracts typecheck; lint and drift pass, with no hot file touched (one line in the contract,
one in the web's `tsconfig.json`; `HostResources` changed its seam line in place). Only a
phone can show the swipe, the haptic, the card leaving with the tabs and Aski still, and the
list under it closing up.
