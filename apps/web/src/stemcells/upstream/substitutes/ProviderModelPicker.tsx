// Replaces `components/chat/ProviderModelPicker.tsx` (`plugin.ts`): several Cells' readout, or
// Enter's action on card answers in Aski's chat, stands in the picker's place. A docked picker's
// effort column and footer stack under the pick's lines (`stemcells/tasks/model-pick.md`); a
// null column keeps T3's docked behaviour, the popup open for effort, with no column drawn.
import { type ComponentProps, memo, use } from "react";

import { ProviderModelPicker as UpstreamPicker } from "../../../components/chat/ProviderModelPicker";
import { PickSlots } from "../../models/pickSlots";
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
  if (shown !== null && props.isComposerOwned) {
    return <Readout readout={shown.readout} drivers={shown.drivers} onWord={shown.onWord} />;
  }
  if (props.effortColumn === undefined) return <UpstreamPicker {...props} />;
  return (
    <PickSlots value={{ effort: props.effortColumn, footer: props.footer }}>
      <UpstreamPicker {...props} effortColumn={null} footer={undefined} />
    </PickSlots>
  );
});
