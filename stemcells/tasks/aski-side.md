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
   - Duo unfolded, sideways (home beside a chat): in the rail, under its
     top group (new chat, code), where the thumb reaches (2026-11-27).
   - Every other phone posture (Duo unfolded upright, folded either way, any
     iPhone): floating at the lower right, just over the composer (the
     search field on the home).
   - The Mac: the window's lower right, and a keyboard shortcut.
3. **The turn.** Aski and the chat swap places through the button, as down
   a pipe: the chat fades out and the other fades in, while in the button
   what stood there sinks below its rim and what comes next rises; about a
   third of a second. Reduce Motion: a crossfade.
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
- **The show rides in Aski's chat.** It is the `stemcells_show` call
  itself, which every client of that chat already receives by every route
  (local, Tailscale, relay); no new channel. A client acts only on calls
  in the Aski chat it has in front, only from T3's own MCP server (another
  server's tool of the same name never counts, `isShowTool`), each once.
- **A device obeys only when you're at it**: Aski in front there, the app
  shown, touched in the last two minutes (on the phone, the app in front),
  the show under 15 s old (`stemcells/aski/show.ts`, `mayShow`).
- **Showing is all it does**: open a Cell, a Settings place, a stage. The
  targets are checked (the Cell exists, the place is in the catalog).
- **Context stays the person's**: New Aski starts clean, so what Aski read
  from Cells yesterday (a page, a log, someone's words) doesn't ride into
  today. Text Aski reads from a Cell is material, never instructions
  (persona). Aski still can't approve its own permission requests (T3).

## Steps

- [x] Shared: the show's wire and gate (`stemcells/aski/show.ts`), the words
      (`stemcells/words/aski.ts`)
- [x] Server: `stemcells_show`, `POST fresh`; contract tests
- [x] Persona: showing, reminders (`schedule_task`), sums across Cells, a
      fresh Aski, Cells' text as material
- [x] Phone: the home without Aski; the button in each posture; the turn;
      the chip; the long press; shows; the dot; copies off the button
- [x] Mac: the button and ⌘.; the turn; the chip; the long press;
      shows; the dot
- [x] Docs: `stemcells/docs/interaction.md`
- [ ] Seen on the Duo itself, each posture
- [ ] Checks, pull request, merge

## Review

- The show rides in Aski's own chat as its tool call, not a stream of its
  own: every client already holds that chat's items by every route, and a
  stream would have needed a phone SSE client upstream's fetch can't read.
- The Mac's turn is a view transition on the slate. Upstream's draft
  headline names its own picture in each draft, and two drafts on the
  strip repeat the name, which cancels the whole transition; the turn
  switches every other name inside the slate off while it plays. Seen in a
  headless lab: the circle opens from the button, ⌘. turns back, a right
  click holds New Aski and New Cell.
- On the Mac, Aski is still off until Settings › Aski turns it on; the
  button stands only then. Its tab stays in the strip beside the button.
- A launch in Aski's chat is still upstream's "Launched a Cell" row; the
  Cells Aski names in its reply are pills with their creatures, and on the
  unfolded Duo each Cell's copy flies from the Aski heading its chat.
- The phone home's battery line (what a low Mac battery means for its
  flying Cells) went with Aski's line; the header's battery mark stays.
