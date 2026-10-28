# The phone's home and chat headers, cleaner

The person's asks (2026-10-27): no band behind the chat's header; the
machine and project pickers out of the home's list and into its header's
top right, saying when one is chosen; a card at most two lines; the
Claude mark without the stray badge on it.

- [ ] No header band: iOS 27's `automatic` edge draws a hard band with a
      dividing line behind a transparent header. The chat and the home take
      `hidden` (`thread-header-appearance.ts` substitute; the home's own
      options from `HomeFront`).
- [ ] The scope in the header: a project button and, with two machines or
      more, a machine button, left of search, on the threads tab. All shows a
      plain glyph; a chosen project shows its own icon, a chosen machine its
      own symbol, tinted. T3's chips leave the home where the header has them.
- [ ] Two lines a card: the title takes the lines left of the time; the pull
      request and the agent's mark stand under the time, at the title's
      second line. A failed chat's line keeps the title to one.
- [ ] The agent's mark on a card is the mark alone: no instance initials.
- [ ] Seams listed; drift passes; `check:changed`; the app built onto the
      phone and each change seen there.

## Review
