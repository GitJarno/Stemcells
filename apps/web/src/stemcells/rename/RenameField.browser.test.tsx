import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../upstream/testRender";
import { NAME_MAX_LENGTH } from "./limits";
import { RenameField } from "./RenameField";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

function Field(props: { onCommit: (value: string) => string | void; onCancel: () => void }) {
  return (
    <div>
      <RenameField value="Say hi" label="Title" {...props} />
      <div data-testid="composer" tabIndex={-1} contentEditable suppressContentEditableWarning />
    </div>
  );
}

const partsOf = (container: HTMLElement) => ({
  input: container.querySelector("input")!,
  composer: container.querySelector<HTMLElement>('[data-testid="composer"]')!,
});

// The one-liner's and the tab's inline rename: the same field, the same keys.
describe("a name open for a new one", () => {
  it("opens focused and selected; Enter keeps the new name, Escape the old", async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    await using screen = await render(<Field onCommit={onCommit} onCancel={onCancel} />);
    const { input } = partsOf(screen.container);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Say hi".length);
    expect(input.maxLength).toBe(NAME_MAX_LENGTH);
    await userEvent.keyboard("Hello{Enter}");
    expect(onCommit).toHaveBeenCalledWith("Hello");
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // A double-click whose first click opened a tab opens the field as the
  // tab's chat focuses its composer: the focus went back to the composer,
  // the field closed, and the double-click seemed to do nothing.
  it("takes back a focus the app takes before the person acts, and keeps the name once they do", async () => {
    const onCommit = vi.fn();
    await using screen = await render(<Field onCommit={onCommit} onCancel={() => undefined} />);
    const { input, composer } = partsOf(screen.container);
    composer.focus();
    await tick();
    expect(document.activeElement).toBe(input);
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.keyboard("Hello");
    composer.focus();
    await tick();
    expect(onCommit).toHaveBeenCalledWith("Hello");
    expect(document.activeElement).toBe(composer);
  });

  // ⌘T while the field was new: the new Cell's composer took the focus, the
  // field took it back, and the prompt typed next became the old chat's
  // title. The workspace's key listener stops ⌘T from going further, so the
  // field hears keys on the window ahead of it.
  it("lets a shortcut's focus go where it sent it, however the shortcut's key was stopped", async () => {
    const onCommit = vi.fn();
    await using screen = await render(<Field onCommit={onCommit} onCancel={() => undefined} />);
    const { input, composer } = partsOf(screen.container);
    const newCell = (event: KeyboardEvent) => {
      if (event.key !== "t" || !event.metaKey) return;
      event.stopImmediatePropagation();
      composer.focus();
    };
    window.addEventListener("keydown", newCell, true);
    try {
      expect(document.activeElement).toBe(input);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", metaKey: true }));
      await tick();
      expect(document.activeElement).toBe(composer);
      expect(onCommit).toHaveBeenCalledWith("Say hi");
    } finally {
      window.removeEventListener("keydown", newCell, true);
    }
  });

  // A rename that couldn't apply left the field open with no word why.
  it("stays open with what was typed when the name can't be applied, saying why until it changes", async () => {
    const why = "Can't rename this Cell here";
    const onCommit = vi.fn((): string | void => why);
    const onCancel = vi.fn();
    await using screen = await render(<Field onCommit={onCommit} onCancel={onCancel} />);
    const { input } = partsOf(screen.container);
    await userEvent.keyboard("Later{Enter}");
    expect(onCommit).toHaveBeenCalledWith("Later");
    expect(input.isConnected).toBe(true);
    expect(input.value).toBe("Later");
    const note = await vi.waitFor(() => {
      const popup = document.querySelector<HTMLElement>('[data-slot="tooltip-popup"]');
      expect(popup?.textContent).toBe(why);
      return popup!;
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(note.id);

    await userEvent.keyboard("r");
    await vi.waitFor(() =>
      expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull(),
    );
    expect(input.hasAttribute("aria-invalid")).toBe(false);

    onCommit.mockReturnValue(why);
    await userEvent.keyboard("{Enter}{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
