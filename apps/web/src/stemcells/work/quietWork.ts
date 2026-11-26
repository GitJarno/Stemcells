// A chat's work in Stemcells (stemcells/docs/interaction.md, The work log): finished, successful
// tool calls step aside, and the live line, thoughts, failures and what the agent looked at stay.
// It's upstream's own "Hide successful", set once per install; Settings › Appearance turns it back.
import {
  ensureClientSettingsHydrated,
  getClientSettings,
  updateClientSettings,
} from "../upstream/settings";

const SET = "stemcells.quietWork";

/** Turns upstream's "Show all" to "Hide successful", once: a mode the person picks after stays. */
export async function quietWorkOnce(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): Promise<void> {
  if (storage.getItem(SET) !== null) return;
  // A failed read rejects, so a default never overwrites what the person saved.
  await ensureClientSettingsHydrated();
  if (getClientSettings().toolCallVisibility === "showAll") {
    await updateClientSettings({ toolCallVisibility: "hideSuccessful" });
  }
  storage.setItem(SET, "1");
}
