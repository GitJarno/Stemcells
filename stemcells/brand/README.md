# Stemcells' mark

SC█: the letters S and C and a block cursor, Aski's eye, in brand ink
`#EDE9E0` on pure black. It is the Swift app's icon, and every file here is
that one mark: the source is copied, and the rest are rendered from it by
Apple's tools. None is drawn or edited by hand.

| File                                                                                           | What it is                                                                                           | Made by                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `app-icon.icon`                                                                                | The Icon Composer source: `letters.svg` (S, C) and `cursor.svg` (the block, the one glass layer)     | Copied as is from the Swift app's `Resources/AppIcon.icon`, which its icon tool draws as vectors |
| `macos-1024.png`                                                                               | The desktop app's icon: an 824 px body inset 100 px, as macOS before Tahoe draws icons               | `actool`'s macOS rendition (below)                                                               |
| `ios-1024.png`                                                                                 | The phone's splash, and its icon where a build takes a PNG (the iPhone takes `app-icon.icon` itself) | `vp run icons:export`                                                                            |
| `universal-1024.png`                                                                           | The Linux icon                                                                                       | `vp run icons:export`                                                                            |
| `web-favicon.ico`, `web-favicon-16x16.png`, `web-favicon-32x32.png`, `web-apple-touch-180.png` | The web's icons: the tab's favicon, and the touch icon the boot screen shows                         | `vp run icons:export`                                                                            |
| `windows.ico`                                                                                  | The Windows icon                                                                                     | `vp run icons:export`                                                                            |
| `android-foreground.png`                                                                       | Android's launcher, monochrome and shortcut icon: the icon's canvas in the middle 72 of 108 dp       | `stemcells/scripts/render-phone-art`                                                             |
| `android-splash.png`                                                                           | Android's splash: the same frame on black                                                            | `stemcells/scripts/render-phone-art`                                                             |
| `android-notification.png`                                                                     | Android's status-bar icon                                                                            | `stemcells/scripts/render-phone-art`                                                             |
| `phone-widget-mark.svg`                                                                        | The iPhone's Live Activity logo (a template image, tinted by the activity)                           | `stemcells/scripts/render-phone-art`                                                             |
| `mark.ts`                                                                                      | The two layers' paths, for the small mark the web and the phone draw                                 | Copied from the layers; `mark.test.ts` on the web keeps them equal                               |
| `assets.ts`                                                                                    | Which of these replaces each brand file upstream names, and the phone's Android art                  | —                                                                                                |

## Rendering them again

Upstream's exporter renders from whatever `BRAND_ASSET_PATHS` names, and
that list names ours (`stemcells/seams.md`, "Stemcells' mark"):

```sh
vp run icons:export
git checkout -- apps/web/public   # the web serves ours over upstream's copies
```

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

The phone's own art frames the same two layers and lets macOS's SVG
renderer draw them (`sips`):

```sh
stemcells/scripts/render-phone-art
```

Every channel (dev, nightly, prod) gets the same files: Stemcells has one
mark.
