# The phone answers at once: Cells side by side on the Duo

The person: moving between Cells in the left column of the Duo's inner
screen, the chat has to change at once, back and forth, back and forth.
That is how multitasking feels. Then the same care for the whole phone.

## The bar

A tap on a Cell in the column shows its chat, with its messages, in the
frame after the tap for a Cell seen a moment ago, and within 300 ms for
one never opened. Nothing the person didn't touch draws again. With chats
streaming, the same.

## The lab

The phone app on a simulator with a column beside the chat (the unfolded
Duo's layout; an iPad runs the same code), on Metro's production bundle
(`--no-dev --minify`: the development bundle renders several times slower
and hides what matters), with T3's own probe compiled in
(`EXPO_PUBLIC_T3_BEHAVIOR_PROBE=1`, `features/development/behavior-probe.ts`).
A lab server holds eight chats of eight long Replay turns each. A script
opens a probe window through Metro's inspector, taps a row through
agent-device, and reads the window: when the finger lifted, each commit,
when the chat's rows were on screen, the longest gap between frames on the
JS and UI threads. A second Metro on the development bundle with
`EXPO_PUBLIC_T3_RENDER_COUNTER=1` says which components drew and why.

T3's `mobile:metrics` does the same on its device pool, which this Mac has
no access to; the script is its `switch-*` cases on a local simulator.

## What it measured

Finger up to the chat's rows on screen, median, on a debug native build
under a loaded Mac: the order holds, a release build on the phone is
faster throughout.

|                                             | Before             | After         |
| ------------------------------------------- | ------------------ | ------------- |
| A chat seen a moment ago                    | 380 ms, 24 commits | 190 ms        |
| The same, three chats streaming             |                    | 175 ms        |
| A chat never opened                         | 600 to 900 ms      | 370 to 450 ms |
| Idle redraws of a playing Cell, six seconds | 1524               | 816           |

## What changed

- **A chat just left stays mounted** (`chat/warm.ts`, the
  `ThreadDetailScreen` substitute). T3 mounts a chat again on every
  switch: its feed, its rows' measuring, its landing at the end. The four
  chats last in front stay, each under React's `Activity`, hidden: their
  effects stop, so a chat behind marks nothing read and sounds nothing. A
  chat reading its messages again shows what it had until they are back.
- **It comes back where it was left** (`chat/keepsPlace.ts`). iOS builds
  a hidden scroll view again when it shows, at the offset it last told
  React of, which can be its top.
- **Our layer reads T3's quiet shells** (`upstream/quietShells.ts`). What
  we read of every chat was the live list, new on each streamed word. A
  streamed word now draws nothing of ours.
- **A tap in the column no longer draws every row.** Each row asked
  whether it stood in the column through a context that carries the
  selected chat; the home asks once (`HomeSidebarKnown`).
- **A playing Cell draws the inks that moved.** A beat moves two or three
  of its dozen paths; each was drawn again twelve times a second.

## Decisions

- **Chat to chat in the column is instant, with no animation.** Aski's
  turn is a change of place and has its dance; a row tapped in a list
  that stays on screen is a selection, and a selection answers at once.
  Going back and forth through an 800 ms dance would be the opposite of
  what the column is for. A chat arrived at through Aski's turn mounts
  fresh, so the dance plays exactly as it did.
- **Hidden by `Activity`, not by opacity.** Keeping a hidden chat's
  native views (opacity 0, no `Activity`) measured fastest, 135 ms, but
  its effects would run on: T3 counts a mounted chat as one being read.
- **Upstream's own work is already here.** T3's chat-switch changes came
  with the syncs; its scroll-stutter patch for 120 Hz screens comes with
  the next one and needs a native build.

## What is left for at once

The 190 ms is two parts. About 80 ms is JavaScript before the chat turns:
T3's navigation and header draw first, in a commit of their own. About
110 ms is iOS: Fabric takes a `display: none` subtree's native views
down (`ConcreteViewShadowNode` sets `Hidden`, and mounting skips its
children), so showing a kept chat builds them again. No JavaScript gets
around that. A small native view that keeps its children mounted while
hidden would, and needs a native build of the app; that is the person's
call.

## Plan

- [x] The lab and the baseline
- [x] A chat just left stays mounted: going back shows it in one commit
- [x] It comes back where it was left, and Aski's turn plays as before
- [x] Our layer reads T3's quiet shells: a streamed word redraws nothing of ours
- [x] What a tap redraws in the column
- [x] The same turns with chats streaming
- [ ] One pass on the Duo itself
- [ ] A native view that keeps a hidden chat's views, if the person wants it

## Review

Measured before changing anything, and the measurement overturned the
first plan twice: keeping chats mounted was meant to make a return one
commit, and iOS rebuilding hidden views made it half the win instead; a
chat left mid-scroll came back at its top until the screenshots showed
it. Both were found on the simulator, neither by a test. Not done: the
first commit after a tap (T3's navigation chrome, about 40 ms), and a
pass on the Duo itself, which the simulator stands in for.
