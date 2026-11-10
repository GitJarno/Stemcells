# Aski's room as a board

Asking Aski "how is it going" cost a turn and came back as prose. The room
had the answer already (`aski-brief.md`): each Cell's stage, how a done
one landed and what shows it. This page decides how the room shows it.

## Decisions

### 1. The board stands where the asks stand

- The room's right half, under the asks' head. It is drawn from the needs
  list's `cells`, the list Aski's report reads, so the board and Aski
  never disagree.
- **Landed** first, then **Flying**. A Cell at Input is an ask already,
  and Settled is the column's.
- A row is one Cell: its figure, its name, what it is on and since when;
  under them its own word behind the landing's mark, then what its run
  shows (the ask's own facts line).
- Landed reads short first, then on its word, then shown: what needs a
  look is on top. Inside each, the newest first.
- A stage shows six rows; past that it says how many more the column has.
- A row opens its Cell in the room's peek.

### 2. An ask in front keeps the reading

While anything waits on the person, the board folds to one line under the
ask: each stage's label and its Cells' figures, the landing's mark at each
one's shoulder. Nothing to read, and a figure still opens its Cell.

### 3. The mark

| Mark | Verdict  | Says                                    |
| ---- | -------- | --------------------------------------- |
| `✓`  | Shown    | a fact shows it                         |
| `~`  | Its word | nothing it ran or opened shows it       |
| `!`  | Short    | stopped, rolled back, or a check failed |

The same mark leads a Cell's hover card wherever a chat names it.

### 4. No frame spent

Figures are held still (`CellMini`): the board paints when the list
changes and never on a clock.

## Slices

- [x] 1. `since` on each Cell's standing: its run's start while it works,
      its end once done.
- [x] 2. `needs/boardRows.ts` (pure) and `needs/Board.tsx`, mounted in
      `NeedsFrame`.
- [x] 3. The mark on a Cell's hover card.

## Review

- Run in a lab on a real server: with an ask in front the board is the
  line of figures; with none it lists what landed and how.
- The phone has no room yet, and its rows are being rebuilt as our own
  components by another plan, so the phone's Landed rows wait for that.
- Cells one message started are not grouped: nothing records which
  message started a Cell. A run of Cells needs that recorded first.

## Next

- A room for Aski on the phone, drawn from the same rows.
- Aski's forms from causes (`aski-shapes.md`, decision 5).
