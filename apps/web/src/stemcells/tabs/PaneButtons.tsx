import { EllipsisIcon, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cellNameOf } from "../cell/name";
import { useCellTitle } from "../upstream/thread";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuTrigger,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "../upstream/ui";
import { LookChip } from "../workbench/LookFrame";
import { CellMark } from "./CellMark";
import type { CellRef } from "./layout";

/** Upstream's panel toggles for the chat in a pane (thread details, terminal, right panel). */
const TOGGLES = "[data-workspace-titlebar-controls]";
/** Ours, which join upstream's rows. */
const OURS = "[data-stemcells-pane-close], [data-stemcells-pane-more], [data-stemcells-look-chip]";

/** The rows the pane's buttons go in: the leftmost leads with the Look chip, the rightmost ends with ×. */
interface Rows {
  readonly first: HTMLElement;
  readonly last: HTMLElement;
}

/**
 * A pane's buttons, floating at its top-right while the pointer or focus is
 * in it (`workspace.css`): the Look chip first, then upstream's own panel
 * toggles for the chat, then × to close the pane, in one row. The toggles
 * stay upstream's, with upstream's state; the chip, the … and × join their
 * row, so they read as one. Upstream splits its toggles in two while the
 * chat's right panel is open (thread details by the header, the rest at the
 * chat's root): the chip leads the header's row, which sits left of the
 * other. In a narrow pane upstream's toggles fold into the … menu. Until
 * the chat has drawn its toggles (or where it draws none), the chip and ×
 * float on their own.
 */
export function PaneButtons(props: { cell: CellRef | null; onClose: (() => void) | null }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const rows = usePaneRows(anchor);

  const chip = <LookChip cell={props.cell} />;
  const close = props.onClose ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-stemcells-pane-close=""
            aria-label="Close pane"
            onClick={props.onClose}
          />
        }
      >
        <X aria-hidden />
      </TooltipTrigger>
      <TooltipPopup side="bottom">Close pane</TooltipPopup>
    </Tooltip>
  ) : null;
  return (
    <>
      <span ref={anchor} hidden />
      {rows ? (
        <>
          {createPortal(chip, rows.first)}
          {createPortal(
            <>
              <PaneMore />
              {close}
            </>,
            rows.last,
          )}
        </>
      ) : (
        <div data-stemcells-pane-buttons="">
          {chip}
          {close}
        </div>
      )}
    </>
  );
}

/**
 * A pane that shows upstream's toggles but none of our buttons (Aski's):
 * its split rows still sit side by side, so the thread details toggle never
 * covers the right panel's.
 */
export function PaneRows() {
  const anchor = useRef<HTMLSpanElement>(null);
  usePaneRows(anchor);
  return <span ref={anchor} hidden />;
}

/**
 * The rows of upstream's toggles in the pane around `anchor`, followed as
 * the chat lays out. While upstream splits them, the header's row sits left
 * of the root's (`workspace.css`, at the root row's width from the edge).
 */
function usePaneRows(anchor: RefObject<HTMLElement | null>): Rows | null {
  const [rows, setRows] = useState<Rows | null>(null);

  useLayoutEffect(() => {
    const pane = anchor.current?.closest<HTMLElement>("[data-stemcells-pane]");
    if (!pane) return;
    // The toggles move as the chat lays out (beside its header, or at its
    // root once its right panel is there), and go with the chat: follow them.
    let seen: HTMLElement[] = [];
    const follow = () => {
      const found = [...pane.querySelectorAll<HTMLElement>(TOGGLES)];
      if (found.length === seen.length && found.every((row, index) => row === seen[index])) return;
      seen = found;
      const byHeader = found.find((row) => row.closest("[data-chat-header]"));
      const atRoot = found.find((row) => !row.closest("[data-chat-header]"));
      const first = byHeader ?? atRoot;
      setRows(first ? { first, last: atRoot ?? first } : null);
    };
    follow();
    const moved = new MutationObserver(follow);
    moved.observe(pane, { childList: true, subtree: true });
    return () => moved.disconnect();
  }, [anchor]);

  // A split row sits left of the root's row, at its width from the edge.
  useLayoutEffect(() => {
    const pane = anchor.current?.closest<HTMLElement>("[data-stemcells-pane]");
    if (!pane || !rows || rows.first === rows.last) return;
    const { last } = rows;
    const place = () => pane.style.setProperty("--sc-pane-row", `${last.offsetWidth}px`);
    place();
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The width goes to a style property, never into React state.
    const sized = new ResizeObserver(place);
    sized.observe(last);
    return () => {
      sized.disconnect();
      pane.style.removeProperty("--sc-pane-row");
    };
  }, [anchor, rows]);

  return rows;
}

/** One of upstream's toggles, as the … menu lists it. */
interface Folded {
  readonly button: HTMLButtonElement;
  readonly label: string;
  readonly pressed: boolean;
  readonly disabled: boolean;
}

/**
 * The … that holds upstream's toggles where a narrow pane folds them
 * (`workspace.css` shows it only there). It lists them in upstream's words
 * and state as it opens, and a choice presses upstream's own button and
 * closes the menu, since the pane's layout changes under it.
 */
function PaneMore() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [folded, setFolded] = useState<ReadonlyArray<Folded>>([]);
  const read = () => {
    const pane = trigger.current?.closest<HTMLElement>("[data-stemcells-pane]");
    if (!pane) return;
    setFolded(foldedIn(pane));
  };
  return (
    <Menu onOpenChange={(open) => open && read()}>
      <MenuTrigger
        render={
          <button
            ref={trigger}
            type="button"
            data-stemcells-pane-more=""
            aria-label="More buttons"
          />
        }
      >
        <EllipsisIcon aria-hidden />
      </MenuTrigger>
      <MenuPopup align="end">
        {folded.map((toggle) => (
          <MenuCheckboxItem
            key={toggle.label}
            checked={toggle.pressed}
            disabled={toggle.disabled}
            closeOnClick
            onCheckedChange={() => toggle.button.click()}
          >
            {toggle.label}
          </MenuCheckboxItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

/**
 * Upstream's toggles in a pane's rows, named as upstream labels them, less
 * its "Toggle". One upstream keeps out of reach (inert, as maximize is
 * while the right panel is closed) stays out of the menu too.
 */
function foldedIn(pane: HTMLElement): ReadonlyArray<Folded> {
  return [...pane.querySelectorAll<HTMLButtonElement>(`${TOGGLES} button[aria-label]`)]
    .filter(
      (button) =>
        !button.matches(OURS) &&
        !button.closest("[data-stemcells-look-chip]") &&
        !button.closest("[inert]"),
    )
    .map((button) => {
      const label = (button.getAttribute("aria-label") ?? "").replace(/^Toggle /, "");
      return {
        button,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        pressed: button.getAttribute("aria-pressed") === "true",
        disabled: button.disabled,
      };
    });
}

/**
 * A pane with no composer names its Cell in a pill at its top-left, where
 * the line over the composer would otherwise say it (`workspace.css` shows
 * it only then).
 */
export function CellPill(props: { cell: CellRef }) {
  const title = useCellTitle(props.cell);
  return (
    <div data-stemcells-cell-pill="">
      <CellMark cell={props.cell} />
      <span data-stemcells-cell-pill-name="">{cellNameOf(props.cell.threadId)}</span>
      {title ? <span data-stemcells-cell-pill-title="">{title}</span> : null}
    </div>
  );
}
