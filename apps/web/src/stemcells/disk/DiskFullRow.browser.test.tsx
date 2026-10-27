// A Cell's failed turn on a machine whose disk is full says so, and Free space opens the cleanup
// Cell there with its ask; with room on the disk, the failure is upstream's row.
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { CLEANUP_ASK } from "../../../../../stemcells/words/disk.ts";
import type { EnvironmentId } from "../upstream/disk";
import { render } from "../upstream/testRender";
import { DiskFullRow } from "./DiskFullRow";

const machine = vi.hoisted(() => {
  const state = { free: 0, opened: [] as string[] };
  return {
    setup: (free: number) => {
      state.free = free;
      state.opened = [];
    },
    state,
  };
});

vi.mock("../upstream/disk", () => ({
  toastManager: { add: () => undefined },
  useMachineDisk: () => ({ free: machine.state.free, total: 500e9 }),
  useOpenCellWithDraft: () => async (text: string) => {
    machine.state.opened.push(text);
    return true;
  },
}));

const row = (entryId: string) => (
  <DiskFullRow
    entryId={entryId}
    environmentId={"env" as EnvironmentId}
    createdAt="2026-10-27T09:45:07.000Z"
    timestampFormat="24-hour"
    fallback={<p>Provider turn failed.</p>}
  />
);

describe("a failed turn and a full disk", () => {
  it("says the disk is full, and Free space opens the cleanup Cell with its ask", async () => {
    machine.setup(0.4e9);
    await using screen = await render(row("full-turn"));
    await expect.element(screen.getByText("The disk is full")).toBeVisible();
    expect(screen.container.textContent).not.toContain("Provider turn failed.");
    await userEvent.click(screen.getByRole("button", { name: "Free space" }));
    await vi.waitFor(() => expect(machine.state.opened).toEqual([CLEANUP_ASK]));
  });

  it("stays upstream's row while the disk has room", async () => {
    machine.setup(40e9);
    await using screen = await render(row("other-turn"));
    await expect.element(screen.getByText("Provider turn failed.")).toBeVisible();
    expect(screen.container.textContent).not.toContain("The disk is full");
  });
});
