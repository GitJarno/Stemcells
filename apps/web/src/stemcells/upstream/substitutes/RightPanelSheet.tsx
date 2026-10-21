// Replaces `components/RightPanelSheet.tsx` (`plugin.ts`): only the focused
// pane's chat opens the narrow-window sheet. Outside a pane it is upstream's.
export * from "../../../components/RightPanelSheet";
export { ChatPanelSheet as RightPanelSheet } from "../chatPanel";
