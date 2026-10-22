/**
 * Everything of ours `components/ChatView.tsx` reads, through its one
 * import, on its first line: `import * as Stemcells from
 * "../stemcells/upstream/seams/ChatView"`, each use reading `Stemcells.…`.
 * ChatView is upstream's hottest file, and our import lines in its import
 * block were where the 2026-10-21 sync conflicted. Upstream rarely edits a
 * file's first line, so one import there keeps ours out of its way
 * (`stemcells/seams.md`, "One import per hot file").
 */
export { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
export { CellComposerLine } from "../../composer/CellComposerLine";
export { ChatMediaViewerHost } from "../../media/ChatMediaViewerHost";
