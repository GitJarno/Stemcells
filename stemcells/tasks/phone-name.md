# The phone says Stemcells

The phone still called itself T3 Code: on the home screen, in Settings, in
its widgets and permission prompts. Only the words change; bundle ids, URL
schemes and storage keys stay, or installs and pairing break.

- [x] Write the name once, `stemcells/brand/name.ts`; the web's and the phone's `brand/name.ts` read it
- [x] The build config through `withStemcellsName`: channel names, widget descriptions, permission prompts
- [x] Each phone screen that wrote "T3 Code" says `APP_NAME` (15 files, one line or two each)
- [x] `appName.contract.test.ts` on the phone: config strings, screen text, ids unchanged
- [x] Upstream's tests that pinned the old name; seams.md

## Review

Done. The contract fails when the config seam is reverted (3 channels) and
when a screen says "T3 Code" again. The whole phone suite passes except the
two Swift-compiling script tests, which fail on main with the local
toolchain.

Kept: T3's theme name (as on the web) and the Android editor's clipboard
label, which a person doesn't see. Not in this change: the messages the
shared packages and the server write with "T3 Code" in them, which both
apps show.
