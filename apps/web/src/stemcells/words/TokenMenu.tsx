/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (words.css), outside upstream's Tailwind entry. */
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Where the menu opens: under the word, or over it when there's more room there. */
export interface TokenMenuAt {
  readonly left: number;
  readonly width: number;
  readonly top?: number;
  readonly bottom?: number;
  readonly maxHeight: number;
}

export interface TokenMenuItem {
  readonly key: string;
  readonly label: string;
  /** A provider's mark, before the label. */
  readonly mark?: ReactNode;
  /** What the word sets now. */
  readonly current?: boolean;
  /** A line above the item: the menu's next part starts here. */
  readonly rule?: boolean;
  readonly pick: () => void;
}

/**
 * The small menu at a read word (decision 6). It never takes the focus:
 * the caret stays in the composer, typing closes it, and so do Esc and a
 * click anywhere else. It opens on what the word says now.
 */
export function TokenMenu(props: {
  readonly at: TokenMenuAt;
  readonly label: string;
  readonly items: ReadonlyArray<TokenMenuItem>;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const { left, width, top, bottom, maxHeight } = props.at;
  // A word near the composer's right edge: the menu keeps its least width
  // and moves left by what it would overhang, so it stays in the pane.
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    setShift(Math.max(0, Math.min(element.offsetWidth - width, left)));
    const current = element.querySelector<HTMLElement>("[data-current]");
    if (current)
      element.scrollTop = current.offsetTop - (element.clientHeight - current.offsetHeight) / 2;
  }, [left, width]);
  return createPortal(
    <div
      ref={menu}
      className="sc-word-menu"
      role="menu"
      aria-label={props.label}
      style={{ left: left - shift, top, bottom, maxWidth: width + shift, maxHeight }}
      // A press here keeps the caret where it is.
      onMouseDown={(event) => event.preventDefault()}
    >
      {props.items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="sc-word-menu-item"
          data-current={item.current ? "" : undefined}
          data-rule={item.rule ? "" : undefined}
          onClick={item.pick}
        >
          {item.mark ? <span className="sc-word-menu-mark">{item.mark}</span> : null}
          <span className="sc-word-menu-label">{item.label}</span>
          {item.current ? <span className="sc-word-menu-check">✓</span> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
