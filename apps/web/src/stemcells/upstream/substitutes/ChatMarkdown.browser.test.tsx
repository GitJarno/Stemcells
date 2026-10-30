/**
 * A setting Aski links in a reply draws as its switch: upstream's markdown
 * keeps a `t3-context://` link and hands it to the substitute's renderer,
 * and any other context link still reads as upstream's plain words. Another
 * Cell a chat names draws as its token.
 */
import "../../../index.css";

import type { ScopedThreadRef } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { setAskiPlans, useAskiPlans } from "../../aski/planning";
import { render } from "../testRender";
import ChatMarkdown from "./ChatMarkdown";

const beside = vi.hoisted(() => vi.fn((_cell: unknown) => true));
vi.mock("../../tabs/commands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../tabs/commands")>()),
  openCellBeside: beside,
}));
// The chat's project holds Manatee; upstream's shells aren't loaded here.
vi.mock("../cellNames", () => ({
  useNamedCells: (ref: unknown) =>
    ref == null
      ? { signature: "", names: new Map() }
      : { signature: "Manatee=thread-m", names: new Map([["Manatee", "thread-m"]]) },
}));

function Plans() {
  return <output>{useAskiPlans() ? "on" : "off"}</output>;
}

describe("a setting in a reply", () => {
  it("draws as its switch, which writes the setting", async () => {
    setAskiPlans(true);
    using _restore = { [Symbol.dispose]: () => setAskiPlans(true) };
    await using screen = await render(
      <>
        <ChatMarkdown
          cwd={undefined}
          text="Turn off [Aski divides the work](t3-context://v1/stemcells-setting/aski-plans) to keep your words as they are."
        />
        <Plans />
      </>,
    );
    const toggle = screen.getByRole("switch", { name: "Aski divides the work" });
    await expect.element(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect.element(screen.getByRole("status")).toHaveTextContent("off");
    await expect.element(toggle).not.toBeChecked();
  });

  it("draws upstream's setting as Settings' own switch", async () => {
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        text="[Auto-settle merged threads](t3-context://v1/stemcells-setting/auto-settle-merged)"
      />,
    );
    await expect
      .element(screen.getByRole("switch", { name: "Auto-settle merged threads" }))
      .toBeVisible();
  });

  it("draws another Cell a chat names as its token, which opens it beside", async () => {
    const chat = { environmentId: "env", threadId: "thread-o" } as unknown as ScopedThreadRef;
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        threadRef={chat}
        text="Manatee is hiding the third; `Manatee` is the module."
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Manatee" }));
    expect(beside).toHaveBeenCalledWith({
      environmentId: "env",
      threadId: "thread-m",
      draftId: null,
    });
    await expect.element(screen.getByText("Manatee", { exact: true }).nth(1)).toBeVisible();
    expect(screen.container.querySelectorAll("[data-stemcells-cell-token]")).toHaveLength(1);
  });

  it("leaves any other context link as its words", async () => {
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        text="See [the old copy](t3-context://v1/file/f_1) and [a lost one](t3-context://v1/stemcells-setting/nothing-here)."
      />,
    );
    await expect.element(screen.getByText("the old copy")).toBeVisible();
    await expect.element(screen.getByText("a lost one")).toBeVisible();
    expect(screen.container.querySelector("[role='switch']")).toBeNull();
  });
});
