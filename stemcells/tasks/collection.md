# The collection: feats, what they unlock, and a Cell you dress

Work with agents is long waits and small decisions, in chats that all look
alike. What a game gives its player against that is not points: it is a
character that answers, proof that something was done, things to find, and
something of your own to show for it. The Cells already answer a hand
(`cell-acts.md`) and the ledger already keeps what happened
(`cell-ledger.md`). This joins them into one loop:

    real work → a feat → something unlocked → you dress a Cell → it shows

## The design

**A feat is the crew's, and true.** A mark (`cell-marks.md`) is one life's
evidence. A feat is what all the Cells on this machine have done together:
the hundredth landing, eight in flight at once, a run of two hours alone.
Feats are pure functions over the ledger's facts
(`stemcells/ledger/feats.ts`), worked out when asked and never stored, so a
feat added later is awarded for the past too. Each says what it took, when,
and which Cell's fact did it. One not yet earned shows how far along it is.

**Nothing punishes absence.** No streak that breaks, no daily goal, no
level that drains. A count only goes up. The feats that name a time (a
night landing, a day's count) reward what happened, once.

**A feat unlocks a look, never power.** Each feat unlocks one thing: a
piece to wear (the laurel, the title belt) or an act (the backflip). A
piece goes into the wardrobe; an act joins what every Cell may answer a
poke with. Rarity is said plainly: common, rare, legendary, secret. A
secret feat shows as a question mark until it is earned.

**You dress a Cell.** Until now nothing a Cell wore was chosen. In the
collection's dressing room the person picks a Cell and puts unlocked pieces
on it, a slot at a time. The choice is kept on this machine's server and
every picture of that Cell wears it, on the Mac and the phone; the Cell's
own look fills the slots left free. Taking everything off gives it back
its own look.

**The moment.** A feat earned while the app is open plays once: the Cell
that did it holds a cup up, and a card in the corner names the feat, the
Cell and what it unlocked, with one button to wear it. It never takes
focus, and waits while anything needs the person.

**A deed is a feat the hand did.** Poking a Cell dizzy is not in the
ledger. The client tells the server the first time (`deed`), and a secret
feat reads it.

**Today.** The collection opens on the day so far: landings, merges, the
longest run alone, and the Cells that landed, lined up.

## Where it lives

- `stemcells/ledger/feats.ts`: the catalogue and the rules, shared and
  safe for the phone. `stemcells/words/feats.ts`: the words.
- Server: `apps/server/src/stemcells/collection/`: what is kept
  (`collection.json` in our state folder: what each Cell wears, the feats
  seen, the deeds), the feats worked out from the ledger and kept until its
  next fact, `GET` and `POST /api/stemcells/collection`.
- Web: `apps/web/src/stemcells/collection/`: the read, the watch that
  plays a moment, Settings › Collection.
- The kit: `cell/chosen.ts` holds what the person chose and what is
  unlocked; `looks.ts` wears it first and `acting.ts` casts an unlocked act.
- Art: `art/packs/earned.json` (the pieces drawn for feats, and an outfit
  for each piece of the original's nobody wore), `art/moves/acts-feats.json`.

## Plan

- [ ] `feats.ts`: catalogue, rules, progress, today; tests
- [ ] Server: the collection's file, the service, the routes; tests
- [ ] Kit: chosen looks and unlocked acts; tests
- [ ] Art: the earned pieces, the feat acts
- [ ] Web: the read and its refresh, the moment, Settings › Collection
- [ ] Phone: a dressed Cell wears its choice
- [ ] Docs: `cell-art.md` (an earned piece, a feat's act), `interaction.md`
- [ ] One pass in the lab, captures for the pull request

## Review
