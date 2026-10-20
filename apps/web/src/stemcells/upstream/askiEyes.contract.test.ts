/**
 * Upstream behaviour Aski's eyes rely on. A failure here after a sync names
 * the contract that moved; the eyes likely stop following the caret, or
 * stop saying that Aski's turn failed.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import composerEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";

describe("what Aski's eyes read from upstream", () => {
  it("the composer's editor names itself, so the eyes find Aski's field", () => {
    expect(composerEditor).toContain('"data-testid": "composer-editor"');
  });

  it("a thread's latest run says it failed, and when", () => {
    type Run = NonNullable<EnvironmentThreadShell["latestRun"]>;
    expectTypeOf<"failed">().toExtend<Run["status"]>();
    expectTypeOf<Run["completedAt"]>().toExtend<string | null | undefined>();
  });
});
