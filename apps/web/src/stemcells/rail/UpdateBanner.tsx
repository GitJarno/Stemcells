import { ArrowUpRightIcon, GiftIcon } from "lucide-react";
import { useEffect } from "react";

import { useNeeds } from "../needs/stream";
import { Button, Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";
import {
  downloadUpdate,
  installUpdate,
  openLink,
  pullRequestUrl,
  updateStep,
  useDesktopUpdateState,
  useProviderOffers,
  useUpdateProviders,
  type DesktopUpdateState,
  type UpdateStep,
} from "../upstream/updates";
import { bettersOf, changeCountLabel, updateChangeCount } from "../updates/changes";
import {
  bannerViewOf,
  providerBettersOf,
  runProviderUpdates,
  useProviderRun,
  type BannerView,
  type ProviderOffer,
} from "../updates/providers";
import {
  nextUpdateAct,
  takeUpdateStep,
  updateViewOf,
  useUpdateWanted,
  wantUpdate,
} from "../updates/wanted";

interface UpdateToTake {
  readonly state: DesktopUpdateState;
  readonly step: UpdateStep;
}

/** Stemcells' own update, while there is one to take; null when it's up to date or not the desktop app. */
function useUpdateToTake(): UpdateToTake | null {
  const state = useDesktopUpdateState();
  const step = state === null ? null : updateStep(state);
  return state === null || step === null ? null : { state, step };
}

export interface Betters {
  readonly update: UpdateToTake | null;
  readonly providers: ReadonlyArray<ProviderOffer>;
}

/** What gets better: Stemcells' own update and the providers' one-click ones. Null when nothing does. */
export function useBetters(): Betters | null {
  const update = useUpdateToTake();
  const offers = useProviderOffers();
  const run = useProviderRun();
  const providers = providerBettersOf(offers, run);
  return update === null && providers.length === 0 ? null : { update, providers };
}

/**
 * The Cells whose turn a restart would end: at work, or holding their run on an ask. Null until
 * the server's list says, or while it can't be trusted.
 */
function useCellsAtWork(): number | null {
  const { cells, needs, live } = useNeeds();
  if (!live || cells === null || needs === null) return null;
  const threads = new Set<string>();
  for (const cell of cells) if (cell.stage === "working") threads.add(cell.threadId);
  for (const need of needs) if (need.blocks) threads.add(need.threadId);
  return threads.size;
}

/** The changes the popover lists before it says how many more. */
const LISTED = 8;

/**
 * The column's word that Stemcells or its providers get better. Hovering or clicking it lists
 * what does, each change a link to its pull request, and offers one Update. That updates the
 * providers at once and gets the app's update ready, then restarts once no Cell is at work;
 * until then the column says how it goes, or what it waits for.
 */
export function UpdateBanner(props: { betters: Betters }) {
  const { update, providers } = props.betters;
  const wanted = useUpdateWanted((store) => store.wanted);
  const atWork = useCellsAtWork();
  const updateProviders = useUpdateProviders();
  const app =
    update === null
      ? null
      : updateViewOf({
          status: update.state.status,
          step: update.step,
          percent: update.state.downloadPercent,
          wanted,
          atWork,
        });
  const view = bannerViewOf({ app, providers });
  if (view === null) return null;
  const appTotal = update === null ? 0 : updateChangeCount(update.state);
  const total = appTotal + providers.length;
  const count =
    total === 0
      ? null
      : changeCountLabel(total, update !== null && update.state.omittedReleaseCount > 0);
  const label = [
    view.title,
    count === null ? null : `${count} ${total === 1 ? "change" : "changes"}`,
    view.line,
  ]
    .filter(Boolean)
    .join(", ");
  const start = () => {
    const startable = providers.filter((provider) => !provider.updating);
    if (startable.length > 0) {
      void runProviderUpdates(
        startable.map((provider) => provider.key),
        updateProviders,
      );
    }
    if (app?.act === "update" || app?.act === "retry") wantUpdate();
  };

  return (
    <div data-cells-better="">
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={150}
          closeDelay={150}
          render={
            <button
              type="button"
              aria-label={label}
              data-cells-better-open=""
              data-step={update?.step}
            />
          }
        >
          <GiftIcon aria-hidden />
          <span data-cells-better-words="">{view.title}</span>
          {count === null ? null : <span data-cells-better-count="">{count}</span>}
          {view.line === null ? null : <span data-cells-better-detail="">{view.line}</span>}
          {view.percent === null ? null : (
            <span data-cells-better-bar="" aria-hidden>
              <span style={{ transform: `scaleX(${view.percent / 100})` }} />
            </span>
          )}
        </PopoverTrigger>
        <PopoverPopup
          side="right"
          align="end"
          sideOffset={10}
          initialFocus={false}
          aria-label="What got better"
        >
          <WhatGotBetter state={update?.state ?? null} total={appTotal} providers={providers} />
          <UpdateAct
            view={view}
            version={update?.state.downloadedVersion ?? null}
            onStart={start}
          />
        </PopoverPopup>
      </Popover>
    </div>
  );
}

/**
 * What gets better: each provider's step to the version its installer takes, then the app's
 * changes, newest first, each opening its pull request.
 */
function WhatGotBetter(props: {
  state: DesktopUpdateState | null;
  total: number;
  providers: ReadonlyArray<ProviderOffer>;
}) {
  const betters = props.state === null ? [] : bettersOf(props.state);
  const listed = betters.slice(0, LISTED);
  const more = Math.max(props.total, betters.length) - listed.length;
  return (
    <div data-better="">
      <h3 data-better-title="">What got better</h3>
      <ul data-better-list="">
        {props.providers.map((provider) => (
          <li key={provider.key}>
            <span data-better-item="">
              <span>
                {provider.name}{" "}
                <span data-better-version="">
                  {provider.from === null ? provider.to : `${provider.from} → ${provider.to}`}
                </span>
                {provider.machine === null ? null : ` on ${provider.machine}`}
              </span>
            </span>
          </li>
        ))}
        {listed.map((better) => {
          const url = better.number === null ? null : pullRequestUrl(better.number);
          return (
            <li key={better.number ?? better.title}>
              {url === null ? (
                <span data-better-item="">{better.title}</span>
              ) : (
                <a
                  href={url}
                  data-better-item=""
                  onClick={(event) => {
                    event.preventDefault();
                    openLink(url);
                  }}
                >
                  <span>{better.title}</span>
                  <ArrowUpRightIcon aria-hidden />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {more > 0 ? <p data-better-more="">and {more} more</p> : null}
    </div>
  );
}

/** The popover's one action, with what to know first when what happens next isn't plain. */
function UpdateAct(props: { view: BannerView; version: string | null; onStart: () => void }) {
  const { view } = props;
  if (view.act === null && view.notes.length === 0) return null;
  return (
    <div data-better-act="">
      {view.notes.map((note) => (
        <p key={note} data-better-note="">
          {note}
        </p>
      ))}
      {view.act === "restart-now" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void takeUpdateStep("restart", props.version, installUpdate)}
        >
          Restart now
        </Button>
      ) : view.act === null ? null : (
        <Button size="sm" onClick={props.onStart}>
          {view.act === "retry" ? "Try again" : "Update"}
        </Button>
      )}
    </div>
  );
}

/**
 * Carries a wanted update through: gets it ready, then restarts once no Cell is at work. Mounted
 * only while the person wants it, wherever the column stands (`LeftColumn.tsx`).
 */
export function UpdateDriver() {
  const update = useUpdateToTake();
  const atWork = useCellsAtWork();
  const taking = useUpdateWanted((store) => store.taking !== null);
  const act = update === null || taking ? null : nextUpdateAct(update.step, atWork);
  const version =
    act === "restart"
      ? (update?.state.downloadedVersion ?? null)
      : (update?.state.availableVersion ?? null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Start the update's next bridge step once, when where it stands calls for it.
  useEffect(() => {
    if (act === "download") void takeUpdateStep(act, version, downloadUpdate);
    if (act === "restart") void takeUpdateStep(act, version, installUpdate);
  }, [act, version]);
  return null;
}
