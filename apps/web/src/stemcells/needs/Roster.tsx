import { useState } from "react";

import { cellNameOf } from "../cell/name";
import { useOpenFromNeeds, usePrimaryEnvironmentId } from "../upstream/needs";
import { useSettleCell } from "../upstream/settle";
import { useCellPlace } from "../upstream/thread";
import { useNeeds } from "./stream";
import type { CellStanding, Stage } from "./wire";

import "./roster.css";

const STAGE: Record<Stage, string> = {
  working: "Working",
  "needs-you": "Needs you",
  done: "Done",
};

/** Rows the roster shows before "N more". */
const ROWS = 6;

/** "2 working · 1 needs you · 3 done", leaving out a stage nobody is at. */
function rosterSummary(cells: ReadonlyArray<CellStanding>): string {
  const count = (stage: Stage) => cells.filter((cell) => cell.stage === stage).length;
  return (["working", "needs-you", "done"] as const)
    .flatMap((stage) => {
      const n = count(stage);
      return n === 0 ? [] : [`${n} ${STAGE[stage].toLowerCase()}`];
    })
    .join(" · ");
}

/**
 * Under Aski's chat: every Cell in reach, newest first, at a glance
 * (stemcells/tasks/aski-manager.md, decision 10). A row is the Cell's
 * stage, its name, what it's on and where; a click opens its chat.
 */
export function Roster() {
  const { cells } = useNeeds();
  const [all, setAll] = useState(false);
  if (cells === null || cells.length === 0) return null;
  const shown = all ? cells : cells.slice(0, ROWS);
  return (
    <section data-stemcells-roster="" aria-label="Cells">
      <div data-roster-head="">
        <b>Cells</b>
        <span>{rosterSummary(cells)}</span>
      </div>
      <ol>
        {shown.map((cell) => (
          <RosterRow key={cell.threadId} cell={cell} />
        ))}
      </ol>
      {cells.length > ROWS ? (
        <button type="button" data-roster-more="" onClick={() => setAll(!all)}>
          {all ? "Fewer" : `${cells.length - ROWS} more`}
        </button>
      ) : null}
    </section>
  );
}

function RosterRow(props: { cell: CellStanding }) {
  const { cell } = props;
  const environmentId = usePrimaryEnvironmentId();
  const place = useCellPlace(
    environmentId === null ? null : { environmentId, threadId: cell.threadId, draftId: null },
  );
  const open = useOpenFromNeeds();
  return (
    <li data-stage={cell.stage}>
      <button type="button" onClick={() => open.chat(cell.threadId)}>
        <span data-roster-dot="" aria-hidden />
        <span data-roster-name="">{cellNameOf(cell.threadId)}</span>
        <span data-roster-title="">{cell.title}</span>
        <span data-roster-place="">{place?.name ?? ""}</span>
        <span data-roster-stage="">{STAGE[cell.stage]}</span>
      </button>
    </li>
  );
}

/**
 * The column's foot: each Cell that is done, with its own Done line and
 * Settle, which puts it away (upstream's settle, with its Undo). Done asks
 * nothing, so it sits under what needs you.
 */
export function DoneList() {
  const { cells } = useNeeds();
  const environmentId = usePrimaryEnvironmentId();
  const settle = useSettleCell();
  const open = useOpenFromNeeds();
  const done = (cells ?? []).filter((cell) => cell.stage === "done");
  if (done.length === 0 || environmentId === null) return null;
  const settleAll = () => {
    for (const cell of done) void settle({ environmentId, threadId: cell.threadId });
  };
  return (
    <section data-needs-done="" aria-label="Done">
      <div data-needs-done-head="">
        <b>Done</b>
        {done.length > 1 ? (
          <button type="button" onClick={settleAll}>
            Settle all
          </button>
        ) : null}
      </div>
      {done.map((cell) => (
        <div key={cell.threadId} data-needs-done-row="">
          <button type="button" data-needs-done-open="" onClick={() => open.chat(cell.threadId)}>
            <b>{cellNameOf(cell.threadId)}</b>
            <span>{cell.line ?? cell.title}</span>
          </button>
          <button
            type="button"
            data-needs-settle=""
            onClick={() => void settle({ environmentId, threadId: cell.threadId })}
          >
            Settle
          </button>
        </div>
      ))}
    </section>
  );
}
