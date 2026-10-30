// Replaces `features/threads/floating-working-control.tsx` (`substitutes.cjs`): T3's capsule over
// the composer keeps what it offers (queued messages, Subcells, reconnect, a Subcell asking,
// background work), but not its plain timer: the composer's light says the Cell flies
// (`glow/ComposerLight.tsx`).
import { FloatingWorkingControl as UpstreamFloatingWorkingControl } from "../../../features/threads/floating-working-control";

export * from "../../../features/threads/floating-working-control";

export function FloatingWorkingControl(
  props: Parameters<typeof UpstreamFloatingWorkingControl>[0],
): ReturnType<typeof UpstreamFloatingWorkingControl> {
  return (
    <UpstreamFloatingWorkingControl
      {...props}
      status={props.status?.kind === "working" ? null : props.status}
    />
  );
}
