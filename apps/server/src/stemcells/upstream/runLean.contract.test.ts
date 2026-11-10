// @effect-diagnostics nodeBuiltinImport:off - reads the arguments a fake CLI wrote down.
// Contract: Aski's planner runs lean (seams.md, Aski's planner). A `runLean` call starts the CLI
// without the person's settings, rules or a saved session, and upstream's own operations keep
// them. Each CLI here is a fake that writes its arguments down and answers.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { ClaudeSettings, CodexSettings, ProviderInstanceId } from "@t3tools/contracts";
import { writeFakeCli } from "@t3tools/provider-testing/fakeCli";
import { createModelSelection } from "@t3tools/shared/model";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as ServerConfig from "../../config.ts";
import {
  SYNTHETIC_CLAUDE_MODEL_CATALOG,
  SYNTHETIC_CLAUDE_STANDARD_MODEL,
} from "../../provider/ClaudeModelCatalog.testFixtures.ts";
import { makeClaudeTextGeneration } from "../../textGeneration/ClaudeTextGeneration.ts";
import { makeCodexTextGeneration } from "../../textGeneration/CodexTextGeneration.ts";

const decodeClaudeSettings = Schema.decodeSync(ClaudeSettings);
const decodeCodexSettings = Schema.decodeSync(CodexSettings);

const layer = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "stemcells-run-lean-test-",
}).pipe(Layer.provideMerge(NodeServices.layer));

/** A CLI that writes its arguments beside itself, then answers as Claude does or as Codex does. */
const fakeCli = Effect.fn("fakeCli")(function* (name: string, answer: object) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-run-lean-" });
  const argsFile = NodePath.join(directory, "args.json");
  const binaryPath = writeFakeCli({
    directory,
    name,
    source: [
      'import * as NodeFS from "node:fs";',
      "const args = process.argv.slice(2);",
      'if (args.includes("mcp")) { process.stdout.write("[]"); process.exit(0); }',
      "for await (const _ of process.stdin);",
      `NodeFS.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));`,
      `const answer = ${JSON.stringify(JSON.stringify(answer))};`,
      'const file = args.indexOf("--output-last-message");',
      "if (file === -1) process.stdout.write(JSON.stringify({ structured_output: JSON.parse(answer) }));",
      "else NodeFS.writeFileSync(args[file + 1], answer);",
    ].join("\n"),
  });
  const ranWith = () => (JSON.parse(NodeFS.readFileSync(argsFile, "utf8")) as string[]).join(" ");
  return { binaryPath, ranWith };
});

const claude = Effect.fn("claude")(function* (answer: object) {
  const cli = yield* fakeCli("claude", answer);
  const textGeneration = yield* makeClaudeTextGeneration(
    decodeClaudeSettings({ binaryPath: cli.binaryPath }),
    undefined,
    Effect.succeed(SYNTHETIC_CLAUDE_MODEL_CATALOG),
  );
  const modelSelection = createModelSelection(
    ProviderInstanceId.make("claudeAgent"),
    SYNTHETIC_CLAUDE_STANDARD_MODEL,
  );
  return { textGeneration, modelSelection, ranWith: cli.ranWith };
});

const codex = Effect.fn("codex")(function* (answer: object) {
  const cli = yield* fakeCli("codex", answer);
  const textGeneration = yield* makeCodexTextGeneration(
    decodeCodexSettings({ binaryPath: cli.binaryPath }),
  );
  const modelSelection = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.4-mini");
  return { textGeneration, modelSelection, ranWith: cli.ranWith };
});

it.layer(layer)("a lean call", (it) => {
  it.effect.each([
    // Claude's `--setting-sources` takes an empty value: two spaces once joined.
    { name: "Claude", make: claude, lean: "--setting-sources  --no-session-persistence" },
    { name: "Codex", make: codex, lean: "--ignore-user-config --ignore-rules" },
  ])("starts $name without the person's settings, and a title call keeps them", (provider) =>
    Effect.gen(function* () {
      const lean = yield* provider.make({ done: true });
      const answer = yield* lean.textGeneration.runLean!({
        operation: "runLean",
        cwd: process.cwd(),
        prompt: "Plan these Cells.",
        outputSchema: Schema.Struct({ done: Schema.Boolean }),
        modelSelection: lean.modelSelection,
      });
      expect(answer).toEqual({ done: true });
      expect(lean.ranWith()).toContain(provider.lean);

      const own = yield* provider.make({ title: "Lean", body: "" });
      yield* own.textGeneration.generateThreadTitle({
        cwd: process.cwd(),
        message: "Name this thread.",
        modelSelection: own.modelSelection,
      });
      expect(own.ranWith()).not.toContain(provider.lean.split(" ")[0]);
    }).pipe(Effect.scoped),
  );
});
