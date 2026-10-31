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
      restartNow: false,
    });
    const failed: UpdateView = { line: "Couldn't update", percent: null, note: null, act: "retry" };
    expect(bannerViewOf({ app: failed, providers: [] })).toMatchObject({
      line: "Couldn't update",
      act: "retry",
    });
  });

  const restarting: UpdateView = {
    line: "Restarts once your Cells finish",
    percent: null,
    note: "1 Cell is flying, and a restart would stop it.",
    act: "restart-now",
  };

  it("offers one Update while anything waits for it, and Restart now while the app does", () => {
    expect(bannerViewOf({ app: null, providers: [codex] })).toMatchObject({
      line: null,
      act: "update",
      restartNow: false,
    });
    // The app is on its way; the provider still waits.
    expect(bannerViewOf({ app: restarting, providers: [codex] })).toMatchObject({
      act: "update",
      restartNow: true,
    });
    expect(bannerViewOf({ app: restarting, providers: [] })).toMatchObject({
      act: null,
      restartNow: true,
    });
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
      restartNow: false,
    });
  });

  it("keeps the app's own progress in the line beside a provider's failure", () => {
    const failed = { ...codex, failure: "Still outdated." };
    expect(bannerViewOf({ app: restarting, providers: [failed] })).toEqual({
      title: `${APP_NAME} and Codex get better`,
      line: "Restarts once your Cells finish",
      percent: null,
      notes: ["Codex: Still outdated.", "1 Cell is flying, and a restart would stop it."],
      act: "retry",
      restartNow: true,
    });
  });
});

describe("providerBettersOf", () => {
  it("shows what the click started as updating, then the failure it saw for that version", () => {
    const kept = { ...claude, failure: "Still outdated." };
    expect(
      providerBettersOf([codex, kept], { started: ["mac:codex"], failures: {} }).map((p) => [
        p.updating,
        p.failure,
      ]),
    ).toEqual([
      [true, null],
      [false, "Still outdated."],
    ]);
    const failures = { "mac:codex@0.166.0": "Not connected." };
    expect(providerBettersOf([codex], { started: [], failures })[0]?.failure).toBe(
      "Not connected.",
    );
    // A newer release is a new offer: the old click's failure doesn't speak for it.
    expect(
      providerBettersOf([{ ...codex, to: "0.167.0" }], { started: [], failures })[0]?.failure,
    ).toBeNull();
  });
});

describe("runProviderUpdates", () => {
  it("runs once per click, and keeps what that run saw fail", async () => {
    useProviderRun.setState({ started: [], failures: { old: "gone" } });
    let finish: (
      results: ReadonlyArray<{ key: string; failure: string | null }>,
    ) => void = () => {};
    const run = runProviderUpdates([codex, claude], () => new Promise((done) => (finish = done)));
    expect(useProviderRun.getState()).toEqual({
      started: ["mac:codex", "mac:claude"],
      failures: {},
    });
    // A second click while it runs starts nothing.
    await runProviderUpdates([codex], () => Promise.reject(new Error("twice")));
    finish([
      { key: "mac:codex", failure: "Not connected." },
      { key: "mac:claude", failure: null },
    ]);
    await run;
    expect(useProviderRun.getState()).toEqual({
      started: [],
      failures: { "mac:codex@0.166.0": "Not connected." },
    });
  });

  it("marks every provider it was asked to update when the run itself fails", async () => {
    useProviderRun.setState({ started: [], failures: {} });
    const mini = { ...codex, key: "mini:codex" };
    await runProviderUpdates([codex, mini], () =>
      Promise.reject(new Error("The machine went away.")),
    );
    expect(useProviderRun.getState().failures).toEqual({
      "mac:codex@0.166.0": "The machine went away.",
      "mini:codex@0.166.0": "The machine went away.",
    });
  });
});
