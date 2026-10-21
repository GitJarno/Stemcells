// Replaces `browser/HostedBrowserWebview.tsx` (`plugin.ts`): on the slate, a
// desktop browser sleeps, with no live webview, until it is first wanted:
// its Surface on stage, the mini player, or its Cell working
// (`stemcells/surfaces/awake.ts`).
export * from "../../../browser/HostedBrowserWebview";
export { HostedBrowserWebview } from "../../surfaces/WakingBrowser";
