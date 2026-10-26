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
3. **An ask says only what's new.** Folded: the Cell beside who, project and
   tag, then what it asks and its age. Open: one header row with the Cell,
   then the ask across the full width, no headline restating the tag, its
   answers as one group (number keys pick, Return takes the recommended),
   and a foot with its age, Later, Settle and Open chat.
4. **Tags take T3's status colours, in five families.** Answer (indigo:
   Question, Input, Offers to go on), Allow or check (amber: Permission,
   Sign-in, Limit, Stopped, Stuck), Plan (violet), Your step (emerald),
   Failed (red). A new kind joins a family; none gets a colour of its own.
5. **Stages are a label and a count.** T3's status icon in its colour; no
   critters, no chevron (a stage switches the list, it doesn't expand). The
   open one is filled.
6. **Only the person's own act flies.** Answer, Settle or Nothing to do from
   the open list: the Cell drops its "?", hops and dives into its stage's
   count, and the stage catches it (its icon nods, the row glows once, the
   count ticks up). Moves the person didn't make only change the numbers.
   Undo is the same hop backwards.
7. **Your own act never waits.** The card leaves at once. The list holds
   still under the pointer only for what the server changes.
8. **Undo is upstream's line** (#25270) above the stages, with ⌘Z. An answer
   is sent when the line goes.
9. **Filters:** machine and project, two quiet dropdowns, as on the phone.
   Asks never hide: Needs you counts the ones elsewhere.
10. **Resizable** with T3's rail, double-click resets.
11. **The chat stays lifted** off the black canvas T3's redesign brings.

## Steps

- [ ] Take upstream with T3's redesign, the chat lifted (the sync PR)
- [x] Settle clears a Failed, Limit or Plan card too
- [ ] Your own answer or settle leaves at once, with upstream's undo line
- [ ] Type, rows and resize
- [ ] Asks: tags, the header row, grouped answers, keys
- [ ] Stages as label and count; hops only for the person's acts
- [ ] Filters
- [ ] Docs
- [ ] The phone's home follows (`phone-line.md`)
