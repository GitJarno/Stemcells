// Replaces `features/threads/ComposerAttachmentButton.tsx` (`substitutes.cjs`): T3's + opens
// Add to Chat (`attach/AttachCard.tsx`) in place of its menu. The + stays T3's: handed no files,
// it is a plain button that asks for photos, and the card answers. A build without the photo
// library's module (`attach/library.ts`) keeps T3's menu.
import { useState } from "react";
import { KeyboardController } from "react-native-keyboard-controller";

import * as Upstream from "../../../features/threads/ComposerAttachmentButton";
import { AttachCard } from "../../attach/AttachCard";
import { hasLibrary } from "../../attach/library";

export * from "../../../features/threads/ComposerAttachmentButton";

/** The card opens by then even if the keyboard never says it left, ms: a + that never answers is worse. */
const KEYBOARD_GONE_BY = 600;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ComposerAttachmentButton(
  props: Parameters<typeof Upstream.ComposerAttachmentButton>[0],
) {
  const [open, setOpen] = useState(false);
  if (!hasLibrary) return <Upstream.ComposerAttachmentButton {...props} />;
  return (
    <>
      <Upstream.ComposerAttachmentButton
        {...props}
        supportsFiles={false}
        onPickMedia={async () => {
          // A keyboard still up, or still leaving, as the card rises hides its foot (Photos,
          // Files, Add N), so the card waits until it's down. React Native's Keyboard.dismiss
          // blurs only its own TextInputs; T3's composer is a native view.
          await Promise.race([KeyboardController.dismiss(), wait(KEYBOARD_GONE_BY)]);
          setOpen(true);
        }}
      />
      <AttachCard
        open={open}
        onClose={() => setOpen(false)}
        supportsFiles={props.supportsFiles}
        onPickMedia={props.onPickMedia}
        onPickFiles={props.onPickFiles}
      />
    </>
  );
}
