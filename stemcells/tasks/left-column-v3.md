# The left column, third pass

The column of `left-column.md`, redrawn on T3's redesign (draft 3, approved
2026-10-26). What a person said about the second pass: the type ran bigger
than the app's and ignored ⌘±, a card stayed after it was answered or
settled, colour meant nothing, and the stages carried critters.

## Decisions

1. **One type scale with the app.** T3's rem sizes (titles `text-sm`, the
   rest `text-xs`), so Settings › Interface size and ⌘± move the column with
   the chat.
2. **A row is two lines.** The Cell, title and time; then the project's icon
   and name, and the PR (state icon in its colour, number grey). Hover gives
   T3's thread card; Settle takes the time's place.
3. **An ask says only what's new.** It reads as a message:
   `aski-asks.md`, decisions 4 to 6, set its look.
4. **No tags.** An ask says what it asks in its Cell's words, and one that
   holds up a running turn says so in its age's amber (`aski-asks.md`,
   decision 4).
5. **Stages are a label and a count.** T3's status icon in its colour; no
   critters, no chevron (a stage switches the list, it doesn't expand). The
   open one is filled. Two fingers swipe from stage to stage in the line's
   order, Pinned last, on the tabs' own strip, so both slide alike.
6. **Only the person's own act flies.** Answer, Settle or Nothing to do from
   the open list: the Cell drops its "?", hops and dives into its stage's
   count, and the stage catches it (its icon nods, the row glows once, the
   count ticks up). Moves the person didn't make only change the numbers.
   Undo is the same hop backwards.
7. **Your own act never waits.** The card leaves at once. The list holds
   still under the pointer only for what the server changes.
8. **Undo is upstream's line** (#25270) above the stages, with ⌘Z. An answer
   is sent when the line goes.
9. **Filters:** a project, one quiet dropdown under the search. A machine's
   waits until the column lists Cells from more than this Mac (the person,
   2026-10-27). Asks never hide: Needs you counts every one, and says where
   those the filter leaves out are, a click away from all of them.
10. **Resizable** with T3's rail, double-click resets.
11. **The chat stays lifted** off the black canvas T3's redesign brings.

## Steps

- [x] Take upstream with T3's redesign, the chat lifted (the sync PR)
- [x] Settle clears a Failed, Limit or Plan card too
- [x] Your own answer or settle leaves at once, with upstream's undo line
- [x] Type, rows and resize
- [x] Asks: tags, the header row, grouped answers, keys (as `aski-asks.md`'s first step, #324)
- [x] Two fingers swipe through the stages
- [x] Stages as label and count; hops only for the person's acts
- [x] Filters
- [x] Docs
- [ ] The phone's home follows (`phone-line.md`)
