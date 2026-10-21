# Carrying media and stashes between chats

the person (2026-10-21): drag stashes from tab to tab; drag a composer's
attachments into another chat; grab a picture, video or file shown in a
chat and drop it in another chat, where it lands as an attachment.
Scalable, and right in the details.

One carry engine for everything: tab-swipe's (`windows/carry.ts`, W5a), and
its payload API when it lands. Nothing here is a second drag system: this
work brings the payloads, what accepts them, and how they land.

## Decisions

- **A payload is references, never bytes.** A composer chip, a stored
  attachment, a file a Cell showed (by the signed asset URL the chat already
  holds), a remote URL, or a stash entry.
- **Landing copies on the server.** The server copies the referenced file
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
- [ ] With the payload API: the sources and targets wired, spring-load,
      "+", Esc home, ⌥⌘Z, Reduce Motion, the OS drag when leaving the
      window; their tests.
