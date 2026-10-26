import { GiftIcon } from "lucide-react";
import { useState } from "react";

import { APP_NAME } from "../brand/name";
import { Button, Popover, PopoverPopup, PopoverTrigger } from "../upstream/ui";
import {
  downloadUpdate,
  restartToUpdate,
  UpdateNotes,
  updateStep,
  useDesktopUpdateState,
  type DesktopUpdateState,
  type UpdateStep,
} from "../upstream/updates";
import { changeCountLabel, updateChangeCount } from "../updates/changes";

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

const ACTION: Record<Exclude<UpdateStep, "downloading">, string> = {
  download: "Download",
  restart: "Restart to update",
};

/**
 * The column's word that Stemcells gets better: how many pull requests the
 * update brings, and once it's ready, that it restarts. Hovering or clicking
 * it lists them by title, in upstream's notes, with the one thing to do next.
 */
export function UpdateBanner(props: { update: UpdateToTake }) {
  const { state, step } = props.update;
  const [busy, setBusy] = useState(false);
  const total = updateChangeCount(state);
  const count = total === 0 ? null : changeCountLabel(total, state.omittedReleaseCount > 0);
  const percent = step === "downloading" ? state.downloadPercent : null;
  const detail =
    step === "downloading"
      ? `Downloading${percent === null ? "…" : ` ${Math.floor(percent)}%`}`
      : step === "restart"
        ? ACTION.restart
        : null;
  const label = [
    `${APP_NAME} gets better`,
    count === null ? null : `${count} ${total === 1 ? "change" : "changes"}`,
    detail,
  ]
    .filter(Boolean)
    .join(", ");

  const act = () => {
    setBusy(true);
    void (step === "restart" ? restartToUpdate(state) : downloadUpdate()).finally(() =>
      setBusy(false),
    );
  };

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
          {detail === null ? null : <span data-cells-better-detail="">{detail}</span>}
          {step === "downloading" ? (
            <span data-cells-better-bar="" aria-hidden>
              <span style={{ transform: `scaleX(${(percent ?? 0) / 100})` }} />
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverPopup
          side="right"
          align="end"
          sideOffset={10}
          tooltipStyle
          initialFocus={false}
          aria-label="What the update brings"
        >
          <UpdateNotes state={state} />
          {step === "downloading" ? null : (
            <div data-cells-better-act="">
              <Button size="xs" disabled={busy} onClick={act}>
                {ACTION[step]}
              </Button>
            </div>
          )}
        </PopoverPopup>
      </Popover>
    </div>
  );
}
