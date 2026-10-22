/**
 * Which repository a checkout with a fork and its parent belongs to. The Pull
 * requests list and a thread's pull requests read it. Stemcells' own checkout
 * has `origin` (the fork, a product of its own) and `upstream` (T3's), and
 * upstream's resolver picks `upstream`: these pin that `gh repo set-default`
 * wins (`ghDefaultRemote.ts`) and that without it upstream's pick stands.
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import * as ProcessRunner from "../../processRunner.ts";
import * as RepositoryIdentityResolver from "../../project/RepositoryIdentityResolver.ts";

const git = (cwd: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const processRunner = yield* ProcessRunner.ProcessRunner;
    return yield* processRunner.run({ command: "git", args: ["-C", cwd, ...args] });
  }).pipe(Effect.provide(ProcessRunner.layer));

const forkOf = (ghDefault: "origin" | "upstream" | null) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const cwd = yield* fileSystem.makeTempDirectoryScoped({ prefix: "stemcells-gh-default-" });
    yield* git(cwd, ["init"]);
    yield* git(cwd, ["remote", "add", "origin", "git@github.com:example/fork.git"]);
    yield* git(cwd, ["remote", "add", "upstream", "git@github.com:T3Tools/t3code.git"]);
    if (ghDefault !== null) yield* git(cwd, ["config", `remote.${ghDefault}.gh-resolved`, "base"]);
    const resolver = yield* RepositoryIdentityResolver.RepositoryIdentityResolver;
    return yield* resolver.resolve(cwd);
  }).pipe(Effect.provide(RepositoryIdentityResolver.layer));

it.layer(NodeServices.layer)("a fork's repository", (it) => {
  it.effect("is the remote gh's default names", () =>
    Effect.gen(function* () {
      const identity = yield* forkOf("origin");
      expect(identity?.canonicalKey).toBe("github.com/example/fork");
      expect(identity?.locator.remoteName).toBe("origin");
      expect(identity?.origin).toBeUndefined();

      expect((yield* forkOf("upstream"))?.canonicalKey).toBe("github.com/t3tools/t3code");
    }),
  );

  it.effect("is upstream's pick, the parent, without gh's default", () =>
    Effect.gen(function* () {
      const identity = yield* forkOf(null);
      expect(identity?.canonicalKey).toBe("github.com/t3tools/t3code");
      expect(identity?.origin?.canonicalKey).toBe("github.com/example/fork");
    }),
  );
});
