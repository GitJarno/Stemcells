import { assert, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { fromRunner, type Operation, type Runner } from "./textGenerationOperations.ts";

// Stemcells (stemcells/seams.md): `runLean` hands any structured one-shot
// call straight to the provider's runner, under its own name, so the
// runner can run it lean.
it.effect("a runner's lean call reaches the runner as it was asked, under its own operation", () =>
  Effect.gen(function* () {
    const asked: Array<{ readonly operation: Operation; readonly prompt: string }> = [];
    const run: Runner = (request) => {
      asked.push({ operation: request.operation, prompt: request.prompt });
      return Effect.succeed({ done: true } as never);
    };
    const textGeneration = fromRunner("Test", run);
    const answer = yield* textGeneration.runLean!({
      operation: "runLean",
      cwd: "/tmp/plan",
      prompt: "Plan these Cells.",
      outputSchema: Schema.Struct({ done: Schema.Boolean }),
      modelSelection: { instanceId: ProviderInstanceId.make("test"), model: "test-model" },
    });
    assert.deepStrictEqual(answer, { done: true });
    assert.deepStrictEqual(asked, [{ operation: "runLean", prompt: "Plan these Cells." }]);
  }),
);
