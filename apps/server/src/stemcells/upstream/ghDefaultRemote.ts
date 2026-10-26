import * as Effect from "effect/Effect";
import * as HostProcess from "@t3tools/shared/HostProcess";

import * as ProcessRunner from "../../processRunner.ts";
import { explicitBareRepositoryEnv } from "../../vcs/VcsProcess.ts";

/**
 * The remote `gh repo set-default` chose for a checkout, so the app's repository is the one
 * `gh pr list` reads there. Upstream picks `upstream` over `origin`, wrong for a fork that is
 * its own product. gh records the choice as `remote.<name>.gh-resolved = base`; null leaves
 * upstream's pick.
 */
export const ghDefaultRemote = Effect.fn("Stemcells.ghDefaultRemote")(function* (
  repository: { readonly rootPath: string; readonly isBare: boolean },
  remotes: ReadonlyMap<string, string>,
) {
  // Most checkouts have one remote, which leaves nothing to choose: no extra git.
  if (remotes.size < 2) return null;
  const processRunner = yield* ProcessRunner.ProcessRunner;
  const result = yield* processRunner
    .run({
      command: "git",
      args: [
        "-C",
        repository.rootPath,
        ...(repository.isBare ? ["--git-dir=."] : []),
        "config",
        "--get-regexp",
        "^remote\\..+\\.gh-resolved$",
      ],
      env: explicitBareRepositoryEnv(process.env, yield* HostProcess.Platform),
      timeoutBehavior: "timedOutResult",
    })
    .pipe(Effect.option);
  // git exits 1 when no remote has the key.
  if (result._tag === "None" || result.value.code !== 0) return null;

  for (const line of result.value.stdout.split("\n")) {
    // A remote's name may hold dots; gh writes `base` or, for a parent it chose, `owner/repo`.
    const remoteName = /^remote\.(.+)\.gh-resolved\s+base$/.exec(line.trim())?.[1];
    const remoteUrl = remoteName === undefined ? undefined : remotes.get(remoteName);
    if (remoteName !== undefined && remoteUrl !== undefined) return { remoteName, remoteUrl };
  }
  return null;
});
