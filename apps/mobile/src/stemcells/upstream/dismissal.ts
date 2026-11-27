// T3's dismissal of a row as a chat moves (`features/home/thread-dismissal.ts`), alone: T3's row
// actions import our hand-off for it (`home/hops.ts`), so nothing else may come in with it.

export { registerThreadDismissal, withThreadDismissal } from "../../features/home/thread-dismissal";
