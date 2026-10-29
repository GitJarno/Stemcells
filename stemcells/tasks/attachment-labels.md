# Attachments read Image 1, Image 2

A picture sent in a chat showed as a chip with its file's name and size
("308E5680-D… 247 KB") and a thumbnail of the tile right above it. The
person wants it clean, and the same everywhere an attachment shows.

## Decided

- **Pictures and videos are numbered by kind**, in their order within one
  message or one draft, from 1: "Image 1", "Image 2", "Video 1". No file
  name, no size: a camera's id or a screenshot's time says nothing the
  thumbnail doesn't.
- **A file keeps its name**, which is what tells it apart. Its chip keeps
  upstream's look, size included: a media chip now has the same shape (an
  icon and words), and changing the file chip would mean editing upstream's
  chip parts for a size the person can still read on hover.
- **One presentation, not two.** A sent picture drew twice: its tile over
  the words, and its chip in them with a second, tiny thumbnail. Upstream
  puts a chip in the prompt when a picture is pasted into text already
  typed (`useComposerAttachmentIntake.ts`), so the words can point at it.
  The tile stays the picture; the chip now only says which one ("Image 2",
  with the picture icon), the same in the composer and once sent.
- **The same label everywhere**: the composer's strip, its resting
  thumbnails, a queued message's tiles, a sent message's tiles, players and
  chips, a guest's message, the remove dialog, the phone's chips, strip,
  context sheet and queued edit; accessibility words and tooltips included.
- **Only words a person reads.** The model still gets every real name.

## Plan

- [x] `attachments/labels.ts`: the numbering, plain TypeScript; the phone
      reads it through a kit.
- [x] Each app's `upstream/` adapter: which attachments upstream draws as
      pictures and videos; an annotated preview's screenshot takes no number.
- [x] Web chips: substitutes of `composerContextPresentation.tsx` and
      `UserMessageContextChips.tsx` draw `MediaChip`; the row's substitute
      hands its labels down.
- [x] Web tiles, players, guest messages and the remove dialog: seams.
- [x] Phone: the message chips' substitute (`enrichedLinkPresentation.ts`),
      the editors' chips, the strip, the context sheet, the queued edit.
- [x] Tests: the numbering; the contract that a sent message records every
      attachment in order (the phone numbers from records); the phone's
      chip labels.

## Review

Shipped as above. Left with names, on purpose (`seams.md`, Attachments read
Image 1, Image 2): the media viewer's screen-reader title and the file its
menu saves; a video to attach again; an attachment that failed to load; the
phone's sent message (`ThreadFeed.tsx`, hot), whose pictures name their file
only to a screen reader, and its compact thumbnails beside a resting
composer (`ThreadComposer.tsx`, near hot).
