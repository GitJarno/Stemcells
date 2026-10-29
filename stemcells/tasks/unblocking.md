# Unblocking a Cell in one look

The person's notes on the asks (flagged in Aski's room, 2026-10-27/28) and
on the column (2026-10-29):

- Nearly every ask read "Left a step to you. Done it?", with the step
  itself in grey under it and nothing of what the Cell did.
- A step that names a place ("buy the domain, through Escrow.com") had no
  link, though the Cell's reply had one.
- "Hit its usage limit" asked the person to do what the app can do itself.
- "The disk was full" offered no way to free it.
- In the column an answered card stayed for what felt like a random time,
  the list jumped, and the asks were hard to tell apart at a glance.
  "Done it" and "Reply…" sat as two rows of plain text.

It replaces `aski-asks.md` decision 5 for a card's own options (rows),
decision 10's fixed line for a step left, and the hold under the pointer in
`left-column-v3.md` decision 7 and `aski-room.md` decision 9. A Cell's own
choices to a question keep decision 5.

## What an ask is for

The person reads an ask cold, between other work, and should be able to
unblock the Cell without opening its chat. So an ask carries: what to do,
in one line; what it did and what waits on it; the means to do it (a link,
a button); and one click to say it's done. Anything the app can clear by
itself is not an ask.

## Decisions

1. **Needs you holds only what the person alone can do.** A Cell a usage
   limit stopped carries on at the reset by itself: Stemcells turns
   upstream's "Auto-resume limited threads" on once per server (as
   `aski-room.md` always meant), and a person who turns it off keeps it
   off. With it on, a limit with a known reset makes no ask, however far
   the reset; one comes only when the reset is unknown or the carry-on
   hasn't happened 15 minutes after it.
2. **An ask leads with the step.** A step a Cell left the person is the
   ask's line, in the Cell's words; several are a numbered list under
   "N steps for you". Under it, what the Cell did: its reply's opening
   paragraph. A step of the Cell's own that waits on the person's ("me:
   merge it once you've signed in") shows as "Then Narwhal will …".
3. **Done it settles when nothing waits.** With a step of the Cell's own
   after the person's, Done it tells the Cell to carry on; without one it
   settles the Cell and sends nothing, since a turn to say "thanks" is
   only cost.
4. **Links are one click.** An ask's words draw as the chat draws them
   (upstream's markdown, inline): links, code, bold. A bare web address
   ("acme.dev") is a link. The reply's other links show under the ask,
   up to three, so a step that says "buy it" sits next to where to buy it.
5. **A full disk offers its fix.** A turn the full disk stopped offers
   Free space, which starts the cleanup Cell, as the chat's own row does:
   first while the disk is full, after Retry once there's room again.
6. **Options sit side by side.** Buttons in a row, the recommended one
   filled; what an option does shows under the row, for the one you're on
   or else the recommended. Reply… turns into a full-width field in the
   row's place, focused; Esc brings the buttons back. A Cell's own choices
   to a question stay rows: their words are what the person decides by.
7. **A card goes when its need goes.** Answered, settled or taken care of
   anywhere, it folds away at once and the list closes the gap. No greying
   in place and no holding still under the pointer: that hold is what made
   a card stay for a time nobody chose. A send that fails brings the card
   back with why.
8. **An ask reads in one glance.** The open ask sits on a raised surface;
   folded ones are a row each: who and where on the first line, what they
   need on the second, in the foreground.

## Steps

- [x] Server: the defaults table (settle on merge off, auto-resume on), once per server
- [x] Server: a limit carries on whenever auto-resume is on and the reset is known
- [x] Server: an ask's steps, its Cell's next step, its reply's lead and links
- [x] Card: the step as the line, steps, "Then …", lead, links; Done it settles when nothing waits
- [x] Card: Free space on a full disk
- [x] Card words drawn as markdown, bare addresses linked
- [x] Options side by side; Reply… as a full-width field
- [x] The list: a gone card folds away at once, no hold-still
- [x] The look: raised open ask, two-line folded rows
- [x] Phone: the same card data, links, side-by-side options
- [x] Before/after captures; tests; drift; check-local; merge

## Review

- **One way off the list.** The page now treats an answered or settling
  need as gone (`needs/live.ts`), so the person's acts and the server's
  changes leave through the same fold. An answer on the undo line stays
  folded in place, so Undo puts it back where it was.
- **Recommendations stay off real-world steps.** Done it and the limit
  options are never recommended: Aski's "ok the rest" mustn't claim the
  person bought a domain.
- **Not done here:** the Cells' close-out instructions could ask for a link
  in every step the person takes, which would make most asks carry their own
  link. That is model-facing text and needs an eval with a paid key first.
- **Seen in headless captures only**, the phone in tests: not yet on the
  installed app.
