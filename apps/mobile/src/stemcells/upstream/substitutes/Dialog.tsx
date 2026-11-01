// Replaces `components/ui/Dialog.tsx` (`substitutes.cjs`; Android's `.android.tsx` stays T3's):
// T3's alerts about a thread say Cell (`cell/words.ts`); every other alert is T3's own.
import * as Upstream from "../../../components/ui/Dialog";
import { inCellWords } from "../../cell/words";

export * from "../../../components/ui/Dialog";

export function alert(...[title, message, ...rest]: Parameters<typeof Upstream.alert>): void {
  Upstream.alert(inCellWords(title), inCellWords(message), ...rest);
}

export function confirm(request: Upstream.ConfirmDialogRequest): void {
  Upstream.confirm({
    ...request,
    title: inCellWords(request.title),
    message: inCellWords(request.message),
  });
}

export function prompt(request: Upstream.TextInputDialogRequest): void {
  Upstream.prompt({
    ...request,
    title: inCellWords(request.title),
    message: inCellWords(request.message),
  });
}
