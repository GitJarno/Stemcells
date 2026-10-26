// Replaces `components/preview/ThreadPreviewMiniPlayer.tsx` (`plugin.ts`) in every chat: a
// floating browser or device floats only where it leaves the chat its lane; where upstream
// would lay it over the chat's words, it tucks into a card at the chat's edge
// (`stemcells/surfaces/Floater.tsx`).
export * from "../../../components/preview/ThreadPreviewMiniPlayer";
export { ThreadPreviewMiniPlayer } from "../../surfaces/Floater";
