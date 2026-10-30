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
          // A keyboard left up hides the card's foot (Photos, Files, Add N). React Native's
          // Keyboard.dismiss blurs only its own TextInputs; T3's composer is a native view.
          void KeyboardController.dismiss();
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
