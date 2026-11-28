# Plan limits: every plan at a glance

The person runs Cells on several plans (2 to 10 accounts across Claude,
Codex and the rest) and hops to another before one runs out. They need one
glance for the plan they're on, and one place listing every plan: what is
left, when it resets, and whether the pace so far runs out first.

## Decisions

- **A plan is an account**, as upstream's Usage page merges them
  (`collectLimitAccounts`): instances signed in to one login are one plan.
- **The ring shows the plan you're on**: of the plans a Cell is working
  on, the one in the worst state; with none working, the plan of the chat
  touched last. The binding plan of all would always be red for someone with
  ten plans, where an empty one is just the one they hopped off.
- **One ring, one figure** (2026-11-28, after Claude's app): the ring fills
  to what the plan's binding window (the one that stops it first) has
  used, the percent inside; once out, the wait until it frees ("45m").
  Used, not left, everywhere: the ring, the card and the page read alike.
- **A click opens the card**, not a hover: "Limits", the headline, then a
  block per plan, the ring's plan first and then the most room, so the next
  plan to hop to sits under the one you're on; out plans last. Each block a
  row per window: Session, Week, then each model's own week by name.
- **The pace is the window's own average**: used ÷ elapsed since it
  opened, read once a tenth of the window has passed and 3% is used. It
  runs out before the reset when that rate empties it first. No history.
- **Per-model windows** ("Weekly · Fable") stop that model, not the plan:
  running short they mark the 7d cell short and name themselves ("Fable
  9%"), never out and never the headline. A spent week of the plan's own
  blocks its session too, as upstream's pool reads it.
- **Names**: upstream's Display name (Settings › Providers), else the
  masked email (`ja…@example.com`), never the full one.
- **The plan you're on leads the card** (2026-11-28, a design pass after
  the first card read cramped): the ring you tapped, grown, beside where
  the plan stands in two lines ("Runs out Sun 15.40" over "45m before it
  resets Tue 16.25"; "Limited until 16.25" over "Frees in 45m"; else when
  it resets), then its windows. The other plans follow under their own
  heading, and Usage closes the card. A window is two lines, never a
  squeezed four-column row: its name, when, and the percent, then the bar
  under them. On the phone each plan is a card of the app's grouped kind,
  kept to a reading width on a wide sheet; on the Mac's card the plan
  you're on is the one card and the rest sit under it.
- **The page**: the same rows replace upstream's pooled limit cards (a
  substitute for `UsageLimitsPooled`); its notices, links and the reset
  credits stay upstream's.

## Plan

- [x] Adapter `upstream/limits.ts`: accounts, instance → plan, Cells working
- [x] `limits/plans.ts`: readings, projection, ring plan, headline, names
- [x] Tests: projection, tones, windows chosen, ring plan, headline, mask
- [x] Ring + hover card on the rail
- [x] Usage page substitute, contract test, seams.md
- [x] Typecheck, lint, tests, drift; a capture of the real components
      rendered with sample plans (no dev app: the disk was near full)
- [x] Pull request, check-local, merge (#273)

## One ring and a card (2026-11-28)

- [x] `plans.ts`: card rows, the binding window, the ring's figure, the
      card's order; the pure half of `upstream/limits.ts` in
      `upstream/limitAccounts.ts`, for the phone
- [x] Mac: the ring with its figure, a click opens the card; the page in
      the same blocks
- [x] Phone: the ring in the chat's bar (iOS; Android's bar is T3's) and the
      home's, the card in a page sheet
- [x] Browser test; captures on a lab phone and the Mac's card
- [ ] Pull request, check-local, merge

## Review

An independent review found four problems, all fixed with tests: an
instance found its plan by email alone, so a login's Codex workspaces or a
login with no email (a credential fingerprint) mapped to the wrong plan or
none (now keyed as upstream's resolver keys them, pinned against
`collectLimitAccounts`); a model's spent week read as the whole plan out;
a spent week left the session showing room; the page drew an empty row for
a plan with no reset credits.
