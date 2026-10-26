/**
 * The window-input gates on a module's surface: a chat that doesn't own the window's input gets
 * its window shortcuts, type-to-focus, open-in shortcut, paste-to-focus and composer shortcuts
 * off; one that owns it, or is outside any pane, keeps upstream's. Upstream's hooks and picker
 * are stand-ins recording what they were handed.
 */
import { use, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { BackgroundThreadContext } from "../../../components/chat/backgroundThread";
import { ChatWindowInputContext } from "../../../components/chat/chatWindowInput";
import upstreamPendingInputSource from "../../../components/chat/ComposerPendingUserInputPanel.tsx?raw";
import upstreamComposerStashSource from "../../../components/chat/useComposerStash.ts?raw";
import { ChatPanelHostContext } from "../chatPanel";
import { WindowInputGate } from "../windowInput";
import { OpenInPicker } from "./OpenInPicker";
import { useChatShortcuts } from "./useChatShortcuts";
import { usePasteToFocusComposer } from "./usePasteToFocusComposer";

const handed = vi.hoisted(() => ({
  shortcutsEnabled: [] as boolean[],
  shortcutCommands: [] as string[][],
  openInShortcut: [] as Array<boolean | undefined>,
  pasteThread: [] as Array<string | null>,
  background: [] as boolean[],
}));

vi.mock(import("../../../components/chat/useChatShortcuts"), async (importOriginal) => ({
  ...(await importOriginal()),
  useChatShortcuts: ((input: {
    readonly enabled: boolean;
    readonly commands?: Record<string, unknown>;
    readonly fallback?: (command: string) => unknown;
  }) => {
    handed.shortcutsEnabled.push(input.enabled);
    // What the chat will answer: its commands, and what its fallback takes.
    handed.shortcutCommands.push([
      ...Object.keys(input.commands ?? {}),
      ...FALLBACK_ASKED.filter((command) => input.fallback?.(command) !== undefined),
    ]);
  }) as never,
}));

vi.mock(import("../../../components/chat/OpenInPicker"), async (importOriginal) => ({
  ...(await importOriginal()),
  OpenInPicker: ((props: { readonly enableShortcut?: boolean }) => {
    handed.openInShortcut.push(props.enableShortcut);
    return null;
  }) as never,
}));

vi.mock(import("../../../components/chat/usePasteToFocusComposer"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePasteToFocusComposer: ((threadId: string | null) => {
    handed.pasteThread.push(threadId);
  }) as never,
}));

function inChat(owns: boolean | undefined, children: ReactNode): string {
  return renderToStaticMarkup(
    owns === undefined ? (
      children
    ) : (
      <ChatWindowInputContext value={owns}>{children}</ChatWindowInputContext>
    ),
  );
}

const FALLBACK_ASKED = ["terminal.new", "script.build.run"];
const COMMANDS = [
  "terminal.toggle",
  "rightPanel.toggle",
  "diff.toggle",
  "chat.new",
  "composer.mode",
];

function Shortcuts({ enabled }: { readonly enabled: boolean }) {
  useChatShortcuts({
    enabled,
    commands: Object.fromEntries(COMMANDS.map((command) => [command, () => {}])),
    fallback: () => () => {},
  } as unknown as Parameters<typeof useChatShortcuts>[0]);
  return null;
}

function inBareChat(bare: boolean, children: ReactNode): string {
  return renderToStaticMarkup(
    <ChatPanelHostContext value={{ node: null, owns: true, focused: true, threadKey: null, bare }}>
      {children}
    </ChatPanelHostContext>,
  );
}

function PasteToFocus({ threadId }: { readonly threadId: string | null }) {
  usePasteToFocusComposer(threadId as never, { current: null } as never);
  return null;
}

/** What upstream's composer reads of its gate, inside ours. */
function Composer() {
  handed.background.push(use(BackgroundThreadContext));
  return null;
}

