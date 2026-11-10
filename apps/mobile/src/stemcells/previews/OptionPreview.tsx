// An option's preview on the phone (stemcells/tasks/question-previews.md). A tap picks an
// option and a second control sends the answer, so the picked option shows its preview: seen
// before it is committed to. One not picked says it has one.

import { ScrollView, View } from "react-native";

import { CODE_FONT } from "../tokens";
import { AppText, SelectableMarkdownText, useMarkdownPreviewStyles } from "../upstream/previews";
import { previewOf, type Preview } from "./kit";

const CODE_SIZE = 12;
const CODE_LINE = 17;

export function OptionPreview(props: {
  readonly preview: string | null | undefined;
  /** The option is the picked one. */
  readonly shown: boolean;
}) {
  const preview = previewOf(props.preview);
  if (preview === null) return null;
  if (!props.shown)
    return <AppText className="font-sans text-xs text-foreground-muted">Tap to preview</AppText>;
  return (
    <View className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
      {preview.as === "written" ? (
        // A mockup's columns only line up unwrapped: a wide one scrolls sideways.
        <ScrollView horizontal bounces={false} contentContainerClassName="px-3 py-2.5">
          <AppText
            className="text-foreground"
            style={{ fontFamily: CODE_FONT, fontSize: CODE_SIZE, lineHeight: CODE_LINE }}
          >
            {preview.text}
          </AppText>
        </ScrollView>
      ) : (
        <View className="px-3 py-1">
          <MarkdownPreview preview={preview} />
        </View>
      )}
    </View>
  );
}

function MarkdownPreview(props: { readonly preview: Preview }) {
  const { nativeTextStyle } = useMarkdownPreviewStyles();
  return (
    <SelectableMarkdownText
      markdown={props.preview.text}
      textStyle={{
        ...nativeTextStyle,
        fontFamily: CODE_FONT,
        fontSize: CODE_SIZE,
        lineHeight: CODE_LINE,
      }}
    />
  );
}
