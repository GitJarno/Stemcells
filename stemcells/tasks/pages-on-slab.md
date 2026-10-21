# Every page on the slate

The rail and the slate never go away; a page is painted on the slate.
Settings stops swapping the left column for its own list: T3's section list
sits inside the slate, at its left edge, beside the panel.

- [x] Upstream's inset is the slate on every page that is not the workspace:
      the frame (band over it, gutters round it) is painted once, behind the
      rail and the pages, in T3's grain.
- [x] Seam: `AppSidebarLayout` keeps the left column on `/settings/*`
      (the legacy sidebar keeps upstream's settings list).
- [x] Seam: `routes/settings.tsx` lays its panel out on the slate: T3's
      `SettingsSidebarNav` at the slate's left edge, the panel beside it,
      no breadcrumb bar; the restore button moves to the panel's top row.
- [x] Narrow slate: the list becomes one row at the top (a menu of sections).
- [x] The rail's cog lights on `/settings/*` and takes you back when pressed
      again (Esc already does); the disk gauge lights on Settings › Disk.
- [x] Audit `/usage`, Settings › Disk, `/projects/$key` (redirects to
      Settings › Projects), `/pull-requests`, Settings › Archive, the empty
      states.
- [x] Contract tests for what the CSS and the seams read; rows in seams.md.
- [x] Proof: Settings › General and Disk, wide and narrow, beside plain T3.

## Review

Done. The frame is the sidebar wrapper, painted with the chrome colour and
upstream's grain token, so the rail, the band over the slate and the
gutters are one ground; the old body grain never showed (the boot page's
`background` shorthand clears it). Upstream's inset is the slate on every
page that is not the workspace, by CSS alone: Usage, Pull Requests,
Archive and the empty states needed no edit. Settings took two seams and a
mock in one upstream test; `AppSidebarLayout` and the route stay upstream's.

Left open: the Electron window's drag region. Settings lost its header
bar, and with it the bar's drag region; the window still drags by the
rail's top, as on a chat, whose strip band has none either. The band wants
one on every page, in its own PR.
