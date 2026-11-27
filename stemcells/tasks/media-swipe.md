# Swipe through a chat's media, on the phone and the Mac

The person, in the full-screen viewer opened from a chat: with the picture
fully zoomed out, a swipe left or right goes to the chat's previous or next
media, on the phone and on the Mac (a two-finger trackpad swipe).

## Where it stood

- **Mac and web.** Our viewer (`media-viewer.md`) already steps through the
  chat's reel with ← →, a two-finger swipe that follows the fingers, and no
  wrap; a zoomed picture pans instead. Its reel left out the pictures a Cell
  viewed (a Read of an image, drawn under its tool group), so a viewed
  picture opened among its group's alone and a swipe skipped them all.
- **Phone.** T3's native viewer already pages, Photos-style, but through
  the tapped message's own pictures (`MessageImageGalleryScope` in
  `ThreadFeed.tsx`); a viewed picture opened alone. It downloaded every
  page's original as it opened, and a pan at a zoomed picture's edge could
  reach the pager.

## Decisions

- **One order on both.** Feed order; per message its attached pictures, then
  what its text embeds; per tool call the picture it viewed; each once, at
  its first place. Folded turns count: a settled turn folds its tool rows,
  pictures and all, and those are most of a finished chat's screenshots.
- **The phone reads the feed at the tap.** The `ThreadDetailScreen`
  substitute has the whole feed; a context hands a stable reader to a
  substitute of `useFilePreviewGallery`, so streaming re-renders nothing. The
  feed's rows are virtualised, so the list can't come from mounted rows.
- **Bounded on the phone.** 25 pages either side of the tap (each resolves a
  URL as the viewer opens), and the viewer downloads an original only once
  its page is beside the current one (a Swift seam).
- **Zoomed pans, never pages** (a Swift seam): the pager stops while the
  current page is zoomed; ← → still step, as on the Mac.
- **Videos stay out of the phone's pages.** The native viewer draws pictures
  only; a video opens alone in T3's player, as before. The Mac's reel keeps
  its videos.
- **No buttons on the Mac.** The viewer's chrome is one caption by design
  (`media-viewer.md`); ← → and the swipe are the ways through.

## Plan

- [x] Web: viewed pictures in the reel (`upstream/media.ts`), contract test.
- [x] Phone: `chat/pictures.ts`, `chat/ChatGallery.tsx`, the substitute,
      `MessageImages` tiles named as the viewer's pages (a paged-to
      picture closes into its tile), contract test from `buildThreadFeed`.
- [x] Swift seam: lazy originals, zoom holds the pager.
- [x] Seams, typecheck, lint, suites, drift.
- [x] Headless web capture of a two-finger swipe across a chat.

## Review

Both new tests fail with the old behaviour (the web reel without viewed
pictures; the phone hook falling back to the message's list) and pass now.
The Swift file typechecks against the iOS SDK; the phone's change hasn't
been seen on a device or a simulator.
