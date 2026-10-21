// Replaces `components/chat/ProviderSubagentBar.tsx` (`plugin.ts`): a model
// the provider doesn't list gets a name built from its slug, which the
// naming helpers never see, so the bar writes it concisely itself.
import type { ComponentProps } from "react";

import { ProviderSubagentBar as UpstreamProviderSubagentBar } from "../../../components/chat/ProviderSubagentBar";
import { conciseModelName } from "../../models/names";

export * from "../../../components/chat/ProviderSubagentBar";

export function ProviderSubagentBar(props: ComponentProps<typeof UpstreamProviderSubagentBar>) {
  return <UpstreamProviderSubagentBar {...props} modelLabel={conciseModelName(props.modelLabel)} />;
}
