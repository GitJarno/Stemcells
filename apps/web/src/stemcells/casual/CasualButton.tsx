import { MessageSquareIcon } from "lucide-react";
import type { ComponentProps } from "react";

import "./casual.css";

/**
 * A new chat's way to a casual chat, under its headline (`stemcells/seams.md`, A casual chat): a
 * button, as on the phone (`apps/mobile/src/stemcells/casual/CasualOffer.tsx`), where upstream
 * has a muted link. Its words are the word table's, its tooltip upstream's.
 */
export function CasualButton({ children, ...props }: ComponentProps<"button">) {
  return (
    <button type="button" data-stemcells-casual="" {...props}>
      <MessageSquareIcon aria-hidden />
      <span>{children}</span>
    </button>
  );
}
