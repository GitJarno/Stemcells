// Replaces `components/chat/ProviderModelPicker.tsx` (`plugin.ts`): when a
// new chat's words start several Cells, their readout stands in the
// composer's model picker's place (`stemcells/words/readoutSlot.ts`), and
// upstream's fitting of the controls row measures it as the picker.
// Everywhere else, and in a composer whose words start one Cell, it is
// upstream's picker.
import { type ComponentProps, memo, use } from "react";

import { ProviderModelPicker as UpstreamPicker } from "../../../components/chat/ProviderModelPicker";
import { Readout } from "../../words/Readout";
import { WordsReadoutShown } from "../../words/readoutSlot";

export * from "../../../components/chat/ProviderModelPicker";

export const ProviderModelPicker = memo(function ProviderModelPicker(
  props: ComponentProps<typeof UpstreamPicker>,
) {
  const shown = use(WordsReadoutShown);
  if (shown === null || !props.isComposerOwned) return <UpstreamPicker {...props} />;
  return <Readout readout={shown.readout} drivers={shown.drivers} onWord={shown.onWord} />;
});
