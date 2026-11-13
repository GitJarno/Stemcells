# The collection: feats, what they unlock, and a Cell you dress

Work with agents is long waits and small decisions, in chats that all look
alike. What a game gives its player against that is not points: it is a
character that answers, proof that something was done, things to find, and
something of your own to show for it. The Cells already answer a hand
(`cell-acts.md`) and the ledger already keeps what happened
(`cell-ledger.md`). This joins them into one loop:

    real work → a feat → something unlocked → you dress a Cell → it shows

## The principles

What the research on rewards and the games that do this well agree on, and
what each means here. Where the evidence is thin it says so.

1. **A feat is feedback, never a demand.** Praise that informs raises
   motivation; a reward expected for doing an interesting task lowers it,
   and feedback worded as a "should" lowers it too (Deci, Koestner & Ryan
   1999). So a feat says what happened, in plain words, after the fact.
   Nothing here asks, nags or says "keep it up".
2. **Measure what was done, not that someone showed up.** Blair (2011)
   prefers achievements that measure over ones that tick a box; McClanahan
   (2009) adds that the cheapest way to earn one must be play you want
   anyway, and "Goals Gone Wild" (Ordóñez et al. 2009) is the list of what
   a narrow target does otherwise. Every measure is an outcome the person
   wants regardless: a run that landed, a pull request merged, a Cell that
   went an hour alone. None counts messages, hours in the app or prompts.
3. **A goal you can see, and how near it is.** Specific, hard, reachable
   goals with feedback beat "do your best" (Locke & Latham 2002), and
   effort rises as a goal nears, then resets once it is earned (Kivetz,
   Urminsky & Zheng 2006). So each ladder shows its next rung and the
   count against it, the page opens on the three rungs nearest earned, and
   a feat's card names the rung above it at once.
4. **The past counts.** A head start with a reason is finished faster
   (Nunes & Drèze 2006). Feats are worked out from the ledger, so what the
   Cells already did is awarded on the first read, dated and named.
5. **Nothing is lost.** A broken streak lowers what people do next
   (Silverman & Barasch 2023), and Blair's rule is no negative
   achievements. No streak by the calendar, no daily goal, no level that
   drains. A count only goes up, and a rank is never taken back.
6. **Mostly known, a few surprises.** Expected goals do the work;
   surprises are for delight, used sparingly (Blair). Four feats are
   secret. A landing at night is one of them on purpose: it happens, and
   it is good when a Cell works while the person sleeps, but it is never
   shown as a goal, because nobody should stay up for it.
7. **A feat unlocks something real, never power.** Points tell progress;
   they are not the play (Robertson 2010). The games remembered for this
   pay in things: a banner piece in Diablo 3, a title in Diablo 4, a
   character in Vampire Survivors. Every rung here unlocks one thing a Cell
   wears or does, and nothing it unlocks makes a Cell work differently.
8. **Never in the way.** Blair: don't break concentration. A feat's card
   takes no focus, sits clear of the composer, leaves on its own and waits
   while any Cell needs the person. What the past awards gets no card.
9. **Variety against wearing off.** Different kinds of ladder, two kinds
   of reward, and a moment that arrives when the work does, not on a
   schedule (Lyubomirsky 2011 on adaptation).

Weak or contested, and treated so: that badges raise activity at all (the
field studies are not randomised), and any particular tier curve. No source
quantifies how thresholds should grow. The slopes below are set from real
ledgers, and are the first thing to tune.

## The structure

**A feat is the crew's, and true.** A mark (`cell-marks.md`) is one life's
evidence. A feat is what all the Cells on this machine have done together.
Feats are pure functions over the ledger's facts
(`stemcells/ledger/feats.ts`), worked out when asked and never stored, so a
feat added later is awarded for the past too. Each says what it took, when,
and which Cell's fact did it.

**Ladders.** The feats of one measure are a ladder, climbed a rung at a
time; a feat that stands alone is a ladder of one rung. Thirteen ladders
hold the thirty-seven feats that count.

**Three segments**, each a question the person already asks:

| Segment | What it asks                  | Ladders                                                                                   |
| ------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| Flight  | What do my Cells get done?    | Landings, Merges, Settled                                                                 |
| Trust   | How far does a Cell go alone? | Longest run alone, Without a word, Straight through, Short hop                            |
| Crew    | How much flies at once?       | In flight at once, In one day, Cells, One Cell's landings, Providers, Days with your crew |

Diablo 3 has seven top-level categories, Diablo 4 nine, World of Warcraft
about fifteen. Three is what fits one screen without a list of lists.

**The slopes.** Two kinds of measure, two slopes:

- A count that piles up climbs by tens, as a kill count does in Diablo:
  landings 1, 10, 100, 1,000, 10,000, 50,000; merges 1, 10, 100, 1,000,
  5,000; Cells 10, 100, 1,000, 5,000; settled 10, 100, 1,000. A crew gets
  faster as it grows, so only a multiplying ladder stays ahead of it.
- A best yet climbs by twos and threes, because it is a limit of skill and
  not of time: alone 10 min, 30 min, 1 h, 2 h; in flight at once 3, 6, 12;
  without a word 5, 15, 30; in one day 10, 100, 500.

Every ladder's first rung falls inside a crew's first day. Its top is about
a year out for the heaviest crew measured, and the last step of a long
ladder is a five, not a ten: the tiers players call gruelling in Diablo 3
are the ones a step too far.

