# A Cell carries on after a usage limit

With Settings' "Auto-resume limited threads" on, a Cell a usage limit
stopped continues on its own when the limit resets, or when the person signs
in again (`/login`, `claude auth login`). Ported from the earlier Swift
app's `LimitLift`.

## What T3 does today (2026-10-21)

- **Claude** (`ClaudeAdapterV2`, Agent SDK 0.3.276 running the person's
  `claude`, 2.1.306): a refusal becomes the run's `error` item,
  `failure.class: "usage_limit"` with `resetAt` from the refusal's
  `rate_limit_info.resetsAt`. The run fails; the shell reads
  `status: "failed"`, `lastErrorClass: "usage_limit"`, `usageLimitResetAt`.
- **Codex** (`CodexAdapterV2`): the same failure class, `resetAt` from the
  app-server's rate-limit snapshot.
- **Claude Code's own auto-continue never fires under the SDK.** The CLI arms
  its wait only when `isInteractive()`; the SDK runs it in print mode
  (checked in 2.1.306's bundle).
- **The login.** A Claude instance with no `homePath` shares `~/.claude` and
  the keychain item `Claude Code-credentials`; one with `homePath` sets
  `CLAUDE_CONFIG_DIR`, and the item gets a hash suffix of that folder. The
  CLI re-reads the item before a request through a 30 s cache, so a running
  Cell's next request goes out on a new login. Nothing sends one.
- **The screen.** The composer stack shows "Usage limit reached · Resets …"
  with "Resume at reset" and "Snooze until reset"; the send button, on an
  empty composer, is "Resume thread" (sends "Continue where you left off.",
  guarded by `manualContinuationOfRunId`).
- **Upstream's own auto-resume** (`UsageLimitRecoveryWorker`) resumes at the
  reset only once armed: Settings' "Auto-resume limited threads" (off by
  default) or the banner's "Resume at reset". No login trigger, no bounds.

## Plan

- [x] Read upstream's limit path, the CLI's auto-continue gate, the keychain naming
- [x] Server: `stemcells/limitResume` — the decision (pure), the login watch, the loop, the drafts route
- [x] Web: drafts report, the banner's Continue (substitute), the row (timeline substitute)
- [x] Contract tests: shell fields, the continuation guard, upstream's message ids, the substitutes
- [x] Tests: login change → resume; reset → resume; draft holds; refusal cap
- [x] seams.md, with the login read (no secret) as the security note
- [x] Dev-app proof with a simulated refusal
- [x] PRs: the server, then the web
- [x] Review fixes (2026-10-21): the switch gates both paths; cancel wins
      over a snooze; snooze and a 12 h horizon on the sign-in path; logins read
      only for Cells that could go; the guard pinned in our tree; a timeout on
      the login read, wake from wall against monotonic time, fresh ids per
      send; drafts reported from every page; the banner per the switch; no
      unbounded row cache; the trigger worded as signing in again
- [x] Re-proof in the dev app: switch on, sign-in, one resume; switch off, nothing
- [x] Second review: a wake is a gap between looks (hrtime runs through a Mac's
      sleep), and draft lists are heard again after it; single-flight login
      reads; the banner says what will happen; drafts reported beside the
      sidebar, for every layout; upstream's banner actions always shown
- [x] The banner names the reset only, "Carries on by itself at the reset.",
      and only while it will: switch on, not cancelled, a reset still ahead

## Decisions

- One fixed line, upstream's own: "Continue where you left off." Sent with
  `manualContinuationOfRunId`, so the orchestrator refuses it once anything
  ran after the stop: no double-fire with the CLI, upstream's worker or the
  person.
- Only with Settings' "Auto-resume limited threads" on (upstream's
  `autoResumeLimitedThreads`, off by default), for both causes: a resume is
  a model call the person didn't start (the house rule of 2026-10-14). One
  switch, upstream's, already in Settings. Stemcells turns it on once per
  server since 2026-10-29: the person asked that a limit never wait on
  them (`unblocking.md`, decision 1).
- Bounds: one Cell at a time; never over a draft or a snooze; after a start
  or a wake, nothing for 30 s nor before the screens that had drafts have
  reported again (90 s at most); a sign-in only within 12 h of the stop, the
  reset only within 12 h of it; at most 3 refusals per Cell, a send that started nothing counting
  as one. A refusal after a sign-in holds the instance's other Cells until
  the next change or their reset.
- The login watch reads only for Cells a sign-in could still carry on (switch
  on, not cancelled, under the cap, within 12 h), at most every 30 s: the
  keychain item's modification date (attributes, never the secret) or
  `.credentials.json`'s mtime; on a change, `claude auth status --json` for
  the account (email, organisation, plan), kept as a hash. A token refresh
  changes the date but not the account: no resume. A read ends within 30 s,
  and none starts while one is under way.
