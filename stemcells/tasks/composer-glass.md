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
