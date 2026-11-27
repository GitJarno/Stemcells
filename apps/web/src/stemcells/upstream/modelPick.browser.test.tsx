import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";

import { render } from "../../../test/render";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { ProviderModelPicker } from "./substitutes/ProviderModelPicker";

// The pick as the composer docks it (`stemcells/tasks/model-pick.md`): a family stands for its
// newest model, effort baked into names is one row, the popup stays open for effort after a
// pick, and search reaches an older model by its version.
it("picks a family, then its baked-in level, and finds an older one by search", async () => {
  const instanceId = ProviderInstanceId.make("antigravity");
  const entries = deriveProviderInstanceEntries([
    {
      instanceId,
      driver: ProviderDriverKind.make("antigravity"),
      enabled: true,
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "authenticated" },
      checkedAt: "2026-01-01T00:00:00.000Z",
      models: [],
      slashCommands: [],
      skills: [],
    },
  ]);
  const options = new Map([
    [
      instanceId,
      [
        { slug: "gemini-4-carbon", name: "Gemini 4 Carbon" },
        { slug: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", isDefault: true },
        { slug: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)" },
        { slug: "gemini-3.6-flash-high", name: "Gemini 3.6 Flash (High)", isLegacy: true },
      ],
    ],
  ]);
  const picks: string[] = [];

  function Picker() {
    const [model, setModel] = useState("gemini-4-carbon");
    return (
      <ProviderModelPicker
        environmentId={null}
        activeInstanceId={instanceId}
        model={model}
        lockedProvider={null}
        instanceEntries={entries}
        modelOptionsByInstance={options}
        triggerAriaLabel="Choose model"
        onInstanceModelChange={(_, selected) => {
          picks.push(selected);
          setModel(selected);
        }}
        effortColumn={null}
      />
    );
  }

  await using screen = await render(<Picker />, { router: false }); // no routes involved
  await userEvent.click(screen.getByRole("button", { name: "Choose model" }));
  await expect.element(page.getByRole("button", { name: "Carbon, Antigravity" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: /^Flash 3\.6/ })).not.toBeInTheDocument();

  await userEvent.click(page.getByRole("button", { name: "Flash, Antigravity" }));
  const high = page.getByRole("button", { name: "High", exact: true });
  await expect.element(high).toHaveFocus();
  await userEvent.click(page.getByRole("button", { name: "Low", exact: true }));
  expect(picks).toEqual(["gemini-3.8-flash-high", "gemini-3.8-flash-low"]);

  // The search is the popup's first focus; Enter picks its first find.
  (page.getByRole("textbox", { name: "Find a model" }).element() as HTMLInputElement).focus();
  await userEvent.keyboard("3.6");
  await expect.element(page.getByRole("button", { name: "Flash 3.6, Antigravity" })).toBeVisible();
  await userEvent.keyboard("{Enter}");
  expect(picks.at(-1)).toBe("gemini-3.6-flash-high");
});
