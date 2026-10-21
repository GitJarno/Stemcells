# The band drags the window

The band over the slate is the window's title bar on every page. Settings
lost its header bar when it moved onto the slate (`pages-on-slab.md`), and
with it the bar's drag region; a chat's strip never had one. The window
dragged by the rail's top alone.

- [x] One box across the window's top, the band's height, as the frame's
      first box (`pages/frame.css`): Electron reads app regions in document
      order, the later over the earlier, so whatever stands in the band
      after it keeps its own region.
- [x] The tab strip's tabs and button cut themselves out; its bare end
      drags.
- [x] Our full-window overlay (the media viewer) cuts itself out, as
      upstream's dialogs do.
- [x] Checked: nothing upstream declares a region before the wrapper; every
      region in the band comes after the band, on a chat and on the pages.
- [x] A test for our sheets, and a contract that the column and the page
      render inside the wrapper.

## Review

Done in CSS: a `::before` on upstream's sidebar wrapper, with no TSX and
no seam. The order rule is Electron's own (`shell/browser/ui/drag_util.cc`:
"the later rect wins"), over Blink's walk of the layout tree, where the
wrapper's `::before` is its first child. Headless checks show the band
first and every control in it after it as no-drag, with clicks still
landing on the controls. Not yet seen in the desktop app: that waits for
the never-shown lab.
