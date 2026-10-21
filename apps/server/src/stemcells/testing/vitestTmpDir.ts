// @effect-diagnostics nodeBuiltinImport:off - a test-runner plugin: it removes a folder on disk.
import * as NodeFSP from "node:fs/promises";
import "vite-plus/test/config";
import type { Plugin } from "vite-plus";

export const REMOVE_VITEST_TMP_DIR = "stemcells:remove-vitest-tmp-dir";

/**
 * Vitest copies every module a test worker loads into a folder in the system
 * temp dir, one folder per run. A config with `projects` (the web's, the
 * phone's) gives each project its own, which Vitest removes when it closes.
 * A config without them, like the root's (and the server's, which extends
 * it), writes into the folder of the Vitest instance itself, which nothing
 * removes: each run of the server's tests left about 40 MB behind.
 *
 * This removes that folder when Vitest closes. `vitestTmpDir.test.ts` proves
 * a run leaves nothing, and that Vitest without this still leaves the
 * folder: once it doesn't, the seam can go.
 */
export function removeVitestTmpDir(): Plugin {
  return {
    name: REMOVE_VITEST_TMP_DIR,
    configureVitest({ vitest }) {
      const tmpDir: unknown = Reflect.get(vitest, "_tmpDir");
      if (typeof tmpDir !== "string") return;
      vitest.onClose(() => NodeFSP.rm(tmpDir, { recursive: true, force: true }));
    },
  };
}
