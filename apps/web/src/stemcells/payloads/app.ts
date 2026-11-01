/** What `accepts` reads and landing does, in the app itself. */
import * as Upstream from "../upstream/payloads";
import type { Reading } from "./drop";
import type { Hands } from "./land";

const appHands: Hands = {
  addToDraft: Upstream.addToDraft,
  letGo: Upstream.letGo,
  discard: Upstream.discard,
  newId: Upstream.newId,
  objectUrl: (blob) => URL.createObjectURL(blob),
  signedAsset: Upstream.signedAsset,
  postToPrimary: Upstream.postToPrimary,
  fetch: (url) => fetch(url),
  primary: Upstream.primaryMachine,
  maxPictureBytes: Upstream.MAX_PICTURE_BYTES,
  isPictureType: Upstream.isPictureType,
};

/** What reading a carry dropped on a chat takes, in the app itself. */
export const appReading: Reading = { ...appHands, maxBytes: Upstream.MAX_FILE_BYTES };
