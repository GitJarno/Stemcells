# A Cell switches Claude accounts without losing its thread

When a plan runs out, the person's first move is "can I /login?". Today a
Claude thread can't follow a second account: each account is an instance
with its own config folder, and switching to it starts a new session with
a budgeted excerpt of the history. Codex threads already keep the whole
thread across accounts (a shared Codex home with shadow homes).

The first slice of the plans proposal, chosen by the person on 2026-10-27
("Smallest first"): the lossless Claude switch, and `/login`. The fallback
chain (API credits, another provider, wait) comes later.

## Decisions

- **The conversation isn't the account's.** Claude Code keeps the
  transcript in the config folder on disk; an account only pays for the
  next turn. At a switch, the session's transcript is copied into the
  target account's folder and resumed by id: every message, tool call and
  result arrives. The cost is one cold read of the thread on the new
  account.
- **Thinking across accounts.** Anthropic drops Sonnet 5.5 and Haiku 5.5
  thinking blocks sent by another account (the request still succeeds);
  other models' blocks carry over. Nothing to strip on our side.
- **Only plain logins are compatible.** Two Claude instances share a
  continuation only when both are Claude Code's own login: no router, API
  key, key helper or cloud provider in their environment, their folder's
  `settings.json` or their launch arguments. Routers and API keys keep
  upstream's handoff.
- **A copy that fails is a resume that fails.** The transcript is copied
  just before upstream resumes, so a failed copy falls back to upstream's
  fresh session with a handoff instead of a turn that errors.
- **No credentials in our hands.** Claude logins stay in Claude Code's own
  keychain entries, made by its own `claude auth login`. Anthropic: third
  parties "may not collect, store, or intermediate Claude.ai credentials".
- **The person switches.** `/login` and the model picker move a Cell; nothing
  moves one by itself.

## Plan

- [x] Map the restart-and-resume path, the transcript's path, the seams
- [x] Server: compatible continuation for plain-login Claude instances
- [x] Server: carry the transcript into the target folder before the resume
- [x] Review fixes: settings.json routers; the copy at the resume step with
      upstream's fallback; no `/login` in Aski's chat; a signed-out Claude
      account signs in from its row, new folders never reuse one; picking
      is the model picker's own select; the card stays with its chat
- [x] Tests: plain-login check; shared key and upstream's resume in place;
      carry (copy with subagents, A→B→A, newer target kept, nothing found);
      upstream's resume finds the copy; a failed copy fails the resume
- [x] Web: `/login` lists the provider's accounts; picking one switches
- [x] Web: "Add an account" opens the official sign-in
- [x] seams.md, drift, check:changed (knip's failures are main's)
- [ ] Proof: a real switch between two accounts (needs a second login)
- [ ] PR, check-local, merge

## Review

- **The real CLI finds a carried transcript** (2.1.311, no model call): in a
  config folder with no login, `claude -p --resume <id>` said "No
  conversation found with session ID" without the transcript and "Not
  logged in · Please run /login" once it was copied in.
- **Thinking across accounts** is Anthropic's documented behaviour, read,
  not run: Sonnet 5.5 and Haiku 5.5 blocks from another account are
  dropped and the request succeeds.
- **The card**, captured from the real components at phone width: the
  accounts, the Cell's own ticked, "Add a Claude account".
- **Not run end to end**: a turn resumed on a second real account, which
  needs that account signed in on this Mac. Left for the person.
