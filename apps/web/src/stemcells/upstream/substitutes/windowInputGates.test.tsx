/**
 * The window-input gates that sit on a module's surface: a chat that doesn't
 * own the window's input (another pane has it) gets its window shortcuts,
 * type-to-focus and open-in shortcut switched off, and a chat that owns it,
 * or one outside any pane, keeps what upstream asked for. Upstream's hook and
 * picker are stand-ins that record what they were handed.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { ChatWindowInputContext } from "../../../components/chat/chatWindowInput";
import { OpenInPicker } from "./OpenInPicker";
import { useChatShortcuts } from "./useChatShortcuts";

const handed = vi.hoisted(() => ({
  shortcutsEnabled: [] as boolean[],
  openInShortcut: [] as Array<boolean | undefined>,
}));

vi.mock(import("../../../components/chat/useChatShortcuts"), async (importOriginal) => ({
  ...(await importOriginal()),
  useChatShortcuts: ((input: { readonly enabled: boolean }) => {
    handed.shortcutsEnabled.push(input.enabled);
  }) as never,
}));

vi.mock(import("../../../components/chat/OpenInPicker"), async (importOriginal) => ({
  ...(await importOriginal()),
  OpenInPicker: ((props: { readonly enableShortcut?: boolean }) => {
    handed.openInShortcut.push(props.enableShortcut);
    return null;
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

function Shortcuts({ enabled }: { readonly enabled: boolean }) {
  useChatShortcuts({ enabled } as Parameters<typeof useChatShortcuts>[0]);
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
