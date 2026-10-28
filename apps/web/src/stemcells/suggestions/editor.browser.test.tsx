import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { type ComposerPromptEditorHandle, IDLE_PLACEHOLDER } from "../upstream/suggestions";
import { ComposerPromptEditorTiptap as ComposerPromptEditor } from "../upstream/substitutes/ComposerPromptEditorTiptap";
import { render } from "../upstream/testRender";
import { type PromptSuggestion, PromptSuggestionContext } from "./usePromptSuggestion";

// The composer shows its chat's suggestion only in place of upstream's idle
// hint, and Tab, → or a tap on its key fills it in as typing would.

function Composer(props: {
  readonly suggestion: PromptSuggestion | null;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
}) {
  const [prompt, setPrompt] = useState({ value: "", cursor: 0 });
  return (
    <PromptSuggestionContext value={props.suggestion}>
      <ComposerPromptEditor
        editorRef={createRef<ComposerPromptEditorHandle>()}
        value={prompt.value}
        cursor={prompt.cursor}
        contextRecords={new Map()}
        skills={[]}
        disabled={false}
        placeholder={props.placeholder ?? IDLE_PLACEHOLDER}
        onChange={(value, cursor) => {
          setPrompt({ value, cursor });
          props.onChange?.(value);
        }}
        onCommandKeyDown={() => false}
        onPaste={() => {}}
      />
    </PromptSuggestionContext>
  );
}

const ghostIn = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-stemcells-suggestion]");

const suggestion = (dismiss = () => {}): PromptSuggestion => ({ text: "run the tests", dismiss });

describe("the composer's suggestion", () => {
  it("fills in on Tab, and is gone once there are words", async () => {
    const onChange = vi.fn();
    await using screen = await render(<Composer suggestion={suggestion()} onChange={onChange} />);
    await expect.poll(() => ghostIn(screen.container)?.textContent).toContain("run the tests");
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Tab}");
    expect(onChange).toHaveBeenLastCalledWith("run the tests");
    await expect.poll(() => ghostIn(screen.container)).toBeNull();
    await userEvent.keyboard(" now");
    expect(onChange).toHaveBeenLastCalledWith("run the tests now");
  });

  it("fills in on a tap on its key, and hides on Esc", async () => {
    const onChange = vi.fn();
    const dismiss = vi.fn();
    await using screen = await render(
      <Composer suggestion={suggestion(dismiss)} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Escape}");
    expect(dismiss).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { includeHidden: true }));
    expect(onChange).toHaveBeenLastCalledWith("run the tests");
  });

  it("never stands in for a placeholder that asks something of the person", async () => {
    const onChange = vi.fn();
    await using screen = await render(
      <Composer
        suggestion={suggestion()}
        placeholder="Choose an option above"
        onChange={onChange}
      />,
    );
    await expect.element(screen.getByText("Choose an option above")).toBeVisible();
    expect(ghostIn(screen.container)).toBeNull();
    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Tab}");
    expect(onChange).not.toHaveBeenCalledWith("run the tests");
  });
});
