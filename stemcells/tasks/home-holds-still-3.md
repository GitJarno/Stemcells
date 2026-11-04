# The phone's home holds still, for good

The person, 2026-11-04: the home's elements are still hectic, jumping up and down with what's going
on. It shouldn't. Earlier fixes (`phone-home-still.md`, `home-holds-still-2.md`,
`home-header-follows-list.md`) each fixed a way the header moved on a switch or a mount. These are
what's left, and they share a cause: what a machine says changes the layout.

## The rule

Above the list nothing changes height. Inside a list, a row moves only when a Cell joins or leaves
that stage. What comes and goes takes room reserved for it, or floats over the list.

## Causes, all from the code

1. **Aski's line wraps.** "The Cells have it." is one line and "Two Cells flying. Your hands are
   free." two. The line changes with the counts, a roll and the battery, and each change between
   one line and two moved the tabs and every card by 28 pt.
2. **The disk's card stood in the flow,** under the tabs. It comes when its machine first answers,
   after the first frame, and goes with a swipe, moving every card by its height.
3. **The header had no height until measured.** A list's first frame stood its rows under Aski,
   and the next dropped them to their place.
4. **Flying parted into two.** T3's list sorts what it calls working from the rest, and Flying goes
   by the machine's word, so a Cell between two turns hopped over the others and back.

## Decisions

- The line takes two lines' room always, at the person's text size, a shorter line centred in it.
- The disk's card floats over the list's foot, where T3's notice stands, and the list scrolls past
  it. A notice taking the same place stands over it for its seconds.
- The header starts at the height its parts add up to.
- On Flying, T3's list keeps its one order: newest first, a status moving nothing. Landed keeps
  newest landing first: its rows move only when one lands.

## Left as they are

- A Cell joining or leaving a stage still moves the rows under it, at once: that is the list's news.
- The first reading at a cold start can move a Cell to another stage, when its record and its
  machine disagree.
- An ask opening or closing on Input: the person's own tap.

## Plan

- [x] The line's room, the header's first height
- [x] The disk's card over the foot, with room for the list's last row
- [x] `useThreadListV2` substitute, contract test for the order it relies on
- [x] `seams.md`, tests, typecheck, lint, drift
- [x] Pull request, `check-local`, merge
- [ ] Seen on a phone. This Mac has no simulator runtime; the next phone build is the first look.
