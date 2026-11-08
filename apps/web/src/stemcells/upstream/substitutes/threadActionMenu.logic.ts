// Replaces `components/threadActionMenu.logic.ts` (`plugin.ts`): the Cell menu's Copy offers the
// Cell and its ID in Cell words, as the phone's card does (`stemcells/words/copyCell.ts`).
import * as Upstream from "../../../components/threadActionMenu.logic";
import { COPY_CELL } from "../../../../../../stemcells/words/copyCell.ts";

export * from "../../../components/threadActionMenu.logic";

const CELL_WORDS: Partial<Record<Upstream.ThreadActionMenuId, string>> = {
  "copy-thread": COPY_CELL.menu,
  "copy-thread-id": COPY_CELL.menuId,
};

export const buildThreadActionMenuItems: typeof Upstream.buildThreadActionMenuItems = (state) =>
  Upstream.buildThreadActionMenuItems(state).map((item) =>
    item.id === "copy" && item.children
      ? {
          ...item,
          children: item.children.map((child) => ({
            ...child,
            label: CELL_WORDS[child.id] ?? child.label,
          })),
        }
      : item,
  );
