import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "../brand/name";
import {
  bannerViewOf,
  providerBettersOf,
  runProviderUpdates,
  useProviderRun,
  type ProviderOffer,
} from "./providers";
import type { UpdateView } from "./wanted";

const codex: ProviderOffer = {
  key: "mac:codex",
  name: "Codex",
  machine: null,
  from: "0.164.0",
  to: "0.166.0",
  updating: false,
  failure: null,
};
const claude: ProviderOffer = { ...codex, key: "mac:claude", name: "Claude" };
const offered: UpdateView = { line: null, percent: null, note: null, act: "update" };

describe("bannerViewOf", () => {
  it("names what gets better: the app, its providers, or both", () => {
    expect(bannerViewOf({ app: null, providers: [] })).toBeNull();
    expect(bannerViewOf({ app: offered, providers: [] })?.title).toBe(`${APP_NAME} gets better`);
    expect(bannerViewOf({ app: null, providers: [codex] })?.title).toBe("Codex gets better");
    // The same provider on two machines is one name.
    expect(
      bannerViewOf({
        app: offered,
        providers: [codex, { ...codex, key: "mini:codex", machine: "Mac mini" }, claude],
      })?.title,
    ).toBe(`${APP_NAME}, Codex, and Claude get better`);
  });

  it("reads exactly as the app's own view when only the app gets better", () => {
    const downloading: UpdateView = {
      line: "Updating… 42%",
      percent: 42,
      note: "2 Cells are flying: it restarts once they finish.",
      act: null,
    };
    expect(bannerViewOf({ app: downloading, providers: [] })).toEqual({
      title: `${APP_NAME} gets better`,
      line: "Updating… 42%",
      percent: 42,
      notes: ["2 Cells are flying: it restarts once they finish."],
      act: null,
    });
    const failed: UpdateView = { line: "Couldn't update", percent: null, note: null, act: "retry" };
    expect(bannerViewOf({ app: failed, providers: [] })).toMatchObject({
      line: "Couldn't update",
      act: "retry",
    });
  });

  it("offers one Update while anything waits for it", () => {
    expect(bannerViewOf({ app: null, providers: [codex] })).toMatchObject({
      line: null,
      act: "update",
    });
    // The app is on its way; the provider still waits.
    const restarting: UpdateView = {
      line: "Restarts once your Cells finish",
      percent: null,
      note: "1 Cell is flying, and a restart would stop it.",
      act: "restart-now",
    };
    expect(bannerViewOf({ app: restarting, providers: [codex] })?.act).toBe("update");
    expect(bannerViewOf({ app: restarting, providers: [] })?.act).toBe("restart-now");
  });

  it("says which provider is updating, and names it only beside something else", () => {
    const updating = { ...codex, updating: true };
    expect(bannerViewOf({ app: null, providers: [updating] })).toMatchObject({
      line: "Updating…",
      act: null,
    });
    // The app's download goes on under it, but the bar is the app's, so it waits for its line.
    const downloading: UpdateView = { line: "Updating… 10%", percent: 10, note: null, act: null };
    expect(bannerViewOf({ app: downloading, providers: [updating] })).toMatchObject({
      line: "Updating Codex…",
      percent: null,
      act: null,
    });
  });

  it("says why a provider didn't update, where, and offers to try again", () => {
    const failed = {
      ...codex,
      machine: "Mac mini",
      failure: "Update command exited with code 1: EACCES",
    };
    expect(bannerViewOf({ app: offered, providers: [failed, claude] })).toEqual({
      title: `${APP_NAME}, Codex, and Claude get better`,
      line: "Couldn't update Codex",
      percent: null,
      notes: ["Codex on Mac mini: Update command exited with code 1: EACCES"],
      act: "retry",
    });
  });
});

describe("providerBettersOf", () => {
  it("shows the click's run as updating, then the failure it saw unless the server kept one", () => {
    const kept = { ...claude, failure: "Still outdated." };
    expect(
      providerBettersOf([codex, kept], { running: true, failures: {} }).map((p) => [
        p.updating,
        p.failure,
      ]),
    ).toEqual([
      [true, null],
      [true, null],
    ]);
    expect(
      providerBettersOf([codex, kept], {
        running: false,
        failures: { "mac:codex": "Not connected." },
      }).map((p) => p.failure),
    ).toEqual(["Not connected.", "Still outdated."]);
  });
});

describe("runProviderUpdates", () => {
  it("runs once per click, and keeps what that run saw fail", async () => {
    useProviderRun.setState({ running: false, failures: { old: "gone" } });
    let finish: (
      results: ReadonlyArray<{ key: string; failure: string | null }>,
    ) => void = () => {};
    const run = runProviderUpdates(["mac:codex"], () => new Promise((done) => (finish = done)));
    expect(useProviderRun.getState()).toEqual({ running: true, failures: {} });
    // A second click while it runs starts nothing.
    await runProviderUpdates(["mac:codex"], () => Promise.reject(new Error("twice")));
    finish([
      { key: "mac:codex", failure: "Not connected." },
      { key: "mac:claude", failure: null },
    ]);
    await run;
    expect(useProviderRun.getState()).toEqual({
      running: false,
      failures: { "mac:codex": "Not connected." },
    });
  });

  it("marks every provider it was asked to update when the run itself fails", async () => {
    useProviderRun.setState({ running: false, failures: {} });
    await runProviderUpdates(["mac:codex", "mini:codex"], () =>
      Promise.reject(new Error("The machine went away.")),
    );
    expect(useProviderRun.getState().failures).toEqual({
      "mac:codex": "The machine went away.",
      "mini:codex": "The machine went away.",
    });
  });
});