const gated = (underModal: boolean) => (
  <BackgroundThreadContext value={underModal}>
    <WindowInputGate>
      <Composer />
    </WindowInputGate>
  </BackgroundThreadContext>
);

type PickerProps = Parameters<typeof OpenInPicker>[0];
const PICKER = {
  environmentId: "local",
  keybindings: [],
  availableEditors: [],
  openInCwd: null,
} as unknown as PickerProps;

const picker = (enableShortcut?: boolean) => (
  <OpenInPicker {...PICKER} {...(enableShortcut === undefined ? {} : { enableShortcut })} />
);

describe("a chat's window shortcuts", () => {
  it("are off in a chat that doesn't own the window's input", () => {
    handed.shortcutsEnabled.length = 0;
    inChat(false, <Shortcuts enabled />);
    expect(handed.shortcutsEnabled).toEqual([false]);
  });

  it("are as upstream asks in the chat that owns it, and outside a pane", () => {
    handed.shortcutsEnabled.length = 0;
    inChat(true, <Shortcuts enabled />);
    inChat(undefined, <Shortcuts enabled />);
    inChat(true, <Shortcuts enabled={false} />);
    expect(handed.shortcutsEnabled).toEqual([true, true, false]);
  });
});

describe("a bare chat's shortcuts (Aski's)", () => {
  it("open no surface and no terminal, and keep the rest", () => {
    handed.shortcutCommands.length = 0;
    inBareChat(true, <Shortcuts enabled />);
    inBareChat(false, <Shortcuts enabled />);
    expect(handed.shortcutCommands).toEqual([
      ["chat.new", "composer.mode", "script.build.run"],
      [...COMMANDS, ...FALLBACK_ASKED],
    ]);
  });
});

describe("the open-in shortcut", () => {
  it("is off in a chat that doesn't own the window's input", () => {
    handed.openInShortcut.length = 0;
    inChat(false, picker(true));
    inChat(false, picker());
    expect(handed.openInShortcut).toEqual([false, false]);
  });

  it("is as upstream asks in the chat that owns it, and outside a pane", () => {
    handed.openInShortcut.length = 0;
    inChat(true, picker());
    inChat(undefined, picker(true));
    inChat(true, picker(false));
    expect(handed.openInShortcut).toEqual([true, true, false]);
  });
});

describe("paste-to-focus", () => {
  // Upstream's hook takes no paste without a thread.
  it("takes no paste in a chat that doesn't own the window's input", () => {
    handed.pasteThread.length = 0;
    inChat(false, <PasteToFocus threadId="thread-1" />);
    expect(handed.pasteThread).toEqual([null]);
  });

  it("takes the chat's pastes in the chat that owns it, and outside a pane", () => {
    handed.pasteThread.length = 0;
    inChat(true, <PasteToFocus threadId="thread-1" />);
    inChat(undefined, <PasteToFocus threadId="thread-2" />);
    inChat(true, <PasteToFocus threadId={null} />);
    expect(handed.pasteThread).toEqual(["thread-1", "thread-2", null]);
  });
});

describe("a composer's global shortcuts", () => {
  it("stand down in a chat that doesn't own the window's input, as under Settings", () => {
    handed.background.length = 0;
    inChat(false, gated(false));
    inChat(true, gated(true));
    expect(handed.background).toEqual([true, true]);
  });

  it("stay up in the chat that owns it, and outside a pane", () => {
    handed.background.length = 0;
    inChat(true, gated(false));
    inChat(undefined, gated(false));
    expect(handed.background).toEqual([false, false]);
  });

  it("are the stash shortcut and the question's digit keys, which upstream gates on it", () => {
    expect(upstreamComposerStashSource).toMatch(
      /if \(backgroundThread\) return;\s*return registerCommands\(\s*\{ "composer\.stash": handleStashShortcut \}/,
    );
    expect(upstreamPendingInputSource).toContain(
      "const backgroundThread = use(BackgroundThreadContext);",
    );
    expect(upstreamPendingInputSource).toMatch(/\|\| isCollapsed \|\| backgroundThread\b/);
  });
});
