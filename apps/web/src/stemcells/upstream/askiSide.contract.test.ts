/**
 * What Aski's button relies on in upstream (stemcells/tasks/aski-side.md): ⌘. free among its
 * keys, a thread's chip keyed by its thread so a second one is skipped, a provider's tool call
 * kept whole in a chat's structure, and the composer's lane the button stands over. A failure
 * after a sync names what moved.
 */
import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { threadContextRecord } from "@t3tools/shared/composerContextReferences";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import threadDetail from "../../../../../packages/client-runtime/src/state/threadDetail.ts?raw";
import chatView from "../../components/ChatView.tsx?raw";
import draftStore from "../../composerDraftStore.ts?raw";
import { ASKI_SHORTCUT } from "../tabs/useWorkspaceKeys";

describe("Aski's button's contracts with upstream", () => {
  it("⌘. is no key of upstream's", () => {
    expect(DEFAULT_KEYBINDINGS.filter((rule) => rule.key === ASKI_SHORTCUT)).toEqual([]);
  });

  it("a thread's chip is keyed by its thread, and a chip already there is skipped", () => {
    const ref = { environmentId: "mac" as EnvironmentId, threadId: "cell" as ThreadId };
    expect(threadContextRecord(ref, "One").contextId).toBe(
      threadContextRecord(ref, "Renamed").contextId,
    );
    expect(draftStore).toMatch(
      /addThreadContexts: \(threadRef, records, options\) => \{[\s\S]{0,400}if \(existingIds\.has\(record\.contextId\)\) return false;/,
    );
  });

  it("a chat's structure strips only streamed words, so a tool call keeps its input and status", () => {
    expect(threadDetail).toMatch(
      /function toThreadStructureTurnItem\(item: TurnItem\): ThreadStructureTurnItem \{\s*if \(item\.type !== "assistant_message" && item\.type !== "reasoning"\) return item;/,
    );
  });

  it("the composer's lane is marked, for the button to stand over", () => {
    expect(chatView).toContain('data-chat-composer-stack="true"');
  });
});
