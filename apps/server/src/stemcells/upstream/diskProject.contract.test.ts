// Contract: what the Disk project (`stemcells/disk/project.ts`) takes from upstream's server.
// `project.create` with `createWorkspaceRootIfMissing` makes the folder, or takes the one a
// deleted Disk project left; the icon, named on the project, shows though the empty folder's
// miss is still cached.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { DISK_PROJECT, DISK_PROJECT_ICON } from "../../../../../stemcells/disk/project.ts";
import * as ProjectFaviconResolver from "../../project/ProjectFaviconResolver.ts";
import * as T3ProjectFileLoader from "../../project/T3ProjectFileLoader.ts";
import * as WorkspacePaths from "../../workspace/WorkspacePaths.ts";

const layerTest = Layer.mergeAll(
  WorkspacePaths.layer,
  ProjectFaviconResolver.layer.pipe(
    Layer.provide(WorkspacePaths.layer),
    Layer.provide(T3ProjectFileLoader.layer),
  ),
).pipe(Layer.provideMerge(NodeServices.layer));

const diskFolder = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fileSystem.makeTempDirectoryScoped({ prefix: "stemcells-disk-project-" });
  return path.join(home, "projects", DISK_PROJECT.folder);
});

it.layer(layerTest)("the Disk project on upstream's server", (it) => {
  describe("its folder", () => {
    it.effect("is made with the missing folders above it, and taken as it is once it exists", () =>
      Effect.gen(function* () {
        const workspacePaths = yield* WorkspacePaths.WorkspacePaths;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const folder = yield* diskFolder;
        const kept = path.join(folder, "kept.txt");

        expect(
          yield* workspacePaths.normalizeWorkspaceRoot(folder, { createIfMissing: true }),
        ).toBe(folder);
        expect((yield* fileSystem.stat(folder)).type).toBe("Directory");
        yield* fileSystem.writeFileString(kept, "kept");
        expect(
          yield* workspacePaths.normalizeWorkspaceRoot(folder, { createIfMissing: true }),
        ).toBe(folder);
        expect(yield* fileSystem.readFileString(kept)).toBe("kept");
      }),
    );
  });

  describe("its icon", () => {
    it.effect("shows once it is named on the project, past the empty folder's cached miss", () =>
      Effect.gen(function* () {
        const workspacePaths = yield* WorkspacePaths.WorkspacePaths;
        const resolver = yield* ProjectFaviconResolver.ProjectFaviconResolver;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const folder = yield* diskFolder;
        yield* workspacePaths.normalizeWorkspaceRoot(folder, { createIfMissing: true });

        expect(yield* resolver.resolvePath(folder)).toBeNull();
        const icon = path.join(folder, DISK_PROJECT.icon);
        yield* fileSystem.makeDirectory(path.dirname(icon), { recursive: true });
        yield* fileSystem.writeFileString(icon, DISK_PROJECT_ICON);

        expect(yield* resolver.resolvePath(folder, DISK_PROJECT.icon)).toBe(icon);
      }),
    );
  });
});
