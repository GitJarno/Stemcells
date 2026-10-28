/**
 * Upstream's right panel (a thread's terminals, browser, diff, files, pull requests), hosted
 * once per tab as the workbench at the slate's right edge rather than beside each chat: the
 * focused chat's view renders its panel there, the others none. Upstream keeps each thread's
 * surfaces apart, so focusing another chat shows its own, as switching threads does.
 */
import {
  createContext,
  use,
  useLayoutEffect,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { RightPanelSheet } from "../../components/RightPanelSheet";
import { RightPanelTabs } from "../../components/RightPanelTabs";
import { useOwnedUntilRest } from "../surfaces/keep";

export interface ChatPanelHost {
  /** The workbench's node; null until it mounts. */
  readonly node: HTMLElement | null;
  /** Whether this chat's panel is the one the workbench shows. */
  readonly owns: boolean;
  /** Whether this chat is its page's focused one, whose panel the workbench shows on stage. */
  readonly focused: boolean;
  /** The chat's thread (a draft's is its thread), which the panel names while it holds its surfaces. */
  readonly threadKey: string | null;
  /** A chat with no surfaces and no terminal (Aski's): it has no project to show them for. */
  readonly bare?: boolean;
}

/** Null (the default): the panel stays beside its chat, as upstream draws it. */
export const ChatPanelHostContext = createContext<ChatPanelHost | null>(null);

/**
 * Told when a chat's panel in the workbench is maximized (true) and when it
 * no longer is (false), so the page gives the workbench all its room. The
 * page hears it here rather than finding the panel with `:has()`: a `:has()`
 * on the page restyled all of it whenever anything in a composer changed.
 */
export const PanelMaximizedContext = createContext<((maximized: boolean) => void) | null>(null);

/**
 * Upstream's panel, in the workbench when a host gives one. The sheet's own
 * tabs (narrow windows) stay inside the sheet.
 */
export function ChatPanelTabs(props: ComponentProps<typeof RightPanelTabs>) {
  const host = use(ChatPanelHostContext);
  // The page a turn leaves keeps its surfaces until the pages rest.
  const shows = useOwnedUntilRest(host?.owns ?? false, host?.node ?? null);
  if (host?.bare) return null;
  if (host === null || props.mode !== "inline") return <RightPanelTabs {...props} />;
  return (
    <WorkbenchPanel
      workbench={host.node}
      shows={shows}
      focused={host.focused}
      threadKey={host.threadKey}
      maximized={props.maximized === true}
      Frame={RightPanelTabs}
      frameProps={props}
    >
      {props.children}
    </WorkbenchPanel>
  );
}

/**
 * A chat's panel in its page's workbench, holding the chat's surfaces on stage. Off stage, the
 * focused chat's panel keeps its frame and tabs there, inert and empty, so the page lays out at
 * its real width and slides in with its Surface; what it shows, a live browser above all, comes
 * only with the stage, where it fades in (`workspace.css`).
 */
export function WorkbenchPanel<P extends { children?: ReactNode }>(props: {
  workbench: HTMLElement | null;
  /** Whether the panel holds its surfaces: its chat owns the workbench, or just did. */
  shows: boolean;
  /** Whether its chat is its page's focused one. */
  focused: boolean;
  /** Its chat's thread, named on the panel while it holds the surfaces (`surfaces/flight.ts`). */
  threadKey?: string | null;
  /** Whether upstream's panel is maximized: drawn, it tells the page (PanelMaximizedContext). */
  maximized?: boolean;
  /** Upstream's panel, the frame around what it holds, and its props. */
  Frame: ComponentType<P>;
  frameProps: P;
  children: ReactNode;
}) {
  const { Frame } = props;
  const workbench = props.shows || props.focused ? props.workbench : null;
  useTellMaximized(workbench !== null && props.maximized === true);
  if (workbench === null) return null;
  return createPortal(
    // One tree on and off stage, so the frame and tabs stay as the stage comes.
    <div
      inert={!props.shows}
      data-stemcells-panel-of={props.shows ? (props.threadKey ?? undefined) : undefined}
      style={{ display: "contents" }}
    >
      <Frame {...props.frameProps}>
        {props.shows ? (
          <div key="shown" data-stemcells-surface-body="" className="flex min-h-0 flex-1 flex-col">
            {props.children}
          </div>
        ) : (
          <div key="waiting" className="flex min-h-0 flex-1 flex-col" />
        )}
      </Frame>
    </div>,
    workbench,
  );
}

/** Tells the page while `maximized` holds. */
function useTellMaximized(maximized: boolean) {
  const tell = use(PanelMaximizedContext);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Tell the page while the panel is maximized, and take it back on change or unmount.
  useLayoutEffect(() => {
    if (!maximized || tell === null) return;
    tell(true);
    return () => tell(false);
  }, [maximized, tell]);
}

/** Upstream's narrow-window sheet: a window overlay, so only the owning chat's opens. */
export function ChatPanelSheet(props: ComponentProps<typeof RightPanelSheet>) {
  const host = use(ChatPanelHostContext);
  if (host !== null && (!host.owns || host.bare)) return null;
  return <RightPanelSheet {...props} />;
}
