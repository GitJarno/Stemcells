// Who said a search hit's words, as a message preview reads: you, or the Cell by its name (Aski
// in Aski's chat). Upstream's "Agent" names no one; the row's creature beside it has a name.
import { useIsAskiChat } from "../aski/useAskiChat";
import { cellNameOf } from "../cell/kit";

export function useSpeaker(threadId: string): string {
  return useIsAskiChat(threadId) ? "Aski" : cellNameOf(threadId);
}
