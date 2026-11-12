# The home's lists rest under one inset

The person's report (2026-11-12), a phone recording: pull a stage's list down past its top and
let go, and it settles about a header's height lower than it should, with Aski and the tabs
stuck lower. Switch to another stage and the header jumps back up. Switch back and the list
slides down again. The list also pulls down that far with no resistance.

## Cause

Upstream's Legend List upgrade (#28125, taken in by the sync of 2026-11-10) moved T3's home
list from UIKit's `automatic` top inset to one it sets by hand (`never` + `contentInset.top`).
Our scroll-view substitute still forced `automatic` on every stage's list, as T3's list used to
have it. So T3's lists carried the inset twice. A switch scrolled a list to the rest the header
reads (one inset), but UIKit bounced back to its own (two), 116 pt lower in the recording, which
is the whole header.

## Plan

- [x] Every stage's scroll view gets one inset, set by hand in the marker's substitute, as T3's
      list sets its own: `never`, and `contentInset.top` = the page's inset
- [x] The pages rest on T3's own number (`useContentTopInset`), so the header, T3's list and our
      pages read one value
- [x] The page's foot adds the bottom safe area itself, now that UIKit adds none
- [x] Typecheck, the phone's stemcells suite, drift

## Review

Typecheck and the phone's stemcells suite (392 tests) pass. No simulator runtime is installed
on this Mac, so the check is the phone: pull a list past its top and let go, then switch stages
during and after the bounce.
