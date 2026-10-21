# A short swipe stops where the fingers lift

A swipe too short to turn the tab rode 40–225 px of the system's coast
(momentum) before it sprang home: DOM wheel events carry no phases, so the
coast is recognised only after a run of its events. The fix reads the real
phases in the desktop app.

## Why not without phases

- The coast's first event looks the same as a finger event in the DOM:
  same way, same speed, cancelable, pixel mode. This was measured in the lab.
- Telling a coast by its decay needs at least two of its events. The strip
  then follows at least one coast event first, which is about the lift
  speed times one frame (44 px for the short lab swipe). Reading a decay
  that early also mistakes fingers slowing down for a lift, which eats
  real swipes.

## Plan

- [x] Native: an `NSEvent` local monitor in a tiny N-API addon. It
      forwards each phased scroll event (time, phase, momentum phase,
      window) to the main process. The source lives in
      `stemcells/native/`, and `stemcells/scripts/build-scroll-phases`
      builds it on macOS into `apps/desktop/resources/`.
- [x] Desktop: one main-process module sends the events to the window's
      page, and one preload module exposes them to the page. These are
      side-effect imports, listed in `seams.md`.
- [x] Web: a `PhasedContact` (a `ContactSource`) releases at the fingers'
      lift and ignores the coast. With no phases (a browser, or no addon)
      it falls back to `WheelContact`.
- [x] Tests: replay the phases with the wheel samples (single, alternating,
      flick, slow, short, a coast then a new swipe), with phases arriving
      before or after the DOM events.
- [x] Lab: run the matrix plus the short-swipe runs with the window off
      every screen. Take a position plot. Check the frames.
- [x] Build: `install-app` builds the addon. Add a CI job on macOS that
      compiles and loads it.

## Review

The lab drove pid-targeted phased trackpad streams into the built web app.
The lab window sat off every screen. Each run happened twice: once with
wheel events alone (main) and once with the phases. Both runs used the
same build.

- Short swipes, too short to turn (17 runs, 34 swipes). The coast ridden
  past the fingers' last move was 0–289 px on main (median 78). With the
  phases it was 0 px in every swipe, with the page quiet, the page busy
  120 ms, or the browser's UI thread held.
- The matrix (18 runs), held-UI runs (30), and fast alternation (19
  valid) gave 0 wrong turns and 0 px past the target, both ways.
- Frames on the 120 Hz screen were unchanged: drag p95 about 9 ms,
  release p95 about 9.2 ms.
- The phases reach the page before the coast's wheel events in every
  measured case: quiet, page busy, or UI thread held. Replays still pass
  with the phases up to 5 ms behind. At 10 ms or more behind, the strip
  follows the coast again, and from 20 ms it can lose a swipe. The lab
  never showed that much lag.
- A packaged build (artifact build, `dir` target) carries the addon inside
  `app.asar`, and the app's own Electron loads it from there.
