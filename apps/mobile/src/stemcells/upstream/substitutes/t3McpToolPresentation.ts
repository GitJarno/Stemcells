// Replaces `@t3tools/shared/t3McpToolPresentation` (`substitutes.cjs`): the work
// log names T3's own tools in Cell words (`stemcells/words/cellTools.ts`).
// Both resolvers are wrapped, since upstream's presentation reads the
// definition inside its module. The server reads only the tools' ids from
// this module, never their words, so it needs no substitute.
import * as Upstream from "@t3tools/shared/t3McpToolPresentation";

import { withCellWords } from "../../../../../../stemcells/words/cellTools.ts";

export * from "@t3tools/shared/t3McpToolPresentation";

export const resolveT3McpToolDefinition: typeof Upstream.resolveT3McpToolDefinition = (toolName) =>
  withCellWords(
    Upstream.resolveT3McpToolId(toolName),
    Upstream.resolveT3McpToolDefinition(toolName),
  );

export const resolveT3McpToolPresentation: typeof Upstream.resolveT3McpToolPresentation = (
  toolName,
) => {
  const presentation = Upstream.resolveT3McpToolPresentation(toolName);
  const definition = resolveT3McpToolDefinition(toolName);
  return presentation === null || definition === null
    ? presentation
    : { ...presentation, displayName: definition.displayName };
};
