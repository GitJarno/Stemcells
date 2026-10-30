// Replaces `native/SelectableMarkdownText.tsx` (`substitutes.cjs`): in a chat's words, another
// Cell's name is a pill, the Cell held still and its name, and a tap opens it as any thread link
// does (`chat/cellLinks.ts`). Ours is asked first, so the thread icon a feed adds never replaces
// it. Words outside a chat are upstream's.
import type { SelectableMarkdownTextProps } from "../../../native/SelectableMarkdownText.types";
import { SelectableMarkdownText as UpstreamSelectableMarkdownText } from "../../../native/SelectableMarkdownText";
import { cellPill, cellsLinked, linkCells } from "../../chat/cellLinks";
import { useChatInView } from "../../chat/inView";
import { useCellStills } from "../../chat/useCellStills";
import { useNamedCells } from "../cellNames";

export * from "../../../native/SelectableMarkdownText";

export function SelectableMarkdownText(props: SelectableMarkdownTextProps) {
  const chat = useChatInView();
  const names = useNamedCells(chat);
  const environmentId = chat?.environmentId ?? "";
  const markdown = linkCells(props.markdown, environmentId, names);
  const stills = useCellStills(environmentId, cellsLinked(markdown, environmentId, names));
  if (chat === null || names.size === 0) return <UpstreamSelectableMarkdownText {...props} />;
  return (
    <UpstreamSelectableMarkdownText
      {...props}
      markdown={markdown}
      linkCustomization={(href) =>
        cellPill(href, environmentId, names, stills) ?? props.linkCustomization?.(href)
      }
    />
  );
}
