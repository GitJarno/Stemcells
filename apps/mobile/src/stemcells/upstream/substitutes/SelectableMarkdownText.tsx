// Replaces `native/SelectableMarkdownText.tsx` (`substitutes.cjs`): in a chat's words, another
// Cell's name is its pill (`chat/cellLinks.ts`) and a place in Settings one a tap opens
// (`chat/placeLinks.ts`). Ours are asked first, so the thread icon a feed adds never replaces
// them. Words outside a chat are upstream's.
import * as Linking from "expo-linking";

import type { SelectableMarkdownTextProps } from "../../../native/SelectableMarkdownText.types";
import { SelectableMarkdownText as UpstreamSelectableMarkdownText } from "../../../native/SelectableMarkdownText";
import { cellPill, cellsLinked, linkCells } from "../../chat/cellLinks";
import { useChatInView } from "../../chat/inView";
import { linkPlacesOnPhone, placePage, placePill } from "../../chat/placeLinks";
import { useCellStills } from "../../chat/useCellStills";
import { useNamedCells } from "../cellNames";

export * from "../../../native/SelectableMarkdownText";

export function SelectableMarkdownText(props: SelectableMarkdownTextProps) {
  const chat = useChatInView();
  const names = useNamedCells(chat);
  const environmentId = chat?.environmentId ?? "";
  const named = linkCells(props.markdown, environmentId, names);
  const stills = useCellStills(environmentId, cellsLinked(named, environmentId, names));
  const markdown = chat === null ? props.markdown : linkPlacesOnPhone(named);
  if (markdown === props.markdown) return <UpstreamSelectableMarkdownText {...props} />;
  const accent = props.textStyle.mutedColor;
  return (
    <UpstreamSelectableMarkdownText
      {...props}
      markdown={markdown}
      linkCustomization={(href) =>
        cellPill(href, environmentId, names, stills) ??
        placePill(href, accent) ??
        props.linkCustomization?.(href)
      }
      onLinkPress={(href) => {
        const page = placePage(href);
        // Through the app's own link, so Settings opens as a `settings/…` link opens it.
        if (page !== undefined) void Linking.openURL(Linking.createURL(page));
        else props.onLinkPress?.(href);
      }}
    />
  );
}
