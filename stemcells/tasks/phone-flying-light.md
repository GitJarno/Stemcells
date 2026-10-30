# The phone's composer flies

While a Cell works, T3's phone floats a capsule over the composer: "Flying
23s". The person asked for the Mac's way instead: the composer itself wears
the Flying light (2026-10-30). The capsule does more than tell the time: it
holds queued messages, Subcells, reconnect, a Subcell asking and background
work, each a tap. Those stay; only the plain timer goes.

## Plan

- [x] `glow/Wave.tsx`: the home cards' light (wash and band, on the wall
      clock's beat, in step with the Mac's), lifted out of `CardLight.tsx`
      so a card and the composer share it.
- [x] `glow/ComposerLight.tsx`: the light in the composer while its chat is
      busy, held still while the chat is out of sight or motion is reduced.
      The composer's substitute tells it the chat; one seam in upstream's
      composer surface lays it between the glass and the field.
- [x] A substitute of `floating-working-control.tsx` drops the working
      status, so the capsule shows only when there's something to tap.

## Review

Typecheck and the substitutes' contract pass; the views can't load in
Node, so the look is checked on the phone.
