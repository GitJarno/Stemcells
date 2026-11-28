import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { expect, it } from "vite-plus/test";

/**
 * Contract: what the Cell a turn to Aski came from leans on in upstream's draft (`attachCell`),
 * which the type checker can't hold. The chip joins the draft just before upstream's send reads
 * it, and is taken out again by setting the words back.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const source = (path: string) => NodeFS.readFileSync(NodePath.join(here, path), "utf8");

it("sends the draft as it stands when the send is called, its context with it", () => {
  const state = source("../../state/use-thread-composer-state.ts");
  expect(state).toMatch(
    /const draft = getComposerDraftSnapshot\(threadKey\);[\s\S]*enqueueThreadOutboxMessage\(\{[\s\S]{0,400}context: draft\.context,/,
  );
});

it("drops a chip's record once its reference leaves the text", () => {
  const drafts = source("../../state/use-composer-drafts.ts");
  expect(drafts).toMatch(
    /export function setComposerDraftText\(draftKey: string, value: string\): void \{[\s\S]{0,300}referencedComposerContext\(value, existing\.context\)/,
  );
  // A chip goes where its target says: ours is the text's start.
  expect(drafts).toContain(
    "const { start, end } = contextInsertionRange(draftKey, draft, target);",
  );
});
