/**
 * The pieces a Cell's one-line row is drawn from: its plate, the Cell's box, its title and its
 * end. The left column's rows are these (`Cells.tsx`) and so are the rows of Aski's plan
 * (`aski/plan/PlanRow.tsx`): a change here carries to both. `cells.css` draws them.
 */
import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";

import { STATUS_WORDS } from "../../../../../stemcells/words/awake.ts";
import type { RowState, RowStatus } from "./awake";
import { STATUS_ICON } from "./StatusIcon";

/** A row's light: what its Cell does, in its provider's tone. */
export interface RowLight {
  readonly state: RowState;
  readonly tone: string;
}

/** A row's one act, in its end: Sleep or Wake in the column, Off or On in a plan. */
export interface RowAct {
  readonly label: string;
  readonly icon: ReactNode;
  readonly run: () => void;
}

/** The row's plate: the whole line is one press, and Enter or Space on it is the same. */
export const rowPlateProps = (props: { light: RowLight | null; onOpen: () => void }) =>
  ({
    role: "button",
    tabIndex: 0,
    "data-cells-open": "",
    "data-light": props.light?.state,
    style:
      props.light === null
        ? undefined
        : ({ "--cells-row-tone": `var(${props.light.tone})` } as CSSProperties),
    onClick: props.onOpen,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      props.onOpen();
    },
  }) as const;

/** The field behind a lit row; the column's rows cross it with their band. */
export function RowField(props: { children?: ReactNode }) {
  return (
    <span data-cells-light="" aria-hidden>
      {props.children}
    </span>
  );
}

/** The Cell's own box at the row's start: its creature forms there. */
export function RowCell(props: { children: ReactNode }) {
  return <span data-cells-row-cell="">{props.children}</span>;
}

export function RowTitle({
  ref,
  settles,
  children,
}: {
  ref?: Ref<HTMLSpanElement>;
  /** A part of a line that settles out of glyphs (`Planned.tsx`). */
  settles?: boolean;
  children: ReactNode;
}) {
  return (
    <span ref={ref} data-cells-row-title="" data-settle={settles ? "" : undefined}>
      {children}
    </span>
  );
}

/**
 * The row's end: its status icon and its time, and its act, which takes their place while the
 * row is pointed at or the act holds the focus.
 */
export function RowEnd(props: {
  /** Whether the row keeps the icon's place, so every lit row's time lines up. */
  lit: boolean;
  status: RowStatus | null;
  when: ReactNode;
  act: RowAct | null;
}) {
  const { status, act } = props;
  return (
    <span data-cells-row-end="">
      <span
        data-cells-row-age=""
        className={status === null ? undefined : STATUS_ICON[status].className}
      >
        {props.lit ? <RowStatusIcon status={status} /> : null}
        <span data-cells-row-time="">{props.when}</span>
      </span>
      {act === null ? null : (
        <button
          type="button"
          aria-label={act.label}
          data-cells-act=""
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            act.run();
          }}
        >
          {act.icon}
        </button>
      )}
    </span>
  );
}

/** The icon's place before the time, kept when there is none, so every row's time lines up. */
function RowStatusIcon(props: { status: RowStatus | null }) {
  if (props.status === null) return <span data-cells-row-status="" aria-hidden />;
  const { Icon } = STATUS_ICON[props.status];
  return (
    <span data-cells-row-status="" role="img" aria-label={STATUS_WORDS[props.status]}>
      <Icon aria-hidden />
    </span>
  );
}
