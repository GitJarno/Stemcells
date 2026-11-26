// Sets the chat's quieter work log once per install as the workspace first loads (`quietWork.ts`).
// A failed settings read leaves it for the next start.
import { quietWorkOnce } from "./quietWork";

void quietWorkOnce().catch(() => undefined);
