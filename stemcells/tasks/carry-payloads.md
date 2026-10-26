# Carrying media and stashes between chats

the person (2026-10-21): drag stashes from tab to tab; drag a composer's
attachments into another chat; grab a picture, video or file shown in a
chat and drop it in another chat, where it lands as an attachment.
Scalable, and right in the details.

Attachments ride the browser's own drag, not tab-swipe's carry engine
(`windows/carry.ts`): it already crosses panes, spring-loaded tabs, the
app's windows and other apps, and every chat already takes files off the
disk through it. A carry is one more thing that drag holds (`seams.md`,
Attachments carried between chats). A stash, which moves with ⌥ to copy,
may still want the engine's card.

## Decisions

- **A payload is references, never bytes.** A composer chip, a stored
  attachment, a file a Cell showed (by the signed asset URL the chat already
  holds), a remote URL, or a stash entry.
- **Attachments land through the composer's intake.** A carried picture,
  video or file is read into a File in the page (the window's own bytes, or
  signed afresh by its machine) and handed to the chat's composer as a
  file off the disk is: upstream's checks, previews and upload to the
  chat's own machine, so a chat on any machine takes it. Upstream's
  clipboard import reads attachments into the page the same way. This
  replaces the server copy below for attachments; a video up to the 50 MB
  cap passes through the page.
- **A carried chip is copied.** The intake doesn't say what it took, so a
  move could lose a chip the target refused; the person removes the
  source's with its ×.
- **Landing copies on the server** (stashes). The server copies the referenced file
  into a pending attachment (`/api/stemcells/attachments/import`) and the
  target's draft holds that id, as a restored stash file does. A video is
  never read into the renderer; a remote URL is fetched once, by the server,
  into the app's attachment store, never into the person's project.
  Pictures are the exception: upstream's picture chips need the bytes (at
  most 10 MiB, as upstream caps them), so a picture comes in as a `File`.
- **Never shared ids.** Two drafts never hold the same pending id: one
  draft letting go of it would delete the other's file, and deleting a
  thread deletes every attachment its messages name. A move is a copy and
  the source letting go.
- **Accepts says why not.** The target's environment decides, as upstream's
  composer does: uploads supported, the file cap (50 MiB), picture types and
  cap, at most 100 attachments in a message. A Surface is never a target;
  the chat a payload came from takes nothing (a no-op).
- **Stash.** Upstream's stash stays one list for the whole app. A stash
  dropped in a chat leaves the stash for that chat's draft: words,
  attachments and context together, the way upstream's own restore does;
  ⌥ keeps a copy in the stash.

## Plan

- [x] Server: `POST /api/stemcells/attachments/import` (an asset URL or a
      remote URL in, a pending attachment out), with its caps, and a
      contract test pinning upstream's pending ids, claims and sweep.
- [x] Web: payloads, `accepts` with its edges (own chat, a working chat,
      Aski, a Surface, "+", room, caps, machines), landing by reference
      into a draft, a stash copy whose files are copies of their own, and
      media references from what a chat shows (`stemcells/payloads/`).
      Copying a file needs the primary machine on both ends; a picture
      lands anywhere, as a File.
- [ ] A stash dropped in a chat lands through upstream's own restore: a
      seam lets the composer register it.
- [ ] Keyboard: "Send to…" on each source, listing the tabs.
- [x] Attachments on the browser's drag: a composer's chips, a sent
      message's pictures, files and chips, and a transcript's pictures and
      videos dragged into any chat, in this tab, another (spring-load),
      another window or on another machine; the chat lights upstream's
      overlay and its composer takes them; a chip's own chat, and its row
      in the sidebar, refuse it; only drags the app started are read;
      Esc; `DownloadURL` for a drop outside the app. Tests: the wire, the
      reading, real drags in the browser, upstream's contracts.
- [ ] The strip's "+", ⌥ to move a chip, a stash dragged, Undo.

## Review (attachments)

Checked with real drags in headless Chromium (`attachmentCarry.browser
.test.tsx`): a chip from upstream's own strip lands in another chat as the
same File and its own chat never lights; a reply's picture is read from
its address and lands; outside a transcript nothing carries. Each fails
with its seam or gate taken out. Not checked by hand: the drag between two
of the app's windows, and `DownloadURL` onto the desktop in Electron.

An independent review found five things, fixed before merging: a reply's
video couldn't be dragged (its player has controls over all of it; now a
press above them carries); a chip let go over its own chat's sidebar row
went back in; an answer that didn't say its size was read whole before the
cap; a web page could dress a drag as a carry; and a type guessed from a
name beat the one the answer declared. Left as they are: two windows on
the same chat each take a chip from the other (each window knows only its
own drags' chips), and a pane that switches chats while a drop is still
being read lands it in the new chat.
