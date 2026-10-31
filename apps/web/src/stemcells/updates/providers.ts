/**
 * Provider updates in the column's banner, beside Stemcells' own (`UpdateBanner.tsx`): one line
 * says what gets better, and one Update takes it all. A provider update needs no restart, so it
 * runs at once; the app's still waits for the Cells (`wanted.ts`).
 */
import { create } from "zustand";

import { APP_NAME } from "../brand/name";
import type { UpdateView } from "./wanted";

/** A provider on a machine with a one-click update, as the server reports it. */
export interface ProviderOffer {
  readonly key: string;
  readonly name: string;
  /** The machine's name, when it isn't this Mac. */
  readonly machine: string | null;
  readonly from: string | null;
  readonly to: string;
  readonly updating: boolean;
  /** Why its last update didn't take, as the server kept it. */
  readonly failure: string | null;
}

export interface ProviderRunResult {
  readonly key: string;
  readonly failure: string | null;
}

/** The person's click while its updates run, and the failures only that run saw. */
export const useProviderRun = create<{
  readonly running: boolean;
  readonly failures: Readonly<Record<string, string>>;
}>(() => ({ running: false, failures: {} }));

/**
 * Updates every offered provider once. A failure the server keeps comes back on the provider; one
 * it never saw (a machine gone, no permission) stays here until the next click.
 */
export async function runProviderUpdates(
  keys: ReadonlyArray<string>,
  update: () => Promise<ReadonlyArray<ProviderRunResult>>,
): Promise<void> {
  if (useProviderRun.getState().running) return;
  useProviderRun.setState({ running: true, failures: {} });
  let failures: Record<string, string> = {};
  try {
    for (const result of await update()) {
      if (result.failure !== null) failures[result.key] = result.failure;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The update didn't start.";
    failures = Object.fromEntries(keys.map((key) => [key, reason]));
  } finally {
    useProviderRun.setState({ running: false, failures });
  }
}

/** Each offer as the banner reads it: under way while the click's run is, else how it went. */
export function providerBettersOf(
  offers: ReadonlyArray<ProviderOffer>,
  run: { readonly running: boolean; readonly failures: Readonly<Record<string, string>> },
): ReadonlyArray<ProviderOffer> {
  return offers.map((offer) => {
    const updating = offer.updating || run.running;
    return {
      ...offer,
      updating,
      failure: updating ? null : (run.failures[offer.key] ?? offer.failure),
    };
  });
}

/** What the banner says, and the one thing it offers. */
export interface BannerView {
  /** "Stemcells gets better", "Stemcells and Codex get better". */
  readonly title: string;
  /** How far it is, what failed, or what it waits for. */
  readonly line: string | null;
  /** The app's download, 0 to 100, while the line is the app's. */
  readonly percent: number | null;
  /** Sentences over the action: why something failed, what a restart waits for. */
  readonly notes: ReadonlyArray<string>;
  readonly act: "update" | "retry" | "restart-now" | null;
}

const names = new Intl.ListFormat("en", { type: "conjunction" });

function unique(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

/** Null when nothing gets better. `app`: the app's own update, as `updateViewOf` reads it. */
export function bannerViewOf(input: {
  readonly app: UpdateView | null;
  readonly providers: ReadonlyArray<ProviderOffer>;
}): BannerView | null {
  const { app, providers } = input;
  const things = unique([...(app === null ? [] : [APP_NAME]), ...providers.map((p) => p.name)]);
  if (things.length === 0) return null;
  // With one thing in the title, the line needn't name it again.
  const named = (list: ReadonlyArray<string>) =>
    things.length === 1 ? "" : ` ${names.format(list)}`;

  const updating = unique(providers.filter((p) => p.updating).map((p) => p.name));
  const failedProviders = providers.filter((p) => p.failure !== null);
  const appFailed = app?.act === "retry";
  const failed = unique([...(appFailed ? [APP_NAME] : []), ...failedProviders.map((p) => p.name)]);

  const line =
    updating.length > 0
      ? `Updating${named(updating)}…`
      : failed.length > 0
        ? `Couldn't update${named(failed)}`
        : (app?.line ?? null);

  const startable = providers.some((p) => !p.updating);
  const appStartable = app?.act === "update" || appFailed;
  const act =
    startable || appStartable
      ? failedProviders.length > 0 || appFailed
        ? "retry"
        : "update"
      : app?.act === "restart-now"
        ? "restart-now"
        : null;

  return {
    title: `${names.format(things)} ${things.length === 1 ? "gets" : "get"} better`,
    line,
    percent: line !== null && line === app?.line ? app.percent : null,
    notes: [
      ...failedProviders.map(
        (p) => `${p.name}${p.machine === null ? "" : ` on ${p.machine}`}: ${p.failure}`,
      ),
      ...(app?.note ? [app.note] : []),
    ],
    act,
  };
}
