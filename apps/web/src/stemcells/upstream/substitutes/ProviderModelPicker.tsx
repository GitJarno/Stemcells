// Replaces `components/chat/ProviderModelPicker.tsx` (`plugin.ts`): when a
// new chat's words start several Cells, their readout stands in the
// composer's model picker's place (`stemcells/words/readoutSlot.ts`), and
// so does what Enter does with words that answer cards in Aski's chat
// (`stemcells/needs/answers/room.tsx`). Upstream's fitting of the controls
// row measures either as the picker.
// Everywhere else, and in a composer whose words start one Cell, it is
// upstream's picker.
import { type ComponentProps, memo, use } from "react";

import { ProviderModelPicker as UpstreamPicker } from "../../../components/chat/ProviderModelPicker";
import { AnswersReadout } from "../../needs/answers/AnswersReadout";
import { AnswersShown } from "../../needs/answers/room";
import { Readout } from "../../words/Readout";
import { WordsReadoutShown } from "../../words/readoutSlot";

export * from "../../../components/chat/ProviderModelPicker";

export const ProviderModelPicker = memo(function ProviderModelPicker(
  props: ComponentProps<typeof UpstreamPicker>,
) {
  const shown = use(WordsReadoutShown);
  const answers = use(AnswersShown);
  if (answers !== null && props.isComposerOwned) return <AnswersReadout shown={answers} />;
  if (shown === null || !props.isComposerOwned) return <UpstreamPicker {...props} />;
  return <Readout readout={shown.readout} drivers={shown.drivers} onWord={shown.onWord} />;
});
