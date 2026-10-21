// Replaces `components/RightPanelTabs.tsx` (`plugin.ts`): a chat in a pane
// draws its panel in the tab's workbench. Outside a pane (no host) it is
// upstream's panel, unchanged.
export * from "../../../components/RightPanelTabs";
export { ChatPanelTabs as RightPanelTabs } from "../chatPanel";
