// Replaces `@t3tools/client-runtime/state/thread-execution` (`plugin.ts`): the
// line about a chat's background work says Subcells where upstream says
// subagents ("Waiting on 2 Subcells and 1 command"; `stemcells/words/subcells.ts`).
import * as Upstream from "@t3tools/client-runtime/state/thread-execution";

import { subcellTaskLabel, subcellWorkTitle } from "../../../../../../stemcells/words/subcells.ts";

export * from "@t3tools/client-runtime/state/thread-execution";

export const presentPendingBackgroundWork: typeof Upstream.presentPendingBackgroundWork = (
  tasks,
) => {
  const work = Upstream.presentPendingBackgroundWork(tasks);
  return work === null
    ? null
    : {
        ...work,
        title: subcellWorkTitle(work.title, work.items),
        items: work.items.map((item) => ({ ...item, label: subcellTaskLabel(item.label) })),
      };
};
