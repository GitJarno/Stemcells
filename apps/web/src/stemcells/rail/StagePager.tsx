import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { PageStrip } from "../tabs/pageStrip";
import { COLUMN_STAGES, parseColumnStage, type ColumnStage } from "./column";

/**
 * The column's stages side by side, a page each, in the line's order, and the two-finger swipe
 * between them from anywhere on the column: the column is the strip's proxy (`tabs/proxy.ts`).
 * It is the tabs' own strip, so a stage follows the fingers and lands as a tab's page does. Only
 * the stage on show takes input.
 */
export function StagePager(props: {
  stage: ColumnStage;
  onTurn: (stage: ColumnStage) => void;
  /** Where the stages are headed: the one nearest as the fingers move them, then the one they land on. */
  onAim: (stage: ColumnStage) => void;
  /** The column, the stages' proxy, once it is in the page; until then nothing swipes them. */
  proxy: HTMLElement | null;
  /** Each stage's page. */
  pages: Readonly<Record<ColumnStage, ReactNode>>;
}) {
  const [strip] = useState(() => new PageStrip());
  const holdRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { proxy } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Attach the stage strip to the column's proxy; detach on unmount.
  useLayoutEffect(() => {
    if (proxy === null || holdRef.current === null || stripRef.current === null) return;
    strip.attach(proxy, holdRef.current, stripRef.current);
    return () => strip.detach();
  }, [strip, proxy]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the strip this render's open stage and turn before paint.
  useLayoutEffect(() => {
    strip.aimed((stage) => props.onAim(parseColumnStage(stage)));
    strip.sync(COLUMN_STAGES, props.stage, (stage) => props.onTurn(parseColumnStage(stage)));
  });

  return (
    <div data-cells-pages="" data-stage={props.stage}>
      <div ref={holdRef} data-stemcells-hold="">
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
    </div>
  );
}
