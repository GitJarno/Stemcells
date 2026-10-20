# Media viewer: fly in, step through, fly home

A picture or video clicked in a chat grows out of its own thumbnail into
full view. ← and → (or a two-finger swipe) step through every picture and
video in the chat, in reading order. Esc, a click beside the picture, or
Space on a picture sends it back into the thumbnail of whatever is showing.

## What upstream does (and why we replace the chat's viewer)

- `ExpandedImageDialog` is a centred Base UI dialog: a close button, ‹ ›
  buttons, a caption `name (2/5)`, and `ZoomableImage`.
- Its list is the clicked message's own pictures (`buildExpandedImagePreview`)
  or one markdown block's (`markdownImageGallery`): never the whole chat.
  The arrows wrap from the last item to the first.
- It opens and closes with a fade and scale in the middle of the window:
  nothing says where the picture came from or went back to.
- `ZoomableImage` zooms by resizing the image inside a scroller. A plain
  two-finger scroll zooms it too, which would steal the swipe between items,
  and its geometry is its own. So the viewer keeps upstream's ways in (every
  thumbnail already calls `onImageExpand`) and its pieces (`MediaVideoPlayer`,
  `MediaActions`, asset URLs), and draws the stage itself.

## Decisions

- **The whole window, not the pane.** Panes sit side by side, so a pane is
  often a third of the window; a screenshot's text wants every pixel (the
  Swift app went from a 720-wide popover to the whole screen for this). The
  viewer is brief, so covering the other chats costs nothing, and its own
  chat dimming behind it shows where the picture came from. Covering the
  window also settles the swipe: the tab pager listens on its own viewport,
  and the viewer's portal is outside it, so the pager never sees a swipe made
  over the viewer.
- **The reel is the chat's, built from the timeline ChatView already drew**
  (`displayedTimeline.entries`), not from the DOM: the timeline is virtualised,
  so most thumbnails aren't mounted. Per message: its pictures, its videos,
  then the media its text embeds (image syntax, `<img>`, `<video>`); each once,
  at its first place. Proposed plans count as text. Anything opened from
  elsewhere (the composer, a tool's output) keeps upstream's list for that row.
- **Fly in (FLIP on the compositor).** The figure is laid out at its resting
  rect and starts transformed onto the thumbnail's drawn pixels, clipped to the
  thumbnail's visible crop and corner (`object-fit` respected), then springs
  home on `lift` while the lights go down on the same spring. The thumbnail's
  slot empties while its picture is up.
- **Fly home** to the thumbnail of the item now showing, looked up at close
  time, on `land`. If that thumbnail isn't at least half in view (scrolled
  away, unmounted, another tab), the picture fades and shrinks to 0.94 in
  place instead of flying somewhere wrong.
- **Geometry from the Swift app** (`LightboxGeometry.swift`): margins 56 at
  the sides, 40 + the title bar on top, 72 at the foot; aspect-fit, never past
  the image's own pixel width; corner `min(card, shorter side / 8)`.
- **Steps**: the old picture slides `step-travel` the way you went while it
  leaves; the new one comes from the other side on `settle`. No wrap: at
  either end the picture leans `lean-travel` toward the missing item and
  springs back. Neighbours are resolved and decoded ahead.
- **Keys**: ← → step (also when zoomed, which resets the zoom, and on a
  video, which never seeks). Esc closes. Space plays or pauses a video and
  closes a picture (Quick Look). + − 0 and Enter zoom. Other plain keys stop
  at the viewer so they never type into the chat behind it, and the held-key
  repeats of Esc, Space and the arrows are swallowed for a moment after it
  closes so they can't stop a Cell.
- **Zoom**: double-click toggles to `max(2×, 1:1 pixels)` at the pointer;
  pinch zooms about the pointer up to `max(4×, 2× pixels)`; a pinch released
  well below rest closes. Drag or two-finger scroll pans while zoomed, with
  rubber-banding, and clamps on release.
- **Chrome**: one quiet caption under the picture: the file name and
  `3 / 7`. No buttons. It hides while zoomed or swiping.
- **Reduced motion**: no flight, slide or lean; opening and closing fade in
  place, steps crossfade, zoom is instant.
- **Accessibility**: Base UI's modal dialog (focus trap, nested menus such
  as the media context menu still work), a title and description, a live
  line for the position, a close button for keyboard and screen readers that
  shows only when focused, and focus back on the thumbnail it landed on (else
  the opener).

## Seams

