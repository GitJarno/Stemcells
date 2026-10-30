# A Cell's name is a presence

Cells name each other: "Manatee is hiding the third one in parallel." The
person reading it asks, in order: is that one of mine, what is it doing,
take me there, is this the one, and take me back. Each time a Cell is
named, the person goes through the same five steps on every screen. Only
how each step is done changes, by two things: how many columns the screen
has room for, and whether there's a pointer. That depends on width, not on
the device.

## The five steps

1. **Spot.** The name is a token in the Cell tone (`--sc-peer`): the Cell's
   own figure, as its tab draws it, then its name. The figure's face tells
   its stage (thinking while Flying, its plea when it needs you, asleep
   when settled), and a settled Cell's token fades.
2. **Peek.** A pause over it, or a long press, shows its one-liner, its
   stage in the house words (Flying, Needs you, Landed, Settled), its
   latest line and its project. You don't leave the chat.
3. **Go.** Click or tap. Where there's room, it opens beside the chat that
   named it, so that sentence stays readable. A Cell already open is
   brought forward, never opened twice.
4. **Arrive.** Its pane rings once in the Cell tone: "this is the one." Only
   the ring's opacity changes, so it costs no layout, and it plays once.
5. **Back.** The chat you came from is still beside it, or one step back,
   with its name on the back button.

Which name means which chat: those of the chat's own project on its server,
the Cells the roster tells a Cell are working beside it
(`apps/server/src/stemcells/peers/roster.ts`). Aski can name any Cell. A
capitalised whole word, or `@Name`. Never inside code, a link or a path.
With two of one name, the one active last.

## By screen

- **Mac and web (two columns, pointer).** Hover peeks; click opens beside
  (`openCellBeside`) or brings it forward; the pane rings. Tokens take
  focus; Return opens.
- **iPhone (one column, touch).** Tap pushes the chat, and the token's
  figure flies into its header: the motion says which one. A long press is
  iOS's own preview, with Open, Message and Copy name. Back reads
  "‹ Otter". A light tick on tap.
- **Foldable (folded is the phone, open is two columns).** Open, a tap puts
  the Cell in the other half. Fold or unfold midway and it is one history
  in two shapes: Otter → Manatee opens out to Otter | Manatee, and folds
  back to Manatee with "‹ Otter". The peek stays on its own half, never
  across the crease.
- **iPad (two columns, touch and pointer).** Tap opens beside. With a
  trackpad the token lifts under the pointer and peeks; with a finger, a
  long press previews. In Slide Over or a narrow window it behaves as the
  phone.

## Both ways

- **Why you're here.** Arriving from a token, the chat shows the sentence
  that named it, with the namer's token, above its latest turn. It's gone
  once you scroll, and it's never stored.
- **In touch.** A Cell's header carries the figures of the Cells it wrote
  to, or heard from, in the last hour: at most three.
- **Mail reads as people.** The sent-mail row ("Asked Otter: …"), the
  received note, collision notices and Aski's room use the same token.

## Plan

Mac and web first, then the phone, then two columns on iPad and the
foldable, then both ways.

- [x] `peers/mentions.ts`: names written as `t3-context://v1/stemcells-cell/<id>`
      links outside code and links, so upstream's markdown keeps its
      incremental parse while a reply streams.
- [x] `upstream/cellNames.ts`: the names a chat may use, from upstream's
      shells, held per chat while they stay the same.
- [x] `peers/CellToken.tsx`: the token, its figure by stage, the peek
      (upstream's preview card), click to open beside or bring forward.
- [x] `tabs/arrival.ts`: the pane showing it rings once.
- [x] The markdown substitute draws the token in a chat's own words and in
      Cells' mail; the person's messages keep their words.
- [x] Tests: the linking rules; the token in a reply, which opens beside.
- [ ] Phone: the token in a Cell's reply, tap with the figure's flight,
      long-press preview, "‹ Otter".
- [ ] Two columns: iPad and the open foldable put it beside.
- [ ] Both ways: why you're here, in touch, mail and notices as tokens.

## Review

The Mac and web draw a named Cell as its token in replies and mail, peek
on hover, open it beside or bring it forward, and ring its pane once. The
phone, two-column layouts and the reverse pieces are still open (above).
