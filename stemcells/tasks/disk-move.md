# Disk: move what a Mac rebuilds to a drive with room

The startup disk keeps running out while an external drive sits half empty.
The largest thing a Stemcells Mac grows on its own is Xcode's simulators
(20 GB here, a few GB more each time a Cell makes one for a check), and every
Cell that needs room has had to ask. Settings › Disk already finds them; it can
only offer to delete them.

## What a person wants

"Keep this on that drive": once, for good, and every simulator made later goes
there too. A way back. And when the drive is unplugged, to be told why the
simulators are gone instead of finding them hung.

## Choices

| Option                                            | For                                                                                                | Against                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A custom device set (`simctl --set`) on the drive | No link                                                                                            | Every `xcrun simctl` in upstream's device stack and in Xcode would need the flag; Xcode can't use one |
| **The folder moves, a link takes its place**      | Xcode, `simctl`, agent-device and every Cell follow it unchanged; new simulators land on the drive | Unplugged, the link points nowhere; macOS asks once before a tool may read an external drive          |
| The cleanup Cell moves it                         | No new service                                                                                     | A shell session per move: no guarantees, nothing to undo with                                         |

A move is a service, not a Cell: copy beside, check, switch, then delete, and a
switch that doesn't check out is undone before the old copy goes.

## Safe by construction

- Only what the Disk page found and the rules call movable: simulators and
  Xcode build data. A client names a finding kind and a drive id, never a path.
- Never while in use: a booted simulator, or Xcode or `xcodebuild` running.
  Checked before the copy and again at the switch.
- The copy is checked (file count and apparent bytes) before anything is
  switched, and the original is deleted only after the moved folder answers:
  for simulators, after the simulator service restarts and lists the same
  devices. macOS's first-time permission prompt shows up as a wait the page
  names; a switch that never answers is undone.
- One move at a time. Every move is recorded by drive UUID, so a different
  drive with the same name inherits nothing, and every move has Move back.
- Only APFS or Mac OS Extended drives with room for it and 5% more.

## Plan

- [ ] Server: movers, the move service (copy, check, switch, undo), routes
      under `/api/stemcells/disk/moves`, tests.
- [ ] Web: Settings › Disk offers Move to <drive> on a movable finding, shows
      progress, and lists what's on other drives with Move back.
- [ ] Phone: the same, from the Mac's own HTTP.
- [ ] Translations.
- [ ] Real run: this Mac's simulators to its external drive and back.

## Review
