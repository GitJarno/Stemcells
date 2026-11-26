# Aski, the other side of every chat

The person, 2026-11-26, from the iPhone Duo: the Aski over the phone's home
("Three Cells need you.") brings nothing. Aski should be one button, always
there, that opens its chat, where you ask it to start Cells, take you to a
chat or a setting, remind you, or sum up across Cells. They want the Duo to
be the device they run everything from.

## What the market does (benchmark, 2026-11-26)

Orchestrators split three ways: dashboards of sessions (Claude Code's agent
view, Cursor's Agents Window, Conductor, Codex mobile), agents that run
agents (Firstmate, Devin's coordinator, Factory Missions, Paperclip, T3's
`delegate_task`), and phone assistant overlays (Gemini, Siri). None is a
summonable chat that also drives the app, and none fits itself to a
foldable's postures. What the best share: one entry point that answers in
outcomes, not step logs; supervision by events, not polling; the person
interrupted only when needed and answering in place; an orchestrator that
can't approve its own requests.

## Decisions

1. **A toggle, not a sheet.** One tap turns the chat in front over to Aski;
   another turns it back to the Cell (or the home) you came from. Aski keeps
   the whole chat, composer, voice and attachments; nothing new to learn and
   no second, cramped chat. The button shows where it will take you: Aski
   from a Cell, the Cell's creature from Aski.
2. **Where it stands.**
   - Duo unfolded, sideways (home beside a chat): in the rail's open middle,
     just over its lower group.
   - Every other phone posture (Duo unfolded upright, folded either way, any
     iPhone): floating at the lower right, just over the composer (the
     search field on the home).
   - The Mac: the window's lower right, and a keyboard shortcut.
3. **The turn.** The chat steps back and dims while Aski's opens out of the
   button, about a quarter second; back, it folds into the button. Reduce
   Motion: a crossfade.
4. **"This" carries over.** Turning to Aski from a Cell puts that Cell's chip
   (upstream's thread context) in Aski's composer; × drops it.
5. **Long press: what's next, under one finger.** Hold, slide, let go:
   - **New Aski**: a fresh Aski chat. The one before settles, readable.
   - **New Cell**: a new Cell's draft.
   - **Next on Input · N**: the next Cell waiting on the person (only when
     one waits).
6. **Aski shows; the person decides.** A new tool, `stemcells_show`, opens a
   Cell, a place in Settings or a stage on the device the person is talking
   from. It never writes: a setting still changes by the switch Aski puts in
   its reply.
7. **When Aski answers while you're elsewhere** the button carries a dot
   until you look. Nothing loops or repaints while Aski works.
8. The phone home's Aski and its line go; the stages stay (Input's count
   says what the line said). Its copies now bud off the button.

## Security

- **One chat can move a screen.** `stemcells_show` answers only to Aski's
  own chat, the one each client and the server pick (`askiChatsOf`,
  `askiChatAmong`, `askiThreadOf`). Every Cell, an earlier Aski and every
  client outside the app are refused, server side. Cells can't run on
  Aski's instance (`askiInstance.ts`), so no Cell becomes Aski.
- **A device obeys only when you're at it**: Aski in front there, the app
  shown, touched in the last two minutes, the show under 15 s old
  (`stemcells/aski/show.ts`, `mayShow`). A show is never replayed.
- **Showing is all it does**: open a Cell, a Settings place, a stage. The
  targets are checked (the Cell exists, the place is in the catalog).
- **Context stays the person's**: New Aski starts clean, so what Aski read
  from Cells yesterday (a page, a log, someone's words) doesn't ride into
  today. Text Aski reads from a Cell is material, never instructions
  (persona). Aski still can't approve its own permission requests (T3).

## Steps

- [ ] Shared: the show's wire and gate (`stemcells/aski/show.ts`), the words
      (`stemcells/words/aski.ts`)
- [ ] Server: `stemcells_show`, its stream, `POST fresh`; contract tests
- [ ] Persona: showing, reminders (`schedule_task`), sums across Cells, a
      fresh Aski, Cells' text as material
- [ ] Phone: the home without Aski; the button in each posture; the turn;
      the chip; the long press; shows; the dot; copies off the button
- [ ] Mac: the button and shortcut; the turn; the chip; the long press;
      shows; the dot
- [ ] Docs: `stemcells/docs/interaction.md`
- [ ] Seen on the Duo itself, each posture
- [ ] Checks, pull request, merge
