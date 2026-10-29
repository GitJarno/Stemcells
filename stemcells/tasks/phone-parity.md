# The phone and the Mac, one experience

The person's ask (2026-10-28): on the phone a Cell says "Provider turn
failed." when the Mac's disk is full, and nothing on the phone says the disk
is full; the phone's look is behind the Mac's (contrast, grays, chat
colours, spacing). Align them, each shaped for its form factor.

## What parity means

The same facts, said in the same words, from the same code; the layout is
each device's own. The Mac is a workbench: columns, tabs, hover, a foot
that always shows the disk. The phone is a remote control carried all day:
one thumb, a glance, and only what needs the person.

- Words and rules a person reads come from one module both apps import
  (`stemcells/words/`, or the web's pure TypeScript through a phone `kit.ts`).
- Something always on screen on the Mac shows on the phone only when it
  wants attention.

## Drift found (2026-10-28)

Behaviour, phone-relevant, not on the phone:

| Drift                                                | Mac                                         | Phone                    | Here            |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------ | --------------- |
| A Cell the full disk stopped                         | "The disk is full" with Free space (#339)   | "Provider turn failed."  | this PR         |
| The disk wanting attention                           | The column's foot: grey, amber, red         | Settings › Disk only     | this PR         |
| Look: palette, hairlines, ink, stage colours, rhythm | `stemcells/brand/look.ts`                   | stock T3 dark            | `phone-look.md` |
| Plan limits: board and ring                          | `limits/PlanBoard.tsx`, `rail/PlanRing.tsx` | upstream's usage section | next            |
| Switching a Cell's Claude account, `/login` (#341)   | `login/`                                    | no                       | next            |
| A limit's "Continued after…" row                     | `limitResume/row.ts`                        | the raw message          | next            |
| A Cell's mail as a quiet note (#340)                 | `peers/`                                    | no                       | later           |
| Settings › Aski's answer counts                      | `needs/answers/`                            | no                       | later           |

Duplicated logic, which drifts on its own: the line's stage names
(`line/line.ts` `SEGMENTS` against `rail/Cells.tsx`); the Cell's mood
(`cell/mood.ts` against `tabs/cellMood.ts`); Aski's chat (`aski/chat.ts`
against `askiChatAmong`). Each wants one copy both import.

Mac-only by nature: tabs, panes, windows, the slate, hover states, the
updater banner.

## Decisions

- A Cell stopped while its machine has under 2 GB free is the disk's, on
  both, by the one rule the Mac already uses (`disk/pressure.ts`
  `diskFailure`): its chat row, its home card's line and its ask card all
  say "The disk is full", and "The disk was full" once there's room. A
  retry isn't recommended while the disk is full, and is once there's room.
- The ask card's words change on the Mac too: its column card said "Its
  provider returned an error" for the same Cell.
- The phone's home shows a machine's disk only under 20 GB (amber), then
  10 GB (red), with Free space beside it, under the line's stages. Free
  space from the home or a chat opens the cleanup Cell over them; from
  Settings it still takes Settings' place.
- One reader per machine: any number of rows and cards read a machine's
  free space with one request every 30 s, not one each.

## Plan

- [x] `cardOf` takes the disk's reading; the Mac's ask card and the
      phone's pass it (`needs/card.ts`, `NeedCard.tsx`, `line/Ask.tsx`).
- [x] The phone's chat row (`disk/DiskFullRow.tsx`, a seam in
      `thread-work-log.tsx`) and home card line (`disk/FailureWords.tsx`,
      a seam in `thread-list-v2-items.tsx`).
- [x] The home's disk plate (`disk/DiskPlate.tsx`, in `LineHome`).
- [x] `useMachineDisk` shares one reader per machine, on both.
- [x] Seams listed; typecheck, lint, tests, drift.
- [x] check-local; merge.

## Review

Done in code; not yet seen on a phone (the device pass waits on the
person's go-ahead, with the look's pull request). An independent review
found Aski's composer still read a disk-full card as Retry-recommended:
"as recommended" would have retried a Cell the card said not to. The
composer now reads the card's last disk reading (`lastDiskFailure`). Also
from it: only a full disk's row builds what opening a Cell takes. Left as
they are: "was full" is remembered per surface and until the app restarts,
as on the Mac; on an iPad, Free space opens the Cell over the split view
rather than in its detail pane.
