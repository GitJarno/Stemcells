# A laptop's battery on the phone's home

The person, 2026-11-04: on the phone's home I want to see my laptop's battery, in colour, however
many laptops and phones I have. What's the elegant way?

## Decisions

1. **Only the batteries Cells run on.** The question is whether the Cells keep flying. A machine
   without a battery shows nothing. A phone shows nothing: its own is in its status bar, another's
   can be read only while Stemcells is open on it, and its dying stops no Cell.
2. **It says laptop, not battery.** On a phone a battery icon means the phone's own, and that icon
   stands at the screen's top right. So: a small laptop beside the app's name, its screen the
   charge, its number beside it. No new bar item.
3. **A glance, a tap, one word.** The mark is always there. A tap opens the Machines menu, each
   row with its charge. At 10 % or less, on battery with Cells flying, Aski says so and the machine
   pushes once a discharge if nobody is at it.
4. **Each machine says for itself.** The charge rides `server.getHostResources`, which every
   environment answers and the phone already reads every 30 s for the disk: no new route, poll or
   store, and nothing to keep in step between phones.
5. **Colour is the level; shape and number say it too.** Green, through yellow, amber at 20 %, red
   at 10 %. A bolt while charging, a plug when plugged in and not charging.
6. **Out of reach, the lid shuts.** The number dims and the menu says when it was last heard. Never
   a live colour on an old reading. "Went quiet", never "died": the phone can't know. The reading
   lasts the app's run; a brief reconnect, or a return to the front, doesn't shut the lid, and a
   socket still "connected" long after its machine last answered does.
7. **Motion on events only.** The fill rises once a run and pulses on plugging in and on crossing
   low. No loop. None under Reduce Motion.
8. **iOS first.** The mark stands on the title only where iOS's workspace draws it; Android's header
   stays as it is. A Mac's own views can read the same field later.

## Plan

- [x] Parse `pmset` and sysfs (`server/stemcells/power/battery.ts`), with a table of real outputs
- [x] `battery` on `HostResourcesSnapshot`, contract test, seam rows
- [x] One push a discharge (`push/Push.ts`), read only while it could matter
- [x] Words in one copy (`stemcells/words/battery.ts`)
- [x] Phone: readings, kept for the run (`battery/`), the mark, the menu's rows, Aski's line
- [x] The phone's bundle builds with Metro; a real `HostResources` read on a Mac carries `battery`
- [x] Pull request, `check-local`, merge
- [ ] Seen on a phone. This Mac has no simulator runtime, so the first look is the next phone
      build, once the Mac's app has the server side.
