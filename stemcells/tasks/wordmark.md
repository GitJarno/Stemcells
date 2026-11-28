# The wordmark and the SC icon

Stemcells gets a mark of its own: `stemcells` set in Outfit SemiBold, and
SC in the same type as the icon. It replaces SC█ everywhere SC█ was drawn,
and the name set in system type where a wordmark belongs.

- [x] Outline Outfit's letters into `stemcells/brand`: the icon's one layer, the wordmark, their paths in `mark.ts`
- [x] Render every brand file again from the new `.icon` (`icons:export`, `actool`, `render-phone-art`)
- [x] The web: the sidebar draws the wordmark; `T3Wordmark` draws SC
- [x] The phone: the header and the loading screen draw the wordmark; `T3Wordmark` draws SC
- [x] The DMG's corner name and the site's header, favicon and share image wear the wordmark and SC
- [x] Tests: the paths stay the files' own
- [x] README, book, seams.md
- [x] Seen in the web app, on the phone, and in the rendered icons

## Review

Done. One icon layer (SC) and one wordmark, both Outfit's outlines; every
icon file is rendered again from the `.icon`. Seen: the web's sidebar (in
upstream's list view; the Cells column draws no name), the phone's header
on the simulator, the macOS, iOS, web and Android icons as rendered, the
DMG background and the site. Not seen: the phone's loading screen, which
only shows while connecting, and the native splash, which changes with the
next phone build.
