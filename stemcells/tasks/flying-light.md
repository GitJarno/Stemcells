# A Flying card wears the light the Mac's composer does

On the Mac a working Cell's composer fills with its provider's colour and a band of light
crosses it once a beat (`composer-glow.md`). The phone's Flying cards are those Cells, so
they wear the same light: the same numbers, colours, curve and beat, taken from the web's
`glow/light.ts` and `motion/beat.ts` rather than copied.

## Plan

- [x] The beat's curve exported from `motion/beat.ts`; the phone's tokens carry the pass, the
      rest and the providers' tones, held to the web's by `tokens.test.ts`
- [x] `glow/kit.ts` takes the light's numbers from the web; `cell/hermes.test.ts` reads it. The
      state the light says moved to `glow/glow.ts`, so `light.ts` is plain numbers the phone can take
- [x] `glow/CardLight.tsx`: the wash from the Cell across the card, the band crossing on the
      wall clock's beat (in step with the Mac's), only on the Flying tab; held while the home
      isn't in front, the app is away or motion is reduced
- [x] Worn by `CellBesideRow`, filling the card from inside its padding: no upstream file changes
- [x] Checks: tests, typecheck, lint, drift, `check-local`
- [ ] On the phone: a build, and a look at Flying in dark and light

## Decisions

- The wash's anchor is the Cell, where the card's light comes from, as the send button is
  the composer's.
- The wash's drift is left out: on the Mac it is stepped twelve times a second to keep its
  cost down, and on a card it is the part no one follows. The band is the motion that says
  something is happening.
- One wave down the whole list: every card's crest crosses the screen at the same moment, as
  every pane's does on the Mac.
