# A tab's name, double-clicked

A double-click on a tab's name opens it for a new one in place, as the
one-liner over a Cell's composer does: the same field (`rename/RenameField.tsx`),
the same keys (Enter keeps, Escape doesn't, leaving keeps). Every tab takes a
name of its own, kept with the workspace; a blank one gives it back its focused
chat's title. The chat's title is its one-liner, which the phone's card and the
other Cells read, so a tab's name may drift from it (the person, 2026-10-30; a
tab of one Cell renamed its chat until then). Aski's tab and the new Cell's
are never renamed.

- [x] The one-liner's rename field, shared; the chat's rename hook (`useCellRename`) out of its menu
- [x] `Tab.name`, `nameTab`, kept and read back with the workspace
- [x] The strip: a double-click opens the field in the name's room, the tab's width unchanged; a press in the field never drags; one click still only opens the tab
- [x] The field keeps the focus the app takes: a double-click whose first click opened a tab lost it to the composer
- [x] Proof in the desktop lab: wide and narrow strips, a reload keeping the names
- [x] Review fixes: any key or press of the person's, anywhere, ends the taking back (⌘T while the field was new sent the next prompt into the old tab's name); a name that can't be applied yet keeps the field open; tab names and titles stop at 100 characters
- [x] Re-review: a rename that can't apply says why under the field ("Can't rename this Cell here") until it changes; Escape still closes it

## Review

Done. In the desktop lab (production build) a one-chat tab renamed its chat
(the tab and the one-liner both changed), a two-chat tab took "Reading room
· 2", Escape kept the old name, a long name scrolled inside a 129 px tab, a
reload kept the tab's name and the chat's title, and a cleared name gave
the automatic one back. The first double-click after a load opened the
field and lost it in the same frame: activating the tab let upstream's
ChatView focus its composer a frame later. The field now takes the focus
back unless the person pressed or typed elsewhere.

After review: the field took the focus back from whatever took it in its
first 500 ms, so ⌘T there gave the new Cell's composer back to the field
and the prompt typed next renamed the old tab. The workspace stops ⌘T on
the window, so the field now hears every key and press on the window from
load (`rename/acts.ts`), ahead of the workspace, and only a focus taken
before the person acted is taken back.
