import { createContext, use, type ReactNode } from "react";

import {
  attachmentLabeller,
  type ChatAttachment,
  type Labeller,
} from "../upstream/attachmentLabels";

const NAMES: Labeller = (attachment) => attachment.name;

const Labels = createContext<Labeller>(NAMES);

/** A message's attachments, labelled for every view inside it: its tiles, players and chips. */
export function AttachmentLabels(props: {
  attachments: ReadonlyArray<ChatAttachment> | undefined;
  children: ReactNode;
}) {
  return <Labels value={attachmentLabeller(props.attachments)}>{props.children}</Labels>;
}

/** The label of each attachment of the message this view draws; outside one, its name. */
export function useAttachmentLabels(): Labeller {
  return use(Labels);
}
