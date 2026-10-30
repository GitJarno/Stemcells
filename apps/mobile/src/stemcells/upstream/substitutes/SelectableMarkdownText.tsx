// Replaces `native/SelectableMarkdownText.tsx` (`substitutes.cjs`): in a chat's words, another
// Cell's name is a pill in the Cell tone, and a tap opens it as any thread link does
// (`chat/cellLinks.ts`). Words outside a chat are upstream's.
import type { SelectableMarkdownTextProps } from "../../../native/SelectableMarkdownText.types";
import { SelectableMarkdownText as UpstreamSelectableMarkdownText } from "../../../native/SelectableMarkdownText";
import { cellPill, linkCells } from "../../chat/cellLinks";
import { useChatInView } from "../../chat/inView";
import { useNamedCells } from "../cellNames";

export * from "../../../native/SelectableMarkdownText";

export function SelectableMarkdownText(props: SelectableMarkdownTextProps) {
  const chat = useChatInView();
  const names = useNamedCells(chat);
  if (chat === null || names.size === 0) return <UpstreamSelectableMarkdownText {...props} />;
  const { environmentId } = chat;
  return (
    <UpstreamSelectableMarkdownText
      {...props}
      markdown={linkCells(props.markdown, environmentId, names)}
      linkCustomization={(href) =>
        cellPill(href, environmentId, names) ?? props.linkCustomization?.(href)
      }
    />
  );
}
