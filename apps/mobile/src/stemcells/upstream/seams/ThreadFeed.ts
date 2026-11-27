// Everything of ours `features/threads/ThreadFeed.tsx` draws, through its one import on its
// first line (`stemcells/seams.md`, One import per hot file).
import { entering as systemEntering } from "../../home/listMotion";

export { MailFold } from "../../chat/MailFold";
export { MessageImages } from "../../chat/MessageImages";
export { withoutPictures } from "../../chat/sentImages";
export { withAskAtEnd } from "../../line/ChatAsk";

/** A new message and its reply enter on the motion system's enter, in place of upstream's own. */
export const entering = (_upstream: unknown) => systemEntering();
