// What a message between Cells is called, on the web and the phone. Aski isn't a Cell, so its
// message is plain mail.

export const mailWord = (aski: boolean): string => (aski ? "Mail" : "Cell Mail");

/** "Otter here." and the like: the card names the sender already. */
const SELF_INTRODUCTION = /^(?!from\s)(?:this is\s+)?[\p{L}\p{N}_-]+\s+here\s*[.:,—–-]\s*/iu;

/** 'From Otter, the Cell "Migrations".': the same, the way a Cell's model tends to sign. */
const SIGNED_INTRODUCTION =
  /^from\s+[\p{L}\p{N}_-]+,\s+the Cell\s+["“][^"”\n]*["”]\s*[.:,—–-]\s*/iu;

/** "Otter: Took 0044." when the sender is Otter: only its own name, so "Note:" stays. */
const nameLead = (sender: string) =>
  new RegExp(`^${sender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:—–-]\\s*`, "iu");

/** A message's words, without the greeting that names its sender. */
export const bodyOf = (text: string, sender?: string): string => {
  const words = text.trim().replace(SELF_INTRODUCTION, "").replace(SIGNED_INTRODUCTION, "");
  return sender === undefined || sender.length === 0 ? words : words.replace(nameLead(sender), "");
};
