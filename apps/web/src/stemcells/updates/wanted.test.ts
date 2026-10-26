import { describe, expect, it, vi } from "vite-plus/test";

import { nextUpdateAct, takeUpdateStep, updateViewOf, useUpdateWanted, wantUpdate } from "./wanted";

describe("nextUpdateAct", () => {
  it("restarts only once no Cell is at work, since a restart ends every turn", () => {
    expect(nextUpdateAct("restart", 0)).toBe("restart");
    expect(nextUpdateAct("restart", 2)).toBeNull();
    // Not known yet: the stream hasn't said, so it may be stopping someone.
    expect(nextUpdateAct("restart", null)).toBeNull();
  });

  it("gets the update ready whatever the Cells are doing", () => {
    expect(nextUpdateAct("download", 3)).toBe("download");
  });
});

describe("takeUpdateStep", () => {
  it("takes one step at a time, and hands the click back when one doesn't go through", async () => {
    wantUpdate();
    let finish = (_through: boolean) => {};
    const download = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    const install = vi.fn(async () => true);
    const downloading = takeUpdateStep("download", download);
    // The state says the update is ready before the download's call returns.
    await takeUpdateStep("restart", install);
    expect(install).not.toHaveBeenCalled();
    finish(false);
    await downloading;
    expect(useUpdateWanted.getState()).toMatchObject({ wanted: false, taking: null });
  });

  it("never takes a step twice for one click, even when the state says it's due again", async () => {
    wantUpdate();
    const download = vi.fn(async () => true);
    await takeUpdateStep("download", download);
    expect(useUpdateWanted.getState().wanted).toBe(true);
    await takeUpdateStep("download", download);
    expect(download).toHaveBeenCalledOnce();
    expect(useUpdateWanted.getState().wanted).toBe(false);
  });
});

describe("updateViewOf", () => {
  const view = (input: Partial<Parameters<typeof updateViewOf>[0]>) =>
    updateViewOf({
      status: "available",
      step: "download",
      percent: null,
      wanted: false,
      atWork: 0,
      ...input,
    });

  it("offers one Update until the person takes it", () => {
    expect(view({}).act).toBe("update");
    expect(view({ status: "downloading", step: "downloading", percent: 41.7 })).toMatchObject({
      line: "Updating… 41%",
      act: "update",
    });
  });

  it("says what a wanted update waits for, and offers to restart now", () => {
    expect(view({ status: "downloaded", step: "restart", wanted: true, atWork: 1 })).toEqual({
      line: "Restarts once your Cells finish",
      percent: null,
      note: "1 Cell is at work, and a restart would stop them.",
      act: "restart-now",
    });
    expect(view({ status: "downloaded", step: "restart", wanted: true, atWork: 0 })).toMatchObject({
      line: "Restarting…",
      act: null,
    });
  });
});
