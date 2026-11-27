// Replaces `components/chat/ComposerModelEffort.tsx` (`plugin.ts`): the docked picker's effort
// column and footer are rows under the pick's lines, every choice a press with no menu
// (`stemcells/models/PickControls.tsx`, `stemcells/tasks/model-pick.md`). The trigger's
// suffix stays upstream's.
import { PickEffort, PickFooter } from "../../models/PickControls";

export * from "../../../components/chat/ComposerModelEffort";

export const ComposerEffortColumn = PickEffort;
export const ComposerPickerFooter = PickFooter;
