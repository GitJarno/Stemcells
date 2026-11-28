# Stemcells' marks

Two marks, both set in [Outfit](https://github.com/Outfitio/Outfit-Fonts)
SemiBold (weight 600, SIL Open Font License) and outlined from the font, never
drawn: the wordmark `stemcells`, lowercase, tracked −0.04 em, with Outfit's
alternate t (`ss01`, its foot curving right); and the icon SC, tracked −0.03
em, cap to baseline 40% of the icon's side. Both in brand ink `#EDE9E0` on
pure black. The icon's source is `app-icon.icon`; every other icon file here
is rendered from it by Apple's tools.

| File                                                                                           | What it is                                                                                           | Made by                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `app-icon.icon`                                                                                | The Icon Composer source: one layer, `letters.svg` (S, C)                                            | Outfit's outlines (below)                                         |
| `macos-1024.png`                                                                               | The desktop app's icon: an 824 px body inset 100 px, as macOS before Tahoe draws icons               | `actool`'s macOS rendition (below)                                |
| `ios-1024.png`                                                                                 | The phone's splash, and its icon where a build takes a PNG (the iPhone takes `app-icon.icon` itself) | `vp run icons:export`                                             |
| `universal-1024.png`                                                                           | The Linux icon                                                                                       | `vp run icons:export`                                             |
| `web-favicon.ico`, `web-favicon-16x16.png`, `web-favicon-32x32.png`, `web-apple-touch-180.png` | The web's icons: the tab's favicon, and the touch icon the boot screen shows                         |
| `web-icon-192x192.png`, `web-icon-512x512.png`                                                 | The icons an installed web app wears (the web manifest's)                                            | `vp run icons:export`                                             |
| `windows.ico`                                                                                  | The Windows icon                                                                                     | `vp run icons:export`                                             |
| `android-foreground.png`                                                                       | Android's launcher, monochrome and shortcut icon: the icon's canvas in the middle 72 of 108 dp       | `stemcells/scripts/render-phone-art`                              |
| `android-splash.png`                                                                           | Android's splash: the same frame on black                                                            | `stemcells/scripts/render-phone-art`                              |
| `android-notification.png`                                                                     | Android's status-bar icon                                                                            | `stemcells/scripts/render-phone-art`                              |
| `phone-widget-mark.svg`                                                                        | The iPhone's Live Activity logo (a template image, tinted by the activity)                           | `stemcells/scripts/render-phone-art`                              |
| `wordmark.svg`                                                                                 | The wordmark                                                                                         | Outfit's outlines (below)                                         |
| `mark.ts`                                                                                      | SC's and the wordmark's paths, for the marks the web and the phone draw                              | Copied from the files; `mark.test.ts` on the web keeps them equal |
| `assets.ts`                                                                                    | Which of these replaces each brand file upstream names, and the phone's Android art                  | —                                                                 |

## Outlining the letters again

`letters.svg` and `wordmark.svg` are Outfit's glyphs as paths, set by
opentype.js from the variable font instanced at weight 600 (Google's static
SemiBold drops `ss01`): `fonttools varLib.instancer Outfit[wght].ttf wght=600`,
then each glyph's `getPath` with the font's kerning and the tracking above.
Change the type only by setting it again this way.

## Rendering them again

Upstream's exporter renders from whatever `BRAND_ASSET_PATHS` names, and
that list names ours (`stemcells/seams.md`, "Stemcells' mark"):

```sh
ICON_COMPOSER_TOOL="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool" \
  vp run icons:export
git checkout -- apps/web/public   # the web serves ours over upstream's copies
```

Without `ICON_COMPOSER_TOOL` the exporter searches `/Applications` for
Icon Composer, which can take minutes.

The command line can't export macOS's pre-Tahoe icon, so `macos-1024.png`
comes from `actool`, which renders the same `.icon` to a full macOS icon set:

```sh
mkdir -p /tmp/sc-icon/out && cp -R stemcells/brand/app-icon.icon /tmp/sc-icon/AppIcon.icon
xcrun actool --compile /tmp/sc-icon/out --platform macosx --minimum-deployment-target 11.0 \
  --app-icon AppIcon --standalone-icon-behavior all \
  --output-partial-info-plist /tmp/sc-icon/partial.plist /tmp/sc-icon/AppIcon.icon
iconutil -c iconset /tmp/sc-icon/out/AppIcon.icns -o /tmp/sc-icon/AppIcon.iconset
cp /tmp/sc-icon/AppIcon.iconset/icon_512x512@2x.png stemcells/brand/macos-1024.png
```

The phone's own art frames the same layer and lets macOS's SVG
renderer draw them (`sips`):

```sh
stemcells/scripts/render-phone-art
```

Every channel (dev, nightly, prod) gets the same files: Stemcells has one
mark.
