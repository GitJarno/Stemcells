/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (peers.css), outside upstream's Tailwind entry. */
// Another Cell a chat names (stemcells/tasks/cell-tokens.md): its Cell held still and its name
// as a token. A pause over it peeks at what it's on; a click opens it beside the chat that
// named it, or brings it forward where it's open, and its pane rings once.
import { useNeeds } from "../needs/stream";
import type { Stage } from "../needs/wire";
import { CellMini } from "../rail/CellMini";
import { ringCell } from "../tabs/arrival";
import { openCellBeside } from "../tabs/commands";
import type { CellRef } from "../tabs/layout";
import { useOpenCell } from "../upstream/column";
import { useCellPlace, useCellSettled, useCellTitle } from "../upstream/thread";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "../upstream/ui";

import "./peers.css";

type Shown = Stage | "settled";

const WORD: Readonly<Record<Shown, string>> = {
  working: "Flying",
  "needs-you": "Input",
  done: "Landed",
  settled: "Settled",
};

export function CellToken(props: {
  readonly environmentId: string;
  readonly threadId: string;
  readonly label: string;
}) {
  const cell: CellRef = {
    environmentId: props.environmentId,
    threadId: props.threadId,
    draftId: null,
  };
  const { cells } = useNeeds();
  const standing = cells?.find((each) => each.threadId === props.threadId) ?? null;
  const settled = useCellSettled(cell);
  const title = useCellTitle(cell);
  const place = useCellPlace(cell);
  const shown: Shown | null = settled ? "settled" : (standing?.stage ?? null);
  const openHere = useOpenCell();
  const open = () => {
    if (!openCellBeside(cell)) openHere(cell);
    ringCell(props.threadId);
  };
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={350}
        closeDelay={120}
        render={
          <button
            type="button"
            className="sc-peer-who"
            data-stemcells-cell-token=""
            data-stage={shown ?? undefined}
            onClick={open}
          />
        }
      >
        <TokenFace cell={cell} points={1} />
        <span className="sc-peer-name">{props.label}</span>
      </PreviewCardTrigger>
      <PreviewCardPopup>
        <div className="sc-cell-peek">
          <div className="sc-cell-peek-head">
            <TokenFace cell={cell} points={2} />
            <span className="sc-peer-name">{props.label}</span>
            {shown === null ? null : (
              <span className="sc-cell-peek-stage" data-stage={shown}>
                {WORD[shown]}
              </span>
            )}
          </div>
          {title ? <p className="sc-cell-peek-title">{title}</p> : null}
          {standing?.line || place ? (
            <p className="sc-cell-peek-meta">
              {[standing?.line, place?.name].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}

function TokenFace(props: { cell: CellRef; points: number }) {
  return (
    <span className="sc-cell-token-face" aria-hidden>
      <CellMini
        environmentId={props.cell.environmentId}
        threadId={props.cell.threadId}
        points={props.points}
      />
    </span>
  );
}
