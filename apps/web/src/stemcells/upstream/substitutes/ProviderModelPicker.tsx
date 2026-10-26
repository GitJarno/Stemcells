// Replaces `components/chat/ProviderModelPicker.tsx` (`plugin.ts`): when a new chat's words
// start several Cells, their readout stands in the model picker's place
// (`stemcells/words/readoutSlot.ts`), as does Enter's action on card answers in Aski's chat
// (`stemcells/needs/answers/room.tsx`); upstream's controls row measures either as the picker.
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
