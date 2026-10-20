/**
 * Upstream's model-name sentences and labels, written the Stemcells way
 * (`stemcells/models/names.ts`). Each export keeps its upstream name, so a
 * seam only changes where a view imports it from.
 */
import { formatProviderUpdateRequiredNotice as upstreamUpdateRequiredNotice } from "@t3tools/client-runtime/providerUpdateRequiredModels";
import { resolveSubagentMetadata as upstreamSubagentMetadata } from "@t3tools/client-runtime/state/subagent-display";

import { conciseModelName, withConciseName } from "../models/names";

/** "Update Claude Code to v2.1.290 or newer to use Fable 5.1." */
export const formatProviderUpdateRequiredNotice: typeof upstreamUpdateRequiredNotice = (
  provider,
  searchQuery,
) =>
  upstreamUpdateRequiredNotice(
    provider.updateRequiredModels === undefined
      ? provider
      : { ...provider, updateRequiredModels: provider.updateRequiredModels.map(withConciseName) },
    searchQuery,
  );

/** A subagent's model as its tooltip names it. */
export const resolveSubagentMetadata: typeof upstreamSubagentMetadata = (input) => {
  const metadata = upstreamSubagentMetadata(input);
  return { ...metadata, modelLabel: conciseModelName(metadata.modelLabel) };
};
