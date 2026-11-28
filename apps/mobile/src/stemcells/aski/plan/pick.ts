// A plan's Cell and the composer's model control (stemcells/tasks/aski-orchestrator.md, decision
// 18): what the control and its sheet show for a Cell, and what a choice there is to the tray.

import { conciseModelName } from "../../../../../../stemcells/models/names.ts";
import type {
  ModelEntry,
  ModelField,
  StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { placeOfKey } from "./world";

/** The route of the sheet a task's model control opens (`PlanPickScreen.tsx`, `pages.tsx`). */
export const PLAN_PICK = "AskiPlanPick";

/** The project a Cell starts in, as the app knows it; null for none yet, or one still to be made. */
export function projectIdOf(act: Pick<StartAct, "place">): string | null {
  const place = act.place;
  if (place === null) return null;
  return place.projectId ?? (place.id === null ? null : (placeOfKey(place.id)?.projectId ?? null));
}

/**
 * A model as the picker chose it, for the tray: its name as a person reads it, and its effort
 * where the choice carries one. A Cell carries no other option of a model.
 */
export function fieldOf(
  selection: {
    readonly instanceId: string;
    readonly model: string;
    readonly options?: ReadonlyArray<{ readonly id: string; readonly value: unknown }> | undefined;
  },
  models: ReadonlyArray<ModelEntry>,
): Omit<ModelField, "heard" | "how"> {
  const entry = models.find(
    (one) => one.instanceId === selection.instanceId && one.id === selection.model,
  );
  const option = entry?.effortOption;
  const level =
    option === undefined ? undefined : selection.options?.find((one) => one.id === option)?.value;
  return {
    instanceId: selection.instanceId,
    id: selection.model,
    name: entry?.name ?? conciseModelName(selection.model),
    effort: option !== undefined && typeof level === "string" ? { option, level } : null,
  };
}
