/**
 * Upstream's chat in no project, in its scratch folder, is a casual chat in
 * the words a person reads: a one-off chat with nothing to build in mind.
 * Only the words are ours. It stays upstream's scratch chat, a Cell like any
 * other, on the composer's provider and model (`stemcells/seams.md`, A
 * casual chat).
 */
export const CASUAL_CHAT = {
  /** Under a new chat's headline, beside its project picker. */
  offer: "or let's just have a casual chat",
  /** The headline of a new chat that is already a casual chat. */
  headline: "What's on your mind?",
  /** A button that starts one. */
  start: "Have a casual chat",
  /** The command palette's action, and more words it is found by. */
  action: "New casual chat",
  searchTerms: ["casual", "one-off"],
  /** The phone's row among the projects: its title and its detail. */
  title: "Casual chat",
  detail: "Ask anything, no project needed",
} as const;
