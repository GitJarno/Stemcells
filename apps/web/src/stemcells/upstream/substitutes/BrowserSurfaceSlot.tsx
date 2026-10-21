// Replaces `browser/BrowserSurfaceSlot.tsx` (`plugin.ts`): the desktop
// browser rides the page its slot sits on, so a swipe or a tab turn never
// leaves it behind (`stemcells/surfaces/`). Every slot, in a pane or not.
export * from "../../../browser/BrowserSurfaceSlot";
export { BrowserSurfaceSlot } from "../../surfaces/BrowserSlot";
