# The tab strip on the traffic lights' line

On a Mac the tab strip's words, Cells and + stood about 8 pt above the
middle of the traffic lights. In the Swift app the lights, the sidebar
button, the tabs and + share one centre line, and the tab on stage rises
from the slate to it.

Cause: the strip was the window's top 36 px (TabStrip's `h-9`), so its
middle was 18 px down. Upstream seats the lights on the middle of its 52 px
topbar (`DesktopWindow.ts`, 26 pt, moved again at each zoom so it stays
26 px in the page) and centres its sidebar button there too.

- [x] One line, from upstream's own properties: `--stemcells-controls-line`
      is `--workspace-controls-top` + half `--workspace-topbar-height`
      (`pages/frame.css`). No upstream file changes; the lights stay where
      upstream puts them.
- [x] The band derives from it: the line plus half the strip's row
      (`--stemcells-strip-row`, TabStrip's `h-9`), 44 px on a Mac. The strip
      keeps its row as its content box and takes the air over it as
      padding, so `TabStrip.tsx` is untouched. The tab on stage still
      reaches the slate by half the row less the tab.
- [x] A contract test pins upstream's line: the desktop app's topbar
      height equals the page's, the lights' seat at each zoom, and the
      sidebar button's row (`upstream/controlsLine.contract.test.ts`).
- [x] A browser test renders the strip on the frame and finds Aski's tab
      and the new-tab button on the line, at a Mac's topbar and at Windows'
      40 px caption strip (`upstream/controlsLine.browser.test.tsx`); on
      main it fails, 8 px off.
- [x] Measured in the never-shown desktop lab: the lights' real AppKit
      frames against the captured page.

## Review

Measured in the lab, centres down from the window's top in points: the
lights' from AppKit's own button frames, the rest from the page's capture
(the ink of each label, Cell and icon).

|                           | lights | sidebar button | labels    | Cells     | +    |
| ------------------------- | ------ | -------------- | --------- | --------- | ---- |
| before, 100%              | 26.0   | 26.0           | 18.0      | 17.5–18.2 | 18.0 |
| before, 120%              | 31.0   | 31.0           | 21.5–22.0 | 21.5      | 21.5 |
| after, 100%               | 26.0   | 26.0           | 26.0–26.2 | 25.5–26.2 | 26.0 |
| after, 120%               | 31.0   | 31.0           | 31.0–31.5 | 31.2      | 31.5 |
| after, 91%, column hidden | 24.0   | 23.8           | 23.2–23.8 | 23.8      | 23.8 |

Checked in each: Aski with its count of what needs you, a Cell's tab on
stage and one off it, each with its Cell, and +; the column as the rail,
wide, and hidden. What is left off the lights' centre, half a point to
0.8, is upstream rounding the lights' seat to a whole point at a zoom and
the text's own pixel snapping.

Full screen (no lights) can't be entered in the lab, which keeps windows
hidden; the page's full-screen state was sent instead. The strip stays on
upstream's sidebar button, which keeps its line there too.

Every page's slate now starts 44 px down rather than 36, the band's new
foot, the same on a chat and on Settings.
