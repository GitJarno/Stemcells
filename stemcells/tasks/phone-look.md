# The phone wears the Mac's look

The person moves between the Mac and the phone all day. The Mac's
Stemcells has a tuned dark palette and ink ladder (`stemcells/brand/look.ts`,
`slab-gray.md`); the phone still wore T3's stock dark, flatter, its hairlines
faded into the canvas. Wanted: the phone's own theme in dark reads like the
Mac, from the same values, sized for the phone. Its light theme and the named
themes keep T3's palette.

- [x] Find where the phone's theme is made: `lib/mobileTheme.ts`, run by
      upstream's generator under Node into the stylesheet uniwind paints
      (`generated-uniwind-themes.css`) and its runtime copy. No substitute
      reaches the generator, so the seam is in `mobileTheme.ts` itself.
- [x] Palette: T3's dark with `STEMCELLS_OVER_T3_DARK` over it, read from
      `look.ts` (`apps/mobile/src/stemcells/upstream/look.ts`). The phone has
      no frame, so its chrome (sheets, pages) stays the slate, as T3 paints it.
- [x] Hairlines at full strength: `border-subtle` and `separator` take the
      rule (#1e1e1e) where T3's phone fades them to 70 % and 55 %.
- [x] Inks: a reply's words at the web's 90 % (#dedede), bold, headings and
      table heads at full (#f5f5f5); the interface's words (`foreground-
      secondary`) at the web's soft 83 % (#cecece); muted stays T3's #838383.
- [x] Stages in the thread list: working, asking you and done as adaptive
      tokens beside upstream's, T3's colour in light and the Mac's in dark.
- [x] Regenerate the theme files; upstream's theme tests expect the new dark.
- [x] Tests: `upstream/look.contract.test.ts`, `home/stages.test.ts`,
      `tokens.test.ts` (the phone's tokens equal the web's).
- [x] Seams in `seams.md`, `drift` green.
- [ ] Before and after on a simulator (the parent's device pass).

## Review

What changed, in the phone's own theme in dark (before → after):

- Slate (screens, sheets, pages, header, status bar, terminal): #0a0a0a →
  #0d0d0d, the Mac's slate.
- Cards, inputs, code, quotes, controls (`card`, `card-alt`, `input`,
  `subtle`, `secondary`, `md-code-bg`): #111111 → #151515.
- Hover, a skill chip: #141414 → #181818. Your message: #161616 → #191919
  (T3's phone blends its picked-row gray over the message surface, now
  #181818; the blend stays upstream's).
- Rules (`border`, the header's, `md-hr`, quotes): #191919 → #1e1e1e.
  `border-subtle` rgba(25,25,25,0.7) and `separator` rgba(25,25,25,0.55) →
  #1e1e1e. A field's edge: #1e1e1e → #232323.
- A reply's words: #f5f5f5 → #dedede; bold and headings stay #f5f5f5, so
  they now step up as on the Mac.
- `foreground-secondary` (labels, durations, inline code in replies):
  #838383 → #cecece.
- Stage of a row, dark: working sky-400 → #8393FF; input indigo-300 and
  request fuchsia-300 → #FDBE48; the unseen Done emerald-300 → #2AD394.
  Light keeps sky-600, indigo-600, fuchsia-600, emerald-700.
- Follows from the palette: links #3b70f1 → #3d72f2 and the bubble's skill
  ink #4678f2 → #497bf2 (T3's contrast lift on the new ground); Clerk's dark
  palette, which no Stemcells screen shows.

Kept the phone's own: grouped cards (#1a1b1b), 16/23 type, the 20 radius,
touch sizes. Left out:

- The assistant's continuation gap (4 → 8 px) and full-ink inline code: both
  live inside `ThreadFeed.tsx`, upstream's hottest phone file (132 commits in
  90 days) with no seam yet; rule 7 asks for an extension point first.
  Inline code moved from #838383 to #cecece with the secondary tier.
- Failed (#ff6467) and approval (#ffb900) keep the theme's danger and
  warning inks: they are each theme's own, not fixed colours, so a stage
  token would override every named theme's.
- A quieter tertiary: the Mac's mute (42 %) is 3.4:1 on the phone's cards,
  under the 4.5:1 upstream's tests hold the phone's text to.
- Hover, pane chrome, the slab and its margins, the halo, scroll bars,
  `--sc-state-*`, and the 11.5 px type scale.
