import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { PageStrip } from "../tabs/pageStrip";
import { COLUMN_STAGES, parseColumnStage, type ColumnStage } from "./column";

/**
 * The column's stages side by side, a page each, in the line's order, and the two-finger swipe
 * between them from anywhere on the column (`surface`). It is the tabs' own strip, so a stage
 * follows the fingers, springs and lands as a tab's page does. Only the stage on show takes input.
 */
export function StagePager(props: {
  stage: ColumnStage;
  onTurn: (stage: ColumnStage) => void;
  /** Where the stages are headed: the one nearest as the fingers move them, then the one they land on. */
  onAim: (stage: ColumnStage) => void;
  /** The column, once it is in the page; until then the stages alone take the swipe. */
  surface: HTMLElement | null;
  /** Each stage's page. */
  pages: Readonly<Record<ColumnStage, ReactNode>>;
}) {
  const [strip] = useState(() => new PageStrip());
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { surface } = props;

  // oxlint-disable-next-line t3code/react-effect-budget -- Attach the stage strip to its viewport and the column's surface; detach on unmount.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || stripRef.current === null) return;
    strip.attach(viewport, stripRef.current, surface ?? viewport);
    return () => strip.detach();
  }, [strip, surface]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Hand the strip this render's open stage and turn before paint.
  useLayoutEffect(() => {
    strip.aimed((stage) => props.onAim(parseColumnStage(stage)));
    strip.sync(COLUMN_STAGES, props.stage, (stage) => props.onTurn(parseColumnStage(stage)));
  });

  return (
    <div ref={viewportRef} data-cells-pages="" data-stage={props.stage}>
      <div ref={stripRef} data-cells-strip="">
        {COLUMN_STAGES.map((stage) => (
          <div
            key={stage}
            ref={(node) => {
              strip.setPage(stage, node);
              return () => strip.setPage(stage, null);
            }}
            data-cells-page={stage}
            inert={stage !== props.stage}
          >
            {props.pages[stage]}
          </div>
        ))}
      </div>
    </div>
  );
}
