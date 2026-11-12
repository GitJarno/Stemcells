/**
 * A question's options with one option's preview beside them, or under them where the pane is
 * narrow (stemcells/tasks/question-previews.md). The preview is the highlighted option's: the
 * one last pointed at or focused, as choosing an option answers at once.
 */
import { Children, useState, type ComponentProps, type ReactNode } from "react";

import { ChatMarkdown, cn } from "../upstream/previews";
import { previewsOf, shownOf, type Highlight, type Preview } from "./preview";

/**
 * Every preview is laid out in one grid cell and only the shown one is visible, so the box is
 * as tall as the tallest of them, each capped and scrolling inside itself: moving between
 * options never moves what is under the box.
 */
export function PreviewBox(props: {
  readonly previews: ReadonlyArray<Preview | null>;
  /** Each option's label: the box names the one it shows. */
  readonly labels: ReadonlyArray<string>;
  readonly shown: number;
  readonly className?: string;
}) {
  return (
    <div
      dir="ltr"
      data-option-preview=""
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-border/70 bg-secondary text-start text-foreground/90 dark:border-transparent dark:bg-input/32",
        props.className,
      )}
    >
      <div className="truncate px-3 pt-1.5 font-sans text-2xs text-muted-foreground" dir="auto">
        {props.labels[props.shown]}
      </div>
      <div className="grid">
        {props.previews.map((preview, index) => (
          <div
            // oxlint-disable-next-line react/no-array-index-key -- an option's place is its identity: two may share a label
            key={index}
            inert={index !== props.shown}
            data-option-preview-pane={index === props.shown ? "shown" : "hidden"}
            className={cn(
              "col-start-1 row-start-1 max-h-56 min-w-0 overflow-auto px-3 pt-1 pb-2.5 font-mono text-xs/4.5",
              index !== props.shown && "invisible",
            )}
          >
            {preview === null ? (
              <span className="font-sans text-muted-foreground">No preview</span>
            ) : preview.as === "written" ? (
              // Box-drawing characters join up only near the font's own line height.
              <pre className="m-0 w-max min-w-full font-mono leading-tight whitespace-pre">
                {preview.text}
              </pre>
            ) : (
              <ChatMarkdown text={preview.text} cwd={undefined} className="font-mono text-xs/4.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The options and the box: side by side with room for both, the box under them without. */
export function BesidePreview(props: { readonly box: ReactNode; readonly children: ReactNode }) {
  return (
    <div className="@container/option-previews">
      <div className="grid items-start gap-x-4 gap-y-2 @xl/option-previews:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {props.children}
        {props.box}
      </div>
    </div>
  );
}

/**
 * Upstream's question panel's options (`ComposerPendingUserInputPanel.tsx`, one seam): its own
 * container when no option has a preview, drawn as upstream draws it. `children` is one element
 * per option, in the options' order.
 */
export function QuestionOptions({
  question,
  children,
  ...container
}: ComponentProps<"div"> & {
  readonly question: {
    readonly id: string;
    readonly options: ReadonlyArray<{
      readonly label: string;
      readonly preview?: string | undefined;
    }>;
  };
}) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const previews = previewsOf(question.options);
  if (previews === null) return <div {...container}>{children}</div>;
  return (
    <BesidePreview
      box={
        <PreviewBox
          previews={previews}
          labels={question.options.map((option) => option.label)}
          shown={shownOf(previews, question.id, highlight)}
          // The options' own top margin, so the two columns start level.
          className="@xl/option-previews:mt-1.5"
        />
      }
    >
      <div {...container}>
        {Children.map(children, (child, index) => {
          const point = () => setHighlight({ questionId: question.id, index });
          // No box of its own, so upstream's rows lay out as they do without it. Upstream draws
          // each preview under its option too; the box shows it, so that copy is hidden.
          return (
            <div
              className="contents [&>div>:not(button)]:hidden"
              onPointerEnter={point}
              onFocus={point}
            >
              {child}
            </div>
          );
        })}
      </div>
    </BesidePreview>
  );
}
