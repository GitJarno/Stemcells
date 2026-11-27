// Replaces `components/chat/ModelPickerContent.tsx` (`plugin.ts`): the picker lists each agent
// as one line of its models by family (`stemcells/models/PickLineup.tsx`,
// `stemcells/tasks/model-pick.md`), with its props, in the popup T3 draws around it.
import { memo } from "react";

import { PickLineup } from "../../models/PickLineup";

export * from "../../../components/chat/ModelPickerContent";

export const ModelPickerContent = memo(PickLineup);
