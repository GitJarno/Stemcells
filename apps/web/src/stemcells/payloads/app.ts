/** What `accepts` reads and landing does, in the app itself. */
import * as Upstream from "../upstream/payloads";
import type { Hands } from "./land";
import type { Facts } from "./payload";

export function appFacts(): Facts {
  return {
    machine: Upstream.machineOf,
    primary: Upstream.primaryMachine(),
    held: (cell) => Upstream.chipsIn(cell).length,
    maxAttachments: Upstream.MAX_ATTACHMENTS,
    maxPictureBytes: Upstream.MAX_PICTURE_BYTES,
    isPictureType: Upstream.isPictureType,
  };
}

export const appHands: Hands = {
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