- Upstream's state is the person's: the switch arms upstream's worker, which
  keeps the reset; "Cancel auto-resume" stops ours too, snoozed or not.
- Nothing ranks accounts, suggests a switch or words a way past a limit.

## Review

- **Proof, dev app** (fake `claude` answering with a limit refusal, its
  own config folder): the banner read "Usage limit reached · Resets …" with
  Continue first. Signing in again (the fake's account changed and its
  `.credentials.json` touched) at 15:57:16; the watch saw the mark move at
  15:57:31 and asked `auth status` once; the continuation went out at
  15:58:11 (the 35 s settle plus a tick). The chat showed "Continued after
  you signed in again", then the Cell's reply; the banner went away.
- **Re-proof after the review, dev app, both PRs together** (the same fake
  `claude`):
  - Switch off: a refusal, then a sign-in at 16:46:18. For two minutes
    nothing ran: no `claude auth status`, no turn, no resume. The banner
    read Continue, "Resume at reset", "Snooze until reset".
  - Switched on in Settings at 16:48:33: one `auth status` for the
    baseline (16:48:35), and the banner read Continue, "Cancel
    auto-resume", "Snooze until reset". A sign-in at 16:48:54 was seen at
    16:49:10 and the Cell carried on at 16:49:50: "Continued after you
    signed in again", then its reply. In the next 150 s nothing more was
    sent or read.
  - A draft from Settings: a second Cell refused, words left in its
    composer, then Settings opened from the rail; a sign-in at 16:54:06
    (seen 16:54:29). Nothing went for the three minutes the page stayed on
    Settings; the page closed at 16:57:24 and the Cell carried on at
    16:59:50, the closed page's list lapsed.
- **A hidden window's timers** (Electron 44, a window shown then hidden,
  throttling on as the main window has it after its first reveal): a 20 s
  interval fired every 20 s for the first five minutes, then once a minute
  (60.0 s gaps). The server's 75 s was too close; it holds a list 150 s.
- **Tests:** `decide.test.ts` (sign-in, token refresh, sign-out, reset,
  Codex, 12 h horizon, upstream armed, opted out, draft, quiet, one at a
  time, refusal cap, a person's message), `LimitResume.test.ts` (the loop
  on a test clock: refusal then sign-in, Codex reset, draft holds),
  `login.test.ts`, `accounts.test.ts`, `drafts.test.ts`, and both
  `limitResume.contract.test.ts`.
- **Left as upstream draws it:** the notice row's icon and chevron are what
  upstream gives any system notice in a work group.
- **Caveats.** The baseline is the account the server first sees while a
  Cell is stopped and the switch is on, so a Cell stopped before the server
  started (or the switch went on) carries on at its reset or by Continue,
  not by a sign-in that came first. The phone shows the plain line.
- **Known gaps.** The phone doesn't report its drafts, so a draft typed only
  on the phone doesn't hold a Cell.
- **Second review.** The first wake check compared the wall clock with
  `Clock.monotonicTimeNanos`, which is `process.hrtime`: on a Mac it runs
  through a sleep, so no wake was ever seen there. A wake is now a gap
  between one look's end and the next one's start, and after it the screens
  that had drafts standing are heard again before any Cell goes; a start
  waits the same way. The reporter moved from the left column, which a
  narrow window's closed sheet and the legacy sidebar don't draw, to
  `AppSidebarLayout` beside the sidebar.
- **Proof after the second review, dev app, both PRs together** (the same
  fake `claude`, switch on): the line under the banner's row read in full,
  "Carries on by itself once you sign in again, or at the reset", at 1400
  and 700 px wide (first drawn in the row's own line, which cut it to
  "Car…"). At 700 px, the sidebar a closed sheet: words in the stopped
  Cell's composer, then a sign-in at 19:54:15, seen at 19:54:17; nothing
  went for the 98 s the draft stood. Cleared at 19:55:55, the Cell carried
  on at 19:55:57, once: "Continued after you signed in again". In the
  normal and the legacy sidebar, typing in a composer reported that chat's
  id, and clearing it an empty list.
- **The banner's line, third review.** "Carries on by itself once you sign
  in again, or at the reset." tied signing in again to carrying on, the
  first thing a person reads at a limit: an invitation to switch accounts
  (the rule of 2026-10-14). It now reads "Carries on by itself at the
  reset." for every provider; the sign-in trigger stays, unsaid. It shows
  only while the reset will carry the Cell on: the switch on, not
  cancelled, a reset named after the stop and not yet passed. A draft and
  the server's refusal cap don't hide it: they hold the server's sends,
  but upstream's worker, armed by the switch, sends at the reset regardless
  (`limitRecoveryCommand` reads no drafts). Whether a draft should hold
  the reset too is a server question, left open.
