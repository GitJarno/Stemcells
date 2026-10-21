/**
 * Upstream's right panel (a thread's surfaces: terminals, browser, diff,
 * files, pull requests), hosted by the tab rather than by each chat.
 *
 * Upstream draws the panel inside its thread view, beside the chat. With
 * several chats on a tab, the tab keeps one panel, the workbench, at the
 * slate's right edge, and it shows the focused chat's surfaces: the focused
 * chat's view renders its panel into the workbench, the others render none.
 * Upstream keeps each thread's surfaces apart, so focusing another chat shows
 * that chat's, as switching threads does upstream.
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
  if (host === null || props.mode !== "inline") return <RightPanelTabs {...props} />;
  return (
    <WorkbenchPanel
      workbench={host.node}
      shows={shows}
      focused={host.focused}
      maximized={props.maximized === true}
      Frame={RightPanelTabs}
      frameProps={props}
    >
      {props.children}
    </WorkbenchPanel>
  );
}

/**
 * A chat's panel in its page's workbench. On stage it holds the chat's
 * surfaces. Off stage, the focused chat's panel keeps its frame and tabs
 * there, inert and holding nothing: the page lays out at its real width and
 * slides in with its Surface, and what the Surface shows, a live browser
 * above all, comes only with the stage, where it fades in (`workspace.css`).
 */
export function WorkbenchPanel<P extends { children?: ReactNode }>(props: {
  workbench: HTMLElement | null;
  /** Whether the panel holds its surfaces: its chat owns the workbench, or just did. */
  shows: boolean;
  /** Whether its chat is its page's focused one. */
  focused: boolean;
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
    <div inert={!props.shows} style={{ display: "contents" }}>
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
  useLayoutEffect(() => {
    if (!maximized || tell === null) return;
    tell(true);
    return () => tell(false);
  }, [maximized, tell]);
}

/** Upstream's narrow-window sheet: a window overlay, so only the owning chat's opens. */
export function ChatPanelSheet(props: ComponentProps<typeof RightPanelSheet>) {
  const host = use(ChatPanelHostContext);
  if (host !== null && !host.owns) return null;
  return <RightPanelSheet {...props} />;
}
