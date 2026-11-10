# The nightly carries on through a conflict

## Why

The fork's plan is to take upstream small and often (`fork.md`, rule 6): a
launchd job runs `nightly-sync` at 03:00. Upstream lands dozens of commits a
day, and some file of ours conflicts on most nights. The nightly then keeps
its issue, "Upstream sync needs a hand", and stops, and the sync waits days
for someone to run it by hand, in a batch of hundreds of commits. That is the
cost the plan was meant to avoid. Resolving is mechanical (upstream's logic
wins, our seam goes back on top), and the t3-sync skill already does it.

## The design

Strictly opt in, where the nightly's own opt-in lives:

- `install-nightly-sync --cell <project> [--provider <id> --model <slug>]`
  writes the choice into the job's environment. Without it nothing changes;
  an install without it, or `--remove`, turns it off.
- `nightly-sync`: when `sync-upstream --nightly` exits 3 (a conflict) and
  the job opted in, it starts one Cell through the installed app's `t3`
  launcher (`thread start`), with a short message: follow the t3-sync
  skill, the upstream commit, the issue. Then it exits 3 as it always did.
  The issue is kept either way.
- One Cell per upstream commit: `cells/<sha>` in the nightly's own folder.
  A night on the same commit starts none; a new commit may.
- No Cell when a `sync/upstream-*` pull request is open: the skill leaves
  an open sync to its owner, so that Cell would only find that out.
- When the launcher is missing, the app isn't running, or it doesn't answer
  in two minutes: the night ends as before, the log says why, and the issue
  gets a comment. The Cell never changes the night's exit code.
- The Cell ends where a clean night does: a pushed pull request carrying
  `local-check`. Merging follows the skill's step 5 and `stemcells/AGENTS.md`
  (Landing); the skill's stop at "Retire ours" stays.
- The skill gains one section, "When the nightly started you": nothing of
  the nightly's merge is kept, nobody answers, and what needs the person
  goes on the issue before the Cell stops.

## Plan

- [x] Read how a process outside the app starts a Cell
- [x] `sync-upstream`: `SYNC_ISSUE`, the number of the issue a stopped run kept
- [x] `nightly-sync`: the hand-off, its marker, its fallbacks, `--dry-run`
- [x] `install-nightly-sync`: `--cell`, `--provider`, `--model`
- [x] `nightly-sync.test.ts`: the decisions, with every tool stood in for
- [x] The skill's section, `upstream-sync.md`, `fork.md` rule 6
- [x] `sync-upstream --gates drift lint`, and the scripts' tests

## What was read, and what it showed

- **The launcher.** The installed app writes `~/.stemcells/bin/t3` each time
  its server starts (`apps/desktop/src/app/DesktopCliShim.ts`, called from
  `DesktopBackendConfiguration.ts`). It is a shell script holding absolute
  paths: it sets the app's home and runs the app's own executable as Node on
  the bundled server CLI. That CLI has `thread start`
  (`apps/server/src/binCli.ts`, `cli/thread.ts`). So the job needs nothing
  on PATH for it, and no environment of its own. The scripts call it by its
  full path, since T3 Code's `t3` may come first on PATH (`seams.md`, Known
  overlaps).
- **Naming the project.** `thread start <project>` takes an id or a folder.
  For a folder it asks the file system for the real path of every project's
  folder (`resolveProject` in `cli/thread.ts`); an id returns before that.
  The job must not look under `~/Documents` (`nightly-sync` says why), so it
  holds the id. The installer gets it by asking the running app once
  (`thread list --project <folder> --json`, whose rows carry `projectId`),
  which also shows at install time that the launcher, the app and the
  project all answer.
- **Where the Cell works.** `--worktree origin/main` gives it a worktree the
  app makes and sets up, from the project's `origin/main` as last fetched
  (`ThreadLaunchService.ts` fetches only when asked to start from the
  remote, which the CLI doesn't ask). The skill's section has it fetch
  first.
- **The Cell's mode and model.** A thread started from outside takes the
  project's defaults (`mcp/toolkits/project/handlers.ts`). A project whose
  default mode asks before each command leaves the Cell waiting at its first
  one until morning. The runbook says so.
- **Which commit.** A sync that stops on a conflict leaves the merge open in
  its worktree, so `MERGE_HEAD` there is the upstream commit. The skill's
  step 1 picks upstream's newest green commit again, which may be a newer
  one; the marker still counts the commit the night saw.
- **What the issue may say.** The launcher's errors name the home folder,
  and the issue is public: the comment gives a fixed reason and points at
  the Mac's own log, which has the launcher's words.

## What was run

- `stemcells/scripts/nightly-sync.test.ts`: the real `nightly-sync` and
  `install-nightly-sync --print` in a scratch home, against a scratch
  origin, with `gh`, `pmset`, `sysctl`, `pgrep`, `node` and the launcher
  stood in for.
- By hand, in a scratch home: a launcher that never answers. With the limit
  set to 2 s the night ended after 3 s with its own exit code, the log line
  and the issue comment, and no process left behind.
- `shellcheck` on the three scripts.

## Not verified

- The real launcher under launchd, against the real app: nothing here ran
  it (the task forbids it, and it would spend the plan). What it does is
  read from the code above. The first check on the Mac is
  `install-nightly-sync --cell .`, which asks the running app for the
  project, then `nightly-sync --dry-run` from the installed copy.
- How much of a model plan one such night takes: not measured.

## Review

To fill in when the pull request is checked and merged.
