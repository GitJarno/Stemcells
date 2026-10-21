# A Cell's line over its composer

Over each Cell's composer, one line: the Cell's name as a chip in the Cell
tone, its project, and a one-liner on what the chat is about. The Cell's
figure stands on the line's left end, its feet on the line's top edge.

## Plan

- [x] A Cell's name: none existed, so one is dealt from its thread id
      (FNV-1a over the id, into a pool of names), as data in `cell/`.
- [x] The one-liner: upstream's thread title. Upstream asks a model for a
      title (3–8 words, under 40 characters, never the message cut short)
      once the first message is sent, so we lean on it. Ours only drops
      what says nothing: no title yet, upstream's "New thread", or a title
      that is just the project's or the Cell's name.
- [x] The project: its title, as upstream's chat header names it. A sent
      thread can't change project upstream, so it is plain text, with no
      chevron: one would promise a menu that isn't there (review of #13).
- [x] The line is an attached banner on upstream's banner dock, so it
      stacks with upstream's own (approvals, questions, tasks) and wears
      their surface on a light page and a dark one.
      (Since 2026-10-21 it stands on the ground above the composer's box
      instead: `composer-glass.md`, "One box, a halo".)
- [x] Seam: one line in `ChatComposer.tsx`'s banner column. The pane says
      which Cell it holds through a context; Aski's pane and upstream's own
      routes give none, and the line draws nothing there.
- [x] Tests: the one-liner's choice, the name's deal, the placeholder title
      and the title prompt as contracts.
- [x] drift, typecheck, our tests; PR.

## Review

- Checked in the dev web app, dark and light: the Cell stands on the
  line's edge past its corner, the title upstream generated shows beside
  the project, and at 320 px the one-liner ellipsizes first. Aski's pane
  has no line.
- The title hooks moved to `upstream/thread.ts`: the line lives inside
  upstream's chat view, and `upstream/chat.tsx` imports that view, so
  reading the title from there made an import cycle.
- Open: two chats can be dealt one name (nothing deals names apart over
  the roster yet); the figure wears the page's ink, as there is no
  provider hue yet; an unsent draft shows no line, since upstream's draft
  headline already names its project with a picker.
