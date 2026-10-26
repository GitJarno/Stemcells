# Aski's room as a conversation, and an ask as a message

What the person does in Aski's room is two things: start work, and unblock
the Cells while they fly. The room had a column of heavy cards on the right
and a roster under the chat; both said too much at once. This redraws the
room and the ask itself. Approved 2026-10-26, after a mockup, simplified on
the person's note that the right half was too busy.

It replaces `aski-room.md` decision 10 (layout), the roster of
`aski-manager.md` decision 10, and the look of an ask in
`left-column-v3.md` decision 3. The rest of those plans stands: one list
from the server, options as app actions, words can say no and only a click
says yes, the undo window.

## Decisions

1. **Aski's chat is one conversation.** The Cells are the threads: each
   piece of work is its own chat, so nothing that matters lives only in
   Aski's history, and upstream's auto-compact keeps it bounded. No
   "which Aski?" (`aski-manager.md` decision 3, kept).
2. **Aski's room is two halves.** The chat on the left, what needs you on
   the right, at any width the room has two halves for. No roster under the
   chat and no done list: the column's stages say both.
3. **Every ask open, a line between.** The person answers several at once
   in Aski's chat, often dictating while they read down the list: "1, go
   with the second; 2, do that; 3, this and this, but first I need to know
   X". So every ask on the right is open, oldest first, with a hairline
   between and nothing else: no boxes and no hints, only each ask's quiet
   number, which is what those words address it by and which it keeps
   while it lives (`aski-room.md` decision 3). Ten asks stay
   calm because each says only its Cell, its question, two lines and its
   options. As the person types, each ask shows what their words do to it
   (`aski-room.md` decision 8). The narrow column keeps one open at a time.
4. **An ask is a message.** Its Cell (sprite and name), the project and the
   age on one quiet line; the question, the largest words on the page; at
   most two lines of what you need to decide, with More showing the Cell's
   own words in place; then the options. No tag, no headline restating it.
5. **Options are rows, quiet until you're on one.** A Cell's own words on
   each choice always show: they are what the person decides by. Our line
   on what an option does ("Sends “Go ahead.”") shows on the lit one, the
   recommended before you move, then the one you're on. Reply… is the last
   row and opens a field. A permission lights none: that call is the person's. Number keys
   pick, ↵ takes the lit one (never an allow), ↑ and ↓ move. No key hints
   on screen.
6. **Later, Settle and Open chat stand in the age's place** while the
   pointer or the keyboard is on the ask. "Nothing to do" leaves the
   options: Settle says it.
7. **An answer leaves at once.** The app's one undo line says what you
   sent, with Undo and ⌘Z: in the Cells' column, above its stages, or
   upstream's notice where the column is narrow or hidden. When it goes,
   the answer is sent and the Cell hops to Working (`left-column-v3.md`
   decisions 7 and 8, the same here).
8. **The column is the index in Aski's room.** Its Needs you rows stay the
   same everywhere; in Aski's room a click opens that ask on the right
   instead of in the column.
9. **Words that need more go to the Cell as a question.** "This and this,
   but I need to know X" answers what it can, and sends the person's own
   words to the Cell as a reply, which asks for X; the Cell answers and
   asks again, and its new ask carries what was missing. Aski never writes
   what a Cell reads (`aski-room.md` decision 5).
10. **A Cell's question in prose is its own sentence.** Until Aski's read
    writes briefs (`aski-room.md` slice 4), the question is the last
    sentence of the Cell's paragraph that asks, and what comes before it is
    the context. A stop short of done, or a step left to the person, keeps
    its fixed line.
11. **Every ask can say it wasn't enough.** A small flag beside the age,
    with the tail: "Not enough to decide", and a line of what was missing
    if the person wants to say. Flagging shows the Cell's own words at once
    and keeps the ask where it is.
12. **A local measure of whether asks are enough.** How each ask ended is
    kept on this Mac only, in our store, and never sent anywhere: answered
    in place, answered after opening its chat, flagged, or taken care of
    elsewhere. The benchmark is the share answered in place and unflagged,
    by kind, over the last 7 days, in Settings › Aski. It is
    `aski-room.md`'s "answered here vs elsewhere" counter, made the goal.
13. **It improves from what's flagged.** First on its own: a kind whose
    asks get flagged shows more of the Cell's words by default. Then by
    work: flagged asks and their notes become the evaluation set for how
    Cells ask (`aski-manager.md` decision 8) and for Aski's read
    (`aski-room.md`, "Evaluation harness"); a change to either must raise
    the benchmark on that set before it lands.

## Steps

- [x] The ask's look, in the column and in Aski's room (decisions 4 to 6, 10)
- [x] Aski's room: two halves, every ask open, the undo line (decisions 2, 3, 7)
- [x] Words that need more reach the Cell as its question (decision 9)
- [x] The column as the index in Aski's room (decision 8)
- [ ] The flag, and the local measure in Settings › Aski (decisions 11, 12)
- [ ] Asks show more where they were flagged; flagged asks as the evaluation set (decision 13)
- [x] Docs
