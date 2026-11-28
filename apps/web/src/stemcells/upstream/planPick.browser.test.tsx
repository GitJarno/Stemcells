import { ProviderDriverKind, type ServerProviderModel } from "@t3tools/contracts";
import { createModelCapabilities } from "@t3tools/shared/model";
import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { type PlanModel, planTraits } from "./planPick";
import { ComposerEffortColumn } from "./substitutes/ComposerModelEffort";

// An agent whose reasoning option has an id of its own, among options a plan's Cell can't carry.
const models: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "fusion",
    name: "Fusion",
    isCustom: false,
    capabilities: createModelCapabilities({
      optionDescriptors: [
        {
          id: "mode",
          label: "Session Mode",
          type: "select",
          currentValue: "code",
          options: [
            { id: "code", label: "Code" },
            { id: "plan", label: "Plan" },
          ],
        },
        {
          id: "thought_level",
          label: "Thinking",
          type: "select",
          role: "reasoning",
          currentValue: "medium",
          options: [
            { id: "low", label: "Low" },
            { id: "medium", label: "Medium" },
            { id: "high", label: "High" },
          ],
        },
        { id: "fastMode", label: "Fast", type: "boolean", currentValue: false },
      ],
    }),
  },
];

// What a plan's row relies on (`planPick.tsx`): handed a model's effort levels alone, the
// composer's effort column offers those and nothing else, and a pick comes back as the one
// option a plan's Cell is launched with.
it("offers a plan's Cell its model's effort levels alone, and hands back the level picked", async () => {
  const picked: Array<PlanModel["effort"]> = [];
  function Column() {
    const [effort, setEffort] = useState<PlanModel["effort"]>(null);
    const traits = planTraits({
      provider: ProviderDriverKind.make("acpRegistry"),
      models,
      model: { instanceId: "devin", id: "fusion", effort },
      onEffort: (next) => {
        picked.push(next);
        setEffort(next);
      },
    });
    return <ComposerEffortColumn traits={traits} />;
  }
  await using _screen = await render(<Column />, { router: false });
  await expect.element(page.getByRole("button", { name: "Medium", exact: true })).toBeVisible();
  expect(document.body.textContent).not.toMatch(/Session Mode|Fast/);
  await userEvent.click(page.getByRole("button", { name: "High", exact: true }));
  expect(picked).toEqual([{ option: "thought_level", level: "high" }]);
  await expect
    .element(page.getByRole("button", { name: "High", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
});
