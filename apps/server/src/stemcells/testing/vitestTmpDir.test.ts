// @effect-diagnostics nodeBuiltinImport:off - runs Vitest and reads the temp folder it wrote.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";
import { createVitest } from "vite-plus/test/node";

/**
 * Contract: a run under the root config leaves nothing in the system temp
 * dir (`vitestTmpDir.ts`). Each case runs the fixture in a Vitest of its own
 * and looks at the folder Vitest copied its modules into.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../..");
const fixture = NodePath.relative(repoRoot, NodePath.join(here, "vitestTmpDir.fixture.ts"));

async function runFixture(config: string | false) {
  const vitest = await createVitest("test", {
    config,
    root: repoRoot,
    include: [fixture],
    watch: false,
    reporters: [{}],
  });
  const tmpDir: unknown = Reflect.get(vitest, "_tmpDir");
  if (typeof tmpDir !== "string") throw new Error("Vitest no longer has `_tmpDir`");
  try {
    await vitest.start();
    const passed = vitest.state.getCountOfFailedTests() === 0;
    const copied = NodeFS.readdirSync(tmpDir, { recursive: true }).length > 0;
    return { tmpDir, passed, copied };
  } finally {
    await vitest.close();
  }
}

describe("Vitest's temp folder", () => {
  it("the root config removes it when Vitest closes", async () => {
    const run = await runFixture(NodePath.join(repoRoot, "vite.config.ts"));
    expect(run).toMatchObject({ passed: true, copied: true });
    expect(NodeFS.existsSync(run.tmpDir)).toBe(false);
  }, 60_000);

  it("Vitest alone still leaves it behind (once this fails, the seam can go)", async () => {
    const run = await runFixture(false);
    try {
      expect(run).toMatchObject({ passed: true, copied: true });
      expect(NodeFS.existsSync(run.tmpDir)).toBe(true);
    } finally {
      NodeFS.rmSync(run.tmpDir, { recursive: true, force: true });
    }
  }, 60_000);
});