- `ChatView.tsx`: renders `ChatMediaViewerHost` where it rendered
  `ExpandedImageDialogHost`, with the displayed timeline and its cwd.
- `ExpandedImageDialog.tsx`: exports `expandedImagePreviewAtom`, so our host
  reads what upstream's `openExpandedImagePreview` opens.

## Plan

- [x] Tokens: `lift`, `land`, `nudge` springs.
- [x] Adapter `stemcells/upstream/media.ts` + contract tests.
- [x] `media/reel.ts` (+ tests): the chat's reel, item identity, the clicked
      item's place.
- [x] `media/geometry.ts` (+ tests): room, fit, corner, drawn rect, flight
      pose, zoom, clamp, rubber, swipe turn.
- [x] `media/keys.ts` (+ tests).
- [x] `media/MediaViewer.tsx`, `media/viewer.ts`, `media/stage.ts`,
      `media/thumbnails.ts`, `media/media-viewer.css`.
- [x] `media/ChatMediaViewerHost.tsx` and the two seams; `seams.md`.
- [x] Lint, typecheck, tests, drift.
- [x] Headless proof in a real chat: mid-flight frames in and out, arrows, a
      close landing on a navigated item's thumbnail, Esc.

## Review

- Proved headless in the dev server on a real chat: two attached pictures and
  an attached video, and a Cell's reply embedding two pictures and a video
  (a reel of 6). A click on a picture, on the video's play button and on the
  Cell's picture each lift out of their thumbnail; ← → and a two-finger swipe
  step (the tab pager didn't move); the end leans; Space plays and pauses the
  video; double-click zooms and a drag pans; stepping to the second picture
  and pressing Esc lands it in the second picture's thumbnail, with focus on
  that thumbnail; closing on a picture scrolled out of view fades in place;
  a click beside the picture closes; Esc never reached the chat's listeners;
  reduced motion fades.
- The chat is often open twice (its tab and Aski's): one viewer opens, in the
  pane the click came from, or, with no thumbnail pressed, the focused pane.
- Attached pictures are named by their stored file, so a re-signed URL keeps
  the item in place; once the chat's reel holds the click, the viewer stays
  on it as the chat streams.
- Open: tool output pictures (inside a work item's inspector) open with their own
  list, not the chat's reel. Drag-to-dismiss and the Swift app's ⌘C copy are
  not ported; the media's context menu (upstream's `MediaActions`) copies.

## Review fixes (PR #32, 2026-10-21)

Each with a test naming the bug it prevents.

- [x] A close cut short by a late measure: nothing reaches the stage while
      the picture lands home.
- [x] The reel anchored on the item showing now, not the click; attachments
      named by message and place, so a re-signed URL or the swap from the
      sending picture to the stored one changes nothing on screen.
- [x] Swipe and pinch timers cleared on close; their releases do nothing
      after it.
- [x] The viewer hears keys first: the workspace's listener hands them over
      and stands down; upstream's root shortcuts stand down for keys inside
      the viewer (`data-keybinding-capture`).
- [x] Fly-home and focus: the first thumbnail in view in the timeline's rows;
      none in view fades, and focus goes back to the opener only if it is
      still drawn.
- [x] Streaming replies aren't parsed per token: markdown read per message
      id, once settled.
- [x] Lint, typecheck, tests, drift; headless re-proof.

Proved headless after the fixes, in the same chat: with the viewer up, ⌘T,
⌘D, ⌘⇧D, ⌘B, ⌘⇧T, ⌘K and ⌘N changed nothing behind it (without it, ⌘B
folded the sidebar and ⌘T opened a tab); → stepped and Esc landed in the
second picture's thumbnail with focus on it; at the reel's end, with the
only copies below the fold and on the other tab's page, the picture faded
and focus went back to the picture that opened it. Each test was checked to
fail with its fix taken out.

## Follow-up: stale URLs, pinned seams (2026-10-21)

- [x] The picture on stage keeps its first URL for drawing only. Copy and
      save act on the item's stored file, minted fresh when acting, or on
      the URL it shows now. A video gets the latest URL, retries from the
      stored file, and picks up where it was when its URL failed.
- [x] Contract tests pin `data-keybinding-capture` (upstream's root
      shortcuts) and `[data-timeline-row-id]` (the timeline's rows).
- [x] A test for the viewer's re-anchoring.

Each test was checked to fail with its fix taken out. Headless in the same
chat: a picture draws, the attached video plays and Space pauses it, Esc
lands it with focus on its play button, no failed requests.
