# The left column's rail: the smallest it goes, and the default

T3's left column is either wide or gone. Stemcells adds the middle, a rail
of icons, badges and the foot, and opens on it. Wide is T3's sidebar as it
is; hidden is T3's own. The rail is the Swift app's slim column, ported.

## Plan

- [x] Research: the Swift slim column (what it shows, sizes, what a badge
      does), T3's sidebar (shadcn `Sidebar`, its icon mode, its toggle)
- [x] Design (below)
- [x] Column state: rail or wide, remembered (`stemcells.leftColumn`), rail
      by default; hidden stays T3's own open/closed
- [x] Seams: `<ThreadSidebar />` becomes `<LeftColumn wide={…} />`
      (`AppSidebarLayout.tsx`); the narrow control after `DiskFoot` in
      T3's foot (`SidebarChrome.tsx`)
- [x] The rail: search, new Cell, rule, project badges, rule, settings,
      usage, plans, disk, update, widen
- [x] Badges: T3's project identity (letters, colour, chosen icon), our
      plate, radius and tint; an amber dot while a chat there needs you
- [x] A badge opens its project's first chat; the focused chat's project
      is lit; a tooltip names the project and its chats
- [x] Plans ring: the limit window that binds first, percent left
- [x] Disk gauge: `useDiskFree` and `diskPressure`, as `DiskFoot` reads them
- [x] Contract tests for every upstream behaviour the rail relies on
- [x] Proof: rail, wide, hidden; a badge's dot; no line between the
      rail and the frame (pixels); T3's light theme

## Design

- **Why not the shadcn icon mode.** `collapsible="icon"` is one boolean:
  collapsed is either icon or offcanvas, so rail and hidden can't both be
  T3's toggle. And the icon mode shrinks T3's own list, which has no icon
  form (thread cards, sections). So the rail is our view in T3's sidebar
  slot: while it shows, our sheet sets `--sidebar-width` to the rail's
  width on the sidebar, T3's sidebar stays "open", and T3's shortcut and
  trigger hide and show it as they always did. Hidden comes back to
  whichever of rail or wide was last.
- **On a phone width** T3's sidebar is a sheet; the rail is for the
  window, so a phone gets T3's sidebar.
- **Settings** swaps the column for T3's settings list, at its width; back
  from settings, the rail returns.
- **A badge does what the Swift slim column's did:** it opens the
  project's first chat: the one waiting longest on you, else the newest
  working, else the newest done. Opening a chat is going to its route, so
  the workspace does what it does for a chat picked in T3's list: focuses
  the pane already showing it, or shows it in the focused pane.
- **Which projects:** T3's project groups, in T3's order (the manual
  order the wide list's drag sets, or T3's sort), with at least one open
  chat: not archived, not settled, not snoozed, not a subagent, not
  Aski's (Aski has its own tab).
- **The mark** is T3's: the person's chosen letters, icon or emoji and
  colour, else the letters and colour T3 derives from the name. A favicon
  T3 would show gives way to the letters, as on the Swift column: two
  letters read at a glance, a dozen framework logos don't.
- **The foot** reads what the wide foot reads: T3's settings, usage and
  update controls, our disk reading, T3's usage limits (the ring).

## Review

- Shown in the browser against the dev server (`pnpm dev`, headless
  Chromium): the rail is the default at 48 px; Widen and Narrow move
  between it and T3's sidebar at its own width; T3's button hides and
  shows the rail, and a reload keeps the rail. A badge opens its chat (and
  its tab), New Cell opens a tab, Search opens the command palette.
- A Cell running `sleep 25` read "1 working" in its badge's tooltip; on
  Aski's tab no badge is lit. The dot is needs you only, as on the Swift
  column (`RailProjects.swift`, `RailProjectTile`): a glance surface shows
  only what asks for the person, and a working Cell doesn't.
- No line between the rail and the frame on Stemcells' theme: the rail
  reads 3/255 (T3's sidebar grain), the gutter 0, the slate 10, and no
  column between them is brighter than its neighbours. On T3's light
  theme the sidebar keeps T3's border, as #20 decided for themes whose
  frame is the canvas; the rail looks right there.
- Hidden: the tab strip now starts after T3's sidebar button, which stood
  over Aski's tab before.
- Not proven: the desktop build (traffic lights over the rail's top; the
  strip's room is computed from `--workspace-titlebar-content-left`, the
  same variable T3's own headers use).
