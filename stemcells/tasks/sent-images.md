# A sent message's pictures, one row

Sending several pictures from the phone went through three looks: the
pictures stacked one over the other, then gone, then spinners side by side,
then the pictures. The person wants the last look at once: one row they can
swipe, there from the tap of Send.

## Why it jumped

Upstream's `ThreadFeed.tsx` draws a user message's pictures twice over:

- **Pending**, from the drafts in the outbox: a column of 180 × 140 tiles
  with the phone's own files. Once the upload lands, each draft carries the
  server's id, and its tile swaps to the server's copy: a spinner while its
  address is minted, then blank while it downloads.
- **Sent**, from the server's message: another tree, a row of 96 px
  squares (wrapping) when the text names the pictures, else a full-width
  column, each a spinner and then the server's copy.

Different layouts, different trees, and nothing kept the files the phone
already had.

## Decided

- **One row, one tree.** `stemcells/chat/MessageImages.tsx` draws a user
  message's pictures, pending or sent: a horizontal row of 96 px squares
  (the look the person wants), swiped when it overflows. Each tile is keyed
  by its place in the row, which the server keeps, so the tiles stay
  mounted from pending to sent.
- **This phone's own file until the server's has loaded.** The tile shows
  the draft's file as the image's placeholder and loads the server's copy
  behind it. A picture's file is kept for its sent message by the
  server's id (`sentImages.ts`, the last 64, this session), so the sent
  message shows it too. A pasted picture whose preview is inline data isn't
  kept (megabytes); its sent message loads from the server as before.
- **Every message, not only the phone's sends.** A message without its
  pictures named in the text drew them full width, stacked; it's the same
  row now, and a tap opens the viewer as before.
- **Words.** The tiles read "Open Image 1" to a screen reader, as the rest
  of our layer does (`seams.md`, Attachments read Image 1, Image 2).

## Plan

- [x] `sentImages.ts`: the row's pictures from a message or its drafts, and
      the session's own files; a test for the hand-over.
- [x] `MessageImages.tsx`: the row and its tiles.
- [x] Seam in `ThreadFeed.tsx` (hot): one import, the row, two filters that
      keep pictures out of upstream's attachment rows; its budget row.

## Review

The cause was layout and lifetime, not loading speed: two trees with two
layouts, and the phone's own files dropped at the hand-over. One component
now owns the pictures for both states. The phone wasn't built for this
change (no room on the Mac's disk); the type check, lint and the
hand-over's test pass.
