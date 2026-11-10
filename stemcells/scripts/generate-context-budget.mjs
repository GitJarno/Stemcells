// Sets agentContextBudget.json to what upstream's AgentContextBudget.test.ts measures on this
// tree: nothing of upstream's writes the file, and our instructions add to its numbers, so a sync
// runs this instead of merging them (sync-upstream, GENERATED). The test runs with this file as a
// Vitest reporter too: Vitest's own reporters print a failed assertion's measured side cut short.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const BUDGET = "apps/server/src/provider/agentContextBudget.json";
const TEST = "src/provider/AgentContextBudget.test.ts";
const self = NodeURL.fileURLToPath(import.meta.url);

export default class MeasuredReporter {
  onTestCaseResult(testCase) {
    const measured = testCase.result().errors?.find((error) => typeof error.actual === "string");
    if (measured && process.env.STEMCELLS_MEASURED_OUT) {
      NodeFS.writeFileSync(process.env.STEMCELLS_MEASURED_OUT, measured.actual);
    }
  }
}

/** Runs upstream's test; the measured side of its failed assertion, or nothing when it passed. */
function measure() {
  const out = NodePath.join(NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "budget-")), "out");
  const run = NodeChildProcess.spawnSync(
    "pnpm",
    [
      "--filter",
      "t3",
      "exec",
      "vp",
      "test",
      "run",
      TEST,
      "--reporter=default",
      `--reporter=${self}`,
    ],
    { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, STEMCELLS_MEASURED_OUT: out } },
  );
  const measured = NodeFS.existsSync(out) ? NodeFS.readFileSync(out, "utf8") : undefined;
  NodeFS.rmSync(NodePath.dirname(out), { recursive: true, force: true });
  if (run.status === 0) return { passed: true };
  return { passed: false, measured, log: run.stdout?.toString() ?? "" };
}

// Compared as real paths: a checkout under a Mac's temp folder is reached through a symlink.
if (process.argv[1] && NodeFS.realpathSync(process.argv[1]) === self) {
  const first = measure();
  if (!first.passed) {
    // Vitest prints the measured object as `"name": 123,` lines.
    const bytes = Object.fromEntries(
      [...(first.measured ?? "").matchAll(/"(\w+)": (\d+)/g)].map(([, name, value]) => [
        name,
        Number(value),
      ]),
    );
    if (Object.keys(bytes).length === 0) {
      process.stdout.write(first.log);
      console.error(`generate-context-budget: ${TEST} failed before it measured anything`);
      process.exit(1);
    }
    NodeFS.writeFileSync(BUDGET, `${JSON.stringify(bytes, null, 2)}\n`);
    const second = measure();
    if (!second.passed) {
      process.stdout.write(second.log);
      console.error(`generate-context-budget: ${TEST} still fails with the measured bytes`);
      process.exit(1);
    }
  }
  console.log(`generate-context-budget: ${BUDGET} holds what the test measures`);
}
