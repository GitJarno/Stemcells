# The dock's halo stops at the ledge

the person, on the dark fade above a chat's composer: "The shadow overlay to make
the critter more visible is too tall imo, it feels distracting." The halo
covered the box, the ledge and the Cell, and reached 24 px past the Cell's
head: a band of dimmed text the pane's width, 52 px above the ledge.

## Plan

- [x] The halo's top follows the dock's top, not its block's: the ledge's
      top in a Cell's pane, the box's where no ledge shows (Aski's perch, a
      pane with no line). An anchor in the block (`glow/glow.css`), so each
      pane's halo finds its own; reach plus `--sc-halo-fade-top` above it.
      A browser without `anchor()` keeps the old geometry.
- [x] The Cell and its buds on the ledge, and Aski on its perch, wear a
      glow in the page's colour round their own shape
      (`--sc-figure-glow`), nothing over the bare page.
- [x] `glow/halo.test.ts` pins the halo's top and the glow;
      `composer-layout.md` says the new rule.
- [x] Proof in the never-shown desktop lab, on invented chats.

## Review

Measured in a 1100x780 lab window, chats scrolled so text runs behind the
Cell and the ledge:

| Pane                     | Halo top before      | After              |
| ------------------------ | -------------------- | ------------------ |
| Claude Cell, wide        | 52 px over the ledge | 16 px              |
| Narrow (259 px), stacked | 52 px over the ledge | 16 px              |
| Draft (ledge, no Cell)   | 24 px over the ledge | 16 px              |
| Aski's pane              | 85 px over the box   | 16 px over the box |

Full strength starts 8 px over the ledge (36 px before). The text beside
the Cell's head reads at full strength; the glow darkens only the glyphs
within a few pixels of the Cell's outline, and over the bare page it is
within one level of the page. The scroll-to-end pill keeps its place and
reads; banners and upstream's stash tab sit inside the box, under the
halo either way. At a chat's end its last row, where the working row and
its verb wave stand, ends 58 px above the halo's top (22 px before).
