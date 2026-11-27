# Sleep and Wake, in motion

When a Cell goes to sleep or wakes, the person should see where it went and
where it came back, and the list should never jump. Today on the phone a
slept row just leaves. The Mac already hops a Cell into the other stage's
count (`apps/web/src/stemcells/rail/Hops.tsx`).

## Decisions

1. **The Cell travels, not the row.** On Sleep, the Cell closes its eyes,
   its row's light fades, and the Cell itself lifts out of the row and flies
   on a low bow to the Asleep segment of the stage pill, shrinking as it
   goes. Wake mirrors it: eyes open, it flies to Awake. It is the same flight
   Aski's copies take (`home/CopyLayer.tsx`), on a layer over the window that
   no touch meets, there only while one flies.
2. **The list closes, it doesn't jump.** The row left behind folds its height
   away while the rows under it glide up, with no overshoot.
3. **The count takes it.** When the Cell lands, the segment's count ticks
   with one small bump and a light haptic tick.
4. **It shows where it landed.** The next time the person sees the stage it
   went to, its row is in its time slot (`byRecent`) and its light blooms
   once, then rests at its state's level. Nothing scrolls the person to it.
   The Mac does the same bloom when a woken row appears.
5. **One shot, never a loop.** Every motion runs once on the UI thread and
   ends; nothing repaints while still. With Reduce Motion, the Cell doesn't
   fly: the row fades, and the count ticks.

## Plan

- [ ] Phone: eyes, light fade, flight to the segment, fold, count tick, haptic
- [ ] Phone and Mac: the arrival bloom
- [ ] Reduce Motion
- [ ] Gates, pull request, merge, Duo build

## Review
