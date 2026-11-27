// What a planned row says to a person (stemcells/tasks/aski-orchestrator.md, decision 12): a row
// Aski's plan puts in Awake before its Cell has started.

/** What a check row's mark says of the field it is unsure of, to one who can't see it. */
export const UNSURE_WORDS = {
  place: "Check the project",
  model: "Check the model",
  words: "Check the words",
} as const;

/** A check row, to one who points at it. */
export const CHECK_ROW_WORDS = "Waits for your check in Aski's chat";