**Rarity** is a rung's height, said plainly: common at the foot, rare in
the middle, legendary at the top. A dot a rung shows it, filled in its
rarity's hue once earned, beside the count in numbers: in Diablo 4's beta
the skulls on a challenge drew the complaint that nobody was told what
they meant. The hues are the ones an item's name wears in Diablo: blue
for rare, orange for legendary, purple for a secret, and the words' own
dim ink for common. Nothing else on the page is coloured: a count's bar
and the ring are drawn in the words' ink, so a hue always means rarity.

**A rank** is the count of feats earned, named: Ground crew, Cadet, Pilot,
Captain, Commander, Ace, Legend, at 0, 3, 8, 15, 22, 29 and 35 feats. The
last is short of all thirty-seven, as a Diablo 4 season chapter asks for
ten objectives of twenty-two: no one rung stands between the person and
it.

**Secrets** are on no ladder and in no count, as Feats of Strength are in
Diablo 3 and World of Warcraft: a question mark until found, then a line
of their own.

**Two dimensions.** A feat is the person's: what the whole crew has done.
A mark is one Cell's: what its own life did (`cell-marks.md`), six of
them, each earned once. Games split the same way, an account's
achievements and one character's own record. The collection's two views
are the two: Feats, and Cells.

**You dress a Cell.** In the wardrobe the person picks a Cell and puts
unlocked pieces on it, a slot at a time. The choice is kept on this
machine's server and every picture of that Cell wears it, on the Mac and
the phone; the Cell's own look fills the slots left free.

**The moment.** A feat earned while the app is open plays once: the Cell
that did it holds a cup up, and a card names the feat, the Cell, what it
unlocked and the rung above, with one button to wear it.

**A deed is a feat the hand did.** Poking a Cell dizzy, throwing it or
stroking it is not in the ledger. The client tells the server the first
time (`deed`), and a secret feat reads it.

## The view

Settings › Collection, the same on the Mac and the phone, in two views,
one a dimension.

**Feats**, the summary first, as World of Warcraft's and Diablo 3's open:

1. One card: a ring of feats earned of all that count, the rank and how
   many feats the next takes, a bar a segment, and the day so far.
2. **Next up**: the three rungs nearest earned, each with its count, its
   bar and what it unlocks.
3. A row a ladder, grouped by segment: what it last unlocked on a Cell,
   its dots, its count against the next rung. Thirteen rows, not
   thirty-seven tiles. A row opens on its rungs: what each takes and
   gives, and when and which Cell earned it.
4. The secrets.

**Cells**: one Cell alive on a stage and the Cells to pick from; its
record, all six marks with what shows each or what it takes; the pieces
unlocked, and the acts it can do, the ones a feat unlocked first.

## Where it lives

- `stemcells/ledger/feats.ts`: the catalogue and the rules.
  `stemcells/ledger/ladders.ts`: ladders, segments, next up, the rank.
  `stemcells/words/feats.ts`: the words. All shared, and safe for the
  phone.
- Server: `apps/server/src/stemcells/collection/`: what is kept
  (`collection.json` in our state folder: what each Cell wears, the feats
  seen, the deeds), `GET` and `POST /api/stemcells/collection`.
- Web: `apps/web/src/stemcells/collection/`. Phone:
  `apps/mobile/src/stemcells/collection/`, on the web's rules by import.
- The kit: `cell/chosen.ts` holds what the person chose and what is
  unlocked; `looks.ts` wears it first and `acting.ts` casts an unlocked act.
- Art: `art/packs/earned.json` (the pieces drawn for feats, and an outfit
  for each piece of the original's a feat unlocks),
  `art/moves/acts-feats.json`.

## Plan

- [x] `feats.ts`: catalogue, rules, today; `ladders.ts`; tests
- [x] Server: the collection's file, the service, the routes; tests
- [x] Kit: chosen looks, unlocked acts, the stroke; tests
- [x] Art: the earned pieces, the feat acts
- [x] Web: the read and its refresh, the moment, Settings › Collection
- [x] Phone: the same views, the moment, the stroke
- [x] Docs: `cell-art.md`, `interaction.md`
- [x] A Cell's own record: three more marks, the read, the Cells view
- [x] One pass in the lab, captures for the pull request
- [ ] One pass on a phone

## Review

- **Seen**, in the lab on a home of its own with fake providers and
  made-up facts: the Feats view at three points of a crew's life, a ladder
  opened on its rungs, the Cells view with a Cell's record and its
  wardrobe, the acts on the stage, and a feat's card with the rung above.
- **Not seen: the phone.** Its views are the Mac's rules by import and
  pass their types, lint, the Hermes guard and the phone's own suite, but
  nothing here ran them on a device: no simulator runtime was installed.
  The first run on a phone is still owed.
- **The body stays.** A study of the Cell's figure against the pieces and
  acts added here found nothing the body needs: every piece fits the
  slots it has.
- **The toss is the Mac's alone**, so one secret can't be found from the
  phone.
- **The slopes are the first thing to tune.** They are set so a first
  rung falls in a crew's first day and a top is about a year out for a
  heavy crew; a lighter crew will want its own look at them.
- **From review**: no card for what the ledger awards while it still
  reads the past; a read that ran while a dressing choice was on its way
  is dropped; the phone no longer loses one machine's read to another's.
