# A question's option previews

When a Cell asks a question through its provider's question tool, an option
can carry a `preview`: an ASCII mockup, a snippet, a diagram or a config to
look at before choosing. The wire carried it and no client drew it, so a
choice between two layouts arrived as two lines of words.

## Plan

- [x] One rule for how a preview is drawn, shared by the Mac and the phone
- [x] The web's question panel: the highlighted option's preview, beside
      the options or under them
- [x] The web's need cards (the Cells' column, Aski's room): the same box
- [x] The phone's chat card and the phone's asks: the picked option's
      preview, seen before the answer is sent
- [x] The needs wire carries `preview`
- [x] Contract tests: the wire and the Claude adapter still carry it, and
      upstream's panel still hands us a row per option
- [x] Captures: the panel wide and narrow, before and after

## Where a question is answered

| Place                                   | Whose | How it shows a preview                                    |
| --------------------------------------- | ----- | --------------------------------------------------------- |
| The chat's question panel (web)         | T3's  | A seam: the options stand in our element                  |
| A need card (web: the column, the room) | ours  | The same box, in `needs/NeedCard.tsx`                     |
| The chat's question card (phone)        | T3's  | A seam: an option draws our element under its description |
| An ask on the phone's home              | ours  | The same element, in `line/Ask.tsx`                       |
| Aski's own chat                         | T3's  | It is upstream's chat: the panel above                    |
| The desktop app                         | T3's  | It wraps the web: nothing of its own                      |

The need cards read our own wire (`GET /api/stemcells/needs`), which named
an option's label, description and value only. It now carries `preview`
too; a reader takes a server from before it as sending none.

## Decisions

- **Fenced is markdown, unfenced is drawn as written.** The tool calls a
  preview markdown in a monospace box, and what agents put there is
  preformatted: mockups, code, configs. Markdown runs an unfenced mockup's
  lines together, drops their indents and reads a rule of dashes under a
  line as a heading. So a preview with a code fence goes to the app's own
  markdown renderer, and one with none is drawn exactly as written, in the
  same box (`previews/preview.ts`, `previewOf`). Unfenced prose with
  `**bold**` in it shows its asterisks; that is the cheaper mistake.
- **Web: the highlight is the option pointed at or focused.** A click on an
  option answers at once, so the preview can't wait for one. It starts on
  the first option that has a preview. The box names the option it shows,
  as the pointer may have left the rows.
- **The box never changes height.** Every preview is laid out in one grid
  cell and only the shown one is visible, so the box is as tall as the
  tallest, each capped at 14rem and scrolling inside itself. No measuring,
  no effect, nothing animated.
- **Beside or under by the box's own container**, not the window: two
  columns from 36rem, one under it, so a 300 px pane stacks.
- **Phone: the picked option shows its preview.** Upstream's card already
  parts picking from sending (Submit answers), so the picked option's
  preview is seen before it is committed to; one not picked says "Tap to
  preview". Our own asks answered a lone question on its tap: with a
  preview a tap picks, and Send answers sends.
- **A seam in each upstream file, not a substitute.** Which option is
  pointed at, and where an option's row ends, are known only inside
  upstream's two files: a wrapper around either could only learn them by
  reading the DOM. Both files are cool (29 and 26 commits in 90 days). The
  web's is an import on its first line and one element in place of the
  options' `div`, which it still is when no option has a preview; it wraps
  each row in a boxless element to hear the pointer and the focus, so it
  reads no DOM. The phone's is an import and one element.
- **Any question, not only single-select.** Claude sends previews on
  single-select questions only; nothing here depends on that.

## Other providers

Only Claude's adapter fills `preview` today (`claudeUserInputQuestions`).
Codex's and Antigravity's build their questions without one, and no other
adapter (Cursor, Grok, OpenCode, Kiro) names the field, so their questions
draw as before. An adapter that starts sending it needs nothing more here.

## Left

- A browser with no pointer to hover (the web on a tablet) shows the first
  preview only: a tap on another option answers. The phone app shows each.
- The phone was not run on a device or a simulator: its types check and
  its suite passes.

## Review

The panel's browser test renders upstream's panel through the seam: no
box without previews; the box follows the pointer and the focus; its
height is the same on every option, with a 60-line preview scrolling
inside; beside the options at 720 px and under them at 300. Captures of
the same render, before and after, are in the pull request. A need card
was captured the same way, in the Cells' column.
