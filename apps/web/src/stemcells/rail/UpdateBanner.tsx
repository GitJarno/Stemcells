import { ArrowUpRightIcon, GiftIcon } from "lucide-react";
import { useEffect } from "react";

import { APP_NAME } from "../brand/name";
import { useNeeds } from "../needs/stream";
import { Button, Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";
import {
  downloadUpdate,
  installUpdate,
  openLink,
  pullRequestUrl,
  updateStep,
  useDesktopUpdateState,
  type DesktopUpdateState,
  type UpdateStep,
} from "../upstream/updates";
import { bettersOf, changeCountLabel, updateChangeCount } from "../updates/changes";
import {
  nextUpdateAct,
  takeUpdateStep,
  updateViewOf,
  useUpdateWanted,
  wantUpdate,
  type UpdateView,
} from "../updates/wanted";

interface UpdateToTake {
  readonly state: DesktopUpdateState;
  readonly step: UpdateStep;
}

/** Stemcells' own update, while there is one to take; null when it's up to date or not the desktop app. */
export function useUpdateToTake(): UpdateToTake | null {
  const state = useDesktopUpdateState();
  const step = state === null ? null : updateStep(state);
  return state === null || step === null ? null : { state, step };
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
 * The column's word that Stemcells gets better. Hovering or clicking it lists what got better,
 * each a link to its pull request, and offers one Update. That gets the update ready, then
 * restarts once no Cell is at work; until then the column says what it waits for.
 */
export function UpdateBanner(props: { update: UpdateToTake }) {
  const { state, step } = props.update;
  const wanted = useUpdateWanted((store) => store.wanted);
  const atWork = useCellsAtWork();
  const view = updateViewOf({
    status: state.status,
    step,
    percent: state.downloadPercent,
    wanted,
    atWork,
  });
  const total = updateChangeCount(state);
  const count = total === 0 ? null : changeCountLabel(total, state.omittedReleaseCount > 0);
  const label = [
    `${APP_NAME} gets better`,
    count === null ? null : `${count} ${total === 1 ? "change" : "changes"}`,
    view.line,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div data-cells-better="">
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={150}
          closeDelay={150}
          render={
            <button type="button" aria-label={label} data-cells-better-open="" data-step={step} />
          }
        >
          <GiftIcon aria-hidden />
          <span data-cells-better-words="">{APP_NAME} gets better</span>
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
          <WhatGotBetter state={state} total={total} />
          <UpdateAct view={view} version={state.downloadedVersion} />
        </PopoverPopup>
      </Popover>
    </div>
  );
}

/** What the update makes better, newest first, each opening its pull request. */
function WhatGotBetter(props: { state: DesktopUpdateState; total: number }) {
  const betters = bettersOf(props.state);
  const listed = betters.slice(0, LISTED);
  const more = Math.max(props.total, betters.length) - listed.length;
  return (
    <div data-better="">
      <h3 data-better-title="">What got better</h3>
      <ul data-better-list="">
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

/** The popover's one action, with a sentence over it when what happens next isn't plain. */
function UpdateAct(props: { view: UpdateView; version: string | null }) {
  const { view } = props;
  if (view.act === null && view.note === null) return null;
  return (
    <div data-better-act="">
      {view.note === null ? null : <p data-better-note="">{view.note}</p>}
      {view.act === "restart-now" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void takeUpdateStep("restart", props.version, installUpdate)}
        >
          Restart now
        </Button>
      ) : view.act === null ? null : (
        <Button size="sm" onClick={wantUpdate}>
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
  // oxlint-disable-next-line t3code/react-effect-budget -- Start the update's next bridge step once, when where it stands calls for it.
  useEffect(() => {
    if (act === "download") void takeUpdateStep(act, version, downloadUpdate);
    if (act === "restart") void takeUpdateStep(act, version, installUpdate);
  }, [act, version]);
  return null;
}
