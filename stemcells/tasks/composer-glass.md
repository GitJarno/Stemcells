# The composer's plate is glass, and the focused chat's comes forward

The composer floats over its transcript as frosted glass, as in the Swift
app: what scrolls under it shows through blurred and a little more
colourful, with a light rim along its top, some depth inside and a quiet
shadow beneath. The focused chat's plate comes forward (denser, lighter,
its rim brighter, its shadow deeper); with the focused pane's ring gone,
that is how you find the chat you're in. A wheel over the plate scrolls the
transcript under it.

## Plan

- [x] Tokens for the glass in `stemcells.css`: blur, saturation, the tint
      as a share of the person's glass opacity, rim, lift, depth, shadow;
      raised values for the focused plate; light and dark
- [x] `glow.css`: upstream's own glass tuned through its variables, so the
      plate, the line on it and the strip under it stay one surface; the
      rim, depth, lift and a box shadow (no filter: it would cut the blur
      off) are ours. Raised for the focused pane, a pane a drop is over
      (#26's hook) and a composer being typed in
- [x] Every composer in a pane of ours wears the glass, a Cell's or not
- [x] A wheel over the line, or over the plate where the field can't move
      that way, scrolls the transcript (`composer/scrollThrough.ts`); the
      field's own scrolling and the pager's sideways swipe stay theirs
- [x] The transcript keeps the line's height clear at its foot, at rest and
      mid-slide
- [x] Contracts: upstream's glass variables, the composer stack taking the
      pointer over the transcript, the line in the measured overlay
- [x] Prove it: over a picture, prose, a table and code; focused vs not
      with four panes and no ring; working vs idle; dark and light; scroll
      cost with four long chats

## Decisions

- Upstream's glass, tuned, rather than a second layer: one backdrop blur
  per plate, and upstream's border and focus handling stay as they are.
- Blur 12 px and saturation 1.8 (upstream: 12 to 16 px, 1.08 to 1.14): text
  under the plate reads as blurred text, colour comes through, and the
  placeholder keeps its contrast. 22 px hid the transcript entirely.
- Focus is carried by density and light, not a colour: unfocused plates
  take 45 % of the glass opacity, the focused one all of it, plus the lift,
  the brighter rim and the deeper shadow.

## Review

- Scroll cost, four panes of long chats at 2x on the GPU, frames uncapped,
  two rounds each: ours 3.8 to 4.1 ms a frame (p95 4.4 to 6.3), upstream's
  stock glass 3.8 to 3.9 (p95 4.7 to 4.8), no backdrop blur 3.2 to 3.8
  (p95 4.1 to 4.6). The blur costs under half a millisecond a frame; the
  few frames over 20 ms showed up in every configuration, the blur-free one
  included.
- Wheel, in the dev app: over the line and the empty field it scrolls the
  transcript both ways; over a long draft it scrolls the draft and leaves
  the transcript; a sideways wheel isn't taken.
- The bottom inset: the line rides in the composer's flow, inside the
  overlay ChatView measures, so the inset includes it. Probed every frame
  through slides between neighbouring tabs (one and two panes, composers
  expanded and compact, at the transcript's end) and onto a tab mounted
  fresh mid-slide: the last row stayed 24 to 87 px clear of the line's top.
  The covered last row seen on a compact composer mid-slide didn't
  reproduce; `composerLine.contract.test.ts` pins what keeps it clear.

## Follow-up: the line stands on clean ground

Scrolled up, the transcript's text ran straight behind the Cell and its
line: the plate was glass, the line above it sat on bare text.

- [x] `composer/dropOff.ts` measures the band from the Cell's head down to
      the plate, up from the transcript's foot, and the room above it the
      transcript keeps clear at its end; it writes them to the pane
- [x] `composer-line.css` masks the transcript's viewport with it: faded out
      across the band, back in behind the plate for the glass to blur. A
      mask on the viewport, not the scroller (upstream's top fade lives
      there) and not the column (the scroll-to-end pill lives there)
- [x] The fade starts no higher than the kept-clear room, so at the end the
      last row is untouched
- [x] Contract: the viewport holds the list alone and shares the overlay's
      foot; unit tests on the band

Review: the same four-pane, scrolled-up shot before and after, dark and
light: every Cell and line stands on the slate, and the plates still blur
what passes behind them. At the end, the last row sits 24 px above the band.
Scroll cost with four long chats, second rounds: 1.84 ms a frame with the
mask, 1.83 without.

- [x] Below the plate, down to the pane's foot, the transcript showed raw
      again. The mask now shows it only inside the plate's own rect,
      between its rounded corners (so no corner shows a fragment), and
      keeps it out below; `dropOff.ts` measures the plate's bottom too

## Follow-up: T3's plate, our light (2026-10-21)

The plate read as a light grey slab with a bright rim, and the provider's
mark was big and present. Asked for: T3's own composer, with our glow.

- [x] The plate is upstream's surface with upstream's glass values: no tint,
      raised tint, lift, rim, depth or shadows of ours (`glow.css` says why
      at the surface)
- [x] The light while a Cell works stays
- [x] The focused pane's cue is a quiet step: in a grid of panes its plate
      takes upstream's input border for its outline; a lone pane keeps
      upstream's outline
- [x] The mark is a watermark: halfway between the plate and upstream's
      accent surface, under the light
- [x] Contract: the outline is upstream's one property, drawn by the plate
      and by the main surface under an attached line

Review: ours next to a plain upstream checkout at the same state (a new
chat, then focused, then working; dark and light, in T3's own themes):
page and plate are the same pixels (dark 10/16, light 252/254) and so is
the edge (dark 28); what differs is the faint mark and our light while
a Cell works. In Stemcells' theme the plate follows upstream's rule for a
themed app.

## Follow-up: one box, a halo (2026-10-21)

The band that hid the transcript from the Cell's head to the pane's foot
read as an opaque black bar. The plate overlapped the line's tray and the
model strip under it: a top border cut off where it met the tray, a stray
white line over the strip, three layers. Asked for: the transcript runs on
behind the composer and out through the pane's foot; a slim halo in the
page's colour, about 60%, fading, keeps the composer clear; one box, as T3's
is; the line just above it, on the ground.

- [x] The band mask is gone (`dropOff.ts` with it). The halo is the
      `::before` of the block that holds the line and the box, in
      `glow.css`: the page's colour at 60%, reaching `--sc-space-md` past
      them and fading out over `--sc-space-xxl`. It was frosted with
      upstream's glass blur at first, so text under the line went soft;
      that read as glass round the line, with a blur under it
      (2026-10-21). Now a plain fade, and only what passes under the box
      blurs (`glow/veil.css`, `glow/halo.test.ts`)
- [x] The line is no longer an attached banner (which gives the plate a
      second surface): it stands just above the box. Seam moves to
      `ChatView.tsx`. Since 2026-10-21 it is a solid ledge on the box,
      upstream's tab filled solid (`composer-layout.md`, the dock)
- [x] One box, one height: the composer never rests into one line on a
      scroll (`substitutes/composerScrollGesture.ts` answers upstream's
      wheel and key gestures with "no"), so model, effort and access stay
      in the plate. The field opens one row high, lower than upstream's
      open field, grows with what is typed up to upstream's cap and comes
      back when cleared; its placeholder keeps to that row at every width.
      Upstream's "Collapse composer on scroll" setting now does nothing
- [x] No sideways jump: upstream widens the lanes' padding from 0.75rem to
      3rem in one step at 640 px, which jumped a pane's composer 36 px on a
      drag. A pane ramps it over its own width, 480 to 800 px
      (`tabs/workspace.css`). A 1 px drag from 1100 to 180 and back moves
      the box at most 1 px a step, never vertically, the same both ways
- [x] The small outlined pill at the window's bottom centre in the
      reported shots: no element of that shape in the source or the built
      bundle, and the dev app never shows it. It is another app's
      dictation bar over the window, not Stemcells
- [x] Contracts: the line before the plate, the plate a stacking context
      with its `::after` free, the composer resting only through the
      gesture the substitute answers, the field's one height class

Review: ours next to a plain upstream checkout, dark and light: a new
chat, focused, working, scrolled and at the end. Scrolled, upstream's
composer shrinks to one line over a strip that lets the text read through
it; ours keeps its height, one box with the text going soft round it. At
the end the last message clears the Cell's head. Every edge and corner
checked in 2x crops of 2x shots: one outline, nothing cut off, no seam.
Where the halo starts fading, an 8-bit rounding step of one level shows
only amplified, or faintly at 3x zoom on a plain light page.
