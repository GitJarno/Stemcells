// Replaces `@t3tools/shared/t3McpToolPresentation` (`substitutes.cjs`): the work log names T3's
// own tools in Cell words (`stemcells/words/cellTools.ts`). Both resolvers are wrapped, since
// upstream's presentation reads the definition inside its module. The server reads only the
// tools' ids from this module, never their words, so it needs no substitute.
import * as Upstream from "@t3tools/shared/t3McpToolPresentation";

import { withCellWords } from "../../../../../../stemcells/words/cellTools.ts";

export * from "@t3tools/shared/t3McpToolPresentation";

// An action tool's call resolves to the definition of the tool its action replaced; this names it.
const idOf = new Map(
  [...Upstream.T3_MCP_TOOL_NAMES].map((name) => [Upstream.resolveT3McpToolDefinition(name), name]),
);

export const resolveT3McpToolDefinition: typeof Upstream.resolveT3McpToolDefinition = (
  toolName,
  input,
) => {
  const definition = Upstream.resolveT3McpToolDefinition(toolName, input);
  return withCellWords(definition && (idOf.get(definition) ?? null), definition);
};

export const resolveT3McpToolPresentation: typeof Upstream.resolveT3McpToolPresentation = (
  toolName,
  input,
) => {
  const presentation = Upstream.resolveT3McpToolPresentation(toolName, input);
  const definition = resolveT3McpToolDefinition(toolName, input);
  return presentation === null || definition === null
    ? presentation
    : { ...presentation, displayName: definition.displayName };
};
