# Answers by words (aski-room, slice 5)

What you type or dictate into Aski's composer answers the cards beside it
(`aski-room.md`, decisions 6 to 8 and "The dictation grammar"). Before you
press Enter, the cards light up and one readout line says what Enter will
do. Enter puts each answer into its card's hold, and what's left goes to
Aski. The ambiguity read waits for prompt-smarts' structured operation
(slice 4).

## Plan

- [x] The reader (`needs/answers/read.ts`), pure: anchors by number, number
      word, ordinal, "four N", Cell name and list; the answer by option
      number, title, yes/no, fixed verb, reply and free text. Never allows;
      a Cell never sees our numbers.
- [x] The reader's fixture table, drawn from the doc's examples, with card
      titles taken from `cardOf`, never typed in.
- [x] The readout line: what each part does, in the card's own words.
- [x] Aski's composer: the parts inked, the cards lit ("from your words",
      "needs your click"), and the readout line in the model picker's place.
- [x] Enter: resolved parts into their holds, "needs your click" left lit on
      its card, unresolved words kept in the composer, marked, and the rest
      sent to Aski.
- [x] Prompt-smarts' reader can skip our parts: `readAnswers(text, openCards()).spans`
      (`ReadContext.skip`, in their slice 7). Enter registers under the
      "answers" turn of the composer's send slot (#134).
- [x] Proof in the dev app: typed answers to a permission, a question and a
      prose card; the readout; Enter; Undo; dark and light.

## Review

- The reader is pure and reads on every keystroke: 77 fixture tests, the
  doc's table among them, with card titles taken from `cardOf`.
- Proven in the dev app against live Cells (a Codex question, a prose
  question, a supervised command, three limits): the ink, the lit cards,
  the readout in the picker's place, Enter (two holds, a click left lit,
  the rest sent to Aski), words that answer nothing kept, Undo, light,
  narrow, and the whole line opened from a cut-short readout. Shots:
  `aski-answers-*.png` in the pages folder.
- A note or reply runs to its sentence's end: "6 no, run nothing, and tell
  me what each Cell is on" sends all of it as the note. The readout shows
  it before Enter; a full stop splits it.
- Left for later: the ambiguity read (slice 4), and "1a"/"1b" for a card
  with several questions.
- Follow-up: an answer read from words that wasn't sent (the Cell was
  answered elsewhere first, or nothing could be sent) gives its words back
  to Aski's composer, once, and its card says so. Once a command has gone,
  the words stay out: they would answer twice.
- How they come back (`needs/answers/giveBack.ts`):
  - [x] Each answer on a line of its own, so a reply can't run on into the
    next card's words ("for 1 later for 2 later" read as one reply). A
    test gives back every shape in the reader's tests, alone, together and
    reversed, into an empty composer and after half-typed drafts, and
    reads the same answers again.
  - [x] "for 3 …" only while 3 is still that card on the live list and
    the line reads as the same answer; else "Pip › no", which answers no
    card. Numbers start again at 1 once the list empties, and two Cells
    can share a name, so neither is a sure address for words said
    earlier. A test gives "3 no" back after 3 became another Cell's.
  - [x] Chips, code and line breaks come back as the document held them,
    not as "￼" or a typed newline.
  - [x] They wait in their hold, which stays for them, until Aski's
    composer is there, the list is live, and no message to Aski is on its
    way (upstream puts a failed send back only into an empty composer).
  - Left as typed words are: words that came back under their number sit
    in the composer like anything typed, so if that card later leaves and
    the list starts again at 1, the readout names the new card's Cell
    before Enter (decision 3).
