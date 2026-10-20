# The app says Stemcells

Where a person reads the app's name, it says Stemcells, through upstream's
own branding (`APP_BASE_NAME`) wherever a view already names the app, and
the fewest seams for the rest.

## Plan

- [x] `stemcells/brand/name.ts`: the one name; `brand/Wordmark.tsx`: the
      name set in type for the sidebar and the welcome wizard
- [x] `branding.ts`: `APP_BASE_NAME` falls back to our name (browser title,
      auth and pairing screens, not-found page, error report)
- [x] Sidebar's top-left reads Stemcells (`SidebarChrome.tsx`)
- [x] Welcome wizard's heading, Integrations' "Open links in" and pull
      request rows, the boot page's title, the web manifest
- [x] Contract test: the sidebar and the window title never say T3 Code
- [x] seams.md, drift, tests, lint, typecheck; headless screenshot

## Review

- Upstream already had the seam: `APP_BASE_NAME`. The desktop app hands
  the web its own name, so the window, menu and About panel, and every view
  that reads `APP_BASE_NAME`, already said Stemcells in the app; a browser
  fell back to "T3 Code". Now it falls back to ours.
- Eight more upstream files (50 in all, past the seam budget of about 30);
  all but `IntegrationsSettings.tsx` (41) and `WelcomeWizard.tsx` (33) are
  cold. The rest of upstream's ~90 web sentences that write "T3 Code" stay,
  listed in seams.md with the upstream offer that retires them.
- Proved headless against `pnpm dev`: the sidebar reads Stemcells, the
  title is "Stemcells (Beta)" while booting and "Stemcells (Dev)" after,
  the pairing screen and Settings › Integrations name Stemcells, and no
  "T3 Code" shows on the chat page.
- The web unit suite: three files fail, none touched here and none for a
  reason this change reaches (a temp path in `bundledDev`, Node's
  `localStorage` in `promptStashStore`, React Compiler bailouts in Aski's
  and the disk's files in `reactCompilerCoverage`). The browser suite needs
  a Chromium build this machine lacks; no browser test names the changed
  strings.
