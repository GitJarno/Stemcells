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
- **Two windows, two rings**: outer the long window (7d, else monthly),
  inner the session (5h). No figure: the hover has the numbers.
- **The pace is the window's own average**: used ÷ elapsed since it
  opened, read once a tenth of the window has passed and 3% is used. It
  runs out before the reset when that rate empties it first. No history.
- **Per-model windows** ("Weekly · Fable") stop that model, not the plan:
  running short they mark the 7d cell short and name themselves ("Fable
  9%"), never out and never the headline. A spent week of the plan's own
  blocks its session too, as upstream's pool reads it.
- **Names**: upstream's Display name (Settings › Providers), else the
  masked email (`ja…@example.com`), never the full one.
- **One headline**, for the ring's plan only: "You'll limit at 15.40, 45m
  before reset (16.25)", or "Limited until 16.25, in 45m".
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
- [ ] Pull request, check-local, merge

## Review

An independent review found four problems, all fixed with tests: an
instance found its plan by email alone, so a login's Codex workspaces or a
login with no email (a credential fingerprint) mapped to the wrong plan or
none (now keyed as upstream's resolver keys them, pinned against
`collectLimitAccounts`); a model's spent week read as the whole plan out;
a spent week left the session showing room; the page drew an empty row for
a plan with no reset credits.
