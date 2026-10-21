# The phone wears SC█

The phone still shows T3's marks after the web and desktop changed. This
change replaces them from our side: substitutes for the views and two seams
for the build's art.

- [x] Move the mark's paths to `stemcells/brand/mark.ts`, so the web and the phone draw one glyph
- [x] Substitute `T3Wordmark` (the work log's glyph) with SC█
- [x] Substitute `CompactBrandTitle`: the header shows "Stemcells" in type, like the web's sidebar
- [x] Substitute `BrandMark` and `brandAssets`: the loading screen shows our icon and "Stemcells"
- [x] The Live Activity's `T3Mark` image comes from our SVG (one seam in the widget plugin)
- [x] Android's launcher, monochrome, notification and splash art, rendered from the `.icon`'s layers (one seam in `app.config.ts`)
- [x] A contract test fails when a T3 mark ships on the phone again
- [x] seams.md, the brand README, and proof shots

## Review

Done. The phone's builds take our icon, splash and Android art for every
channel, the Live Activity's logo is ours, and its views draw SC█ or say
"Stemcells" where T3's mark was. Two seams (`app.config.ts`, the widget
plugin), four substitutes. `brandMarks.contract.test.ts` fails on each of:
the config seam reverted, the widget seam reverted, the wordmark or the
loading screen's image left unsubstituted. The app wasn't run on a device;
the proof is the art as Android and iOS draw it, rendered from the files.

Still T3's: the phone's name outside the lockups (home screen, Settings,
widget descriptions), which is the app's name, not its mark.
