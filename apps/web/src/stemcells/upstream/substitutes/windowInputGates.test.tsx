/**
 * The window-input gates that sit on a module's surface: a chat that doesn't
 * own the window's input (another pane has it) gets its window shortcuts,
 * type-to-focus, open-in shortcut, paste-to-focus and stash shortcut switched
 * off, and a chat that owns it, or one outside any pane, keeps what upstream
 * asked for.
 * Upstream's hooks and picker are stand-ins that record what they were handed.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { ChatWindowInputContext } from "../../../components/chat/chatWindowInput";
import { ChatPanelHostContext } from "../chatPanel";
import upstreamComposerStashSource from "../../../components/chat/useComposerStash.ts?raw";
import { OpenInPicker } from "./OpenInPicker";
import { useChatShortcuts } from "./useChatShortcuts";
import { useComposerStash } from "./useComposerStash";
import { usePasteToFocusComposer } from "./usePasteToFocusComposer";

const handed = vi.hoisted(() => ({
  shortcutsEnabled: [] as boolean[],
  shortcutCommands: [] as string[][],
  openInShortcut: [] as Array<boolean | undefined>,
  pasteThread: [] as Array<string | null>,
  stashKeys: [] as number[],
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

vi.mock(import("../../../components/chat/useComposerStash"), async (importOriginal) => ({
  ...(await importOriginal()),
  useComposerStash: ((input: { readonly keybindings: ReadonlyArray<unknown> }) => {
    handed.stashKeys.push(input.keybindings.length);
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

const KEYS = [{ command: "composer.stash" }, { command: "chat.new" }];

function Stash() {
  useComposerStash({ keybindings: KEYS } as never);
  return null;
}

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

describe("the stash shortcut", () => {
  it("hears no keys in a chat that doesn't own the window's input", () => {
    handed.stashKeys.length = 0;
    inChat(false, <Stash />);
    expect(handed.stashKeys).toEqual([0]);
  });

  it("hears the person's keys in the chat that owns it, and outside a pane", () => {
    handed.stashKeys.length = 0;
    inChat(true, <Stash />);
    inChat(undefined, <Stash />);
    expect(handed.stashKeys).toEqual([2, 2]);
  });

  it("is all upstream's stash reads its keys for, so the rest of the stash stays", () => {
    const uses = upstreamComposerStashSource
      .split("\n")
      .filter((line) => /\bkeybindings\b/.test(line));
    expect(uses.map((line) => line.trim())).toEqual([
      'import { resolveShortcutCommand } from "../../keybindings";',
      'readonly keybindings: ChatComposerProps["keybindings"];',
      "keybindings,",
      "const command = resolveShortcutCommand(event, keybindings, {",
      "keybindings,",
    ]);
    expect(upstreamComposerStashSource).toContain('if (command !== "composer.stash") return;');
  });
});
