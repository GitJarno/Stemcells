// T3's status symbols for what an awake Cell does or needs, as its row draws them, and the one a
// chat's header wears while its Cell asks (stemcells/tasks/the-ask.md).

import { View } from "react-native";

import { type EnvironmentThreadShell, SymbolView } from "../upstream/cells";
import { type RowStatus, STATUS_WORDS } from "./kit";
import { useReadings } from "./readings";

/** T3's status symbols and colours on the phone (`features/threads/thread-list-v2-items.tsx`). */
export const STATUS_SYMBOL = {
  working: {
    name: "circle.dashed",
    tint: "accent-adaptive-sky-600-400",
    ink: "text-adaptive-sky-600-400",
  },
  input: {
    name: "questionmark.bubble",
    tint: "accent-adaptive-indigo-600-300",
    ink: "text-adaptive-indigo-600-300",
  },
  approval: {
    name: "exclamationmark.shield",
    tint: "accent-warning-foreground",
    ink: "text-warning-foreground",
  },
  done: {
    name: "checkmark.circle",
    tint: "accent-adaptive-emerald-700-300",
    ink: "text-adaptive-emerald-700-300",
  },
} as const satisfies Record<RowStatus, unknown>;

/** A row's symbol for `status`, in its colour, named for one who can't see it. */
export function StatusSymbol(props: { readonly status: RowStatus; readonly size: number }) {
  const look = STATUS_SYMBOL[props.status];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={STATUS_WORDS[props.status]}>
      <SymbolView name={look.name} size={props.size} tintColorClassName={look.tint} />
    </View>
  );
}

/** The row's symbol while a chat's Cell asks (Input, or Approval), as its machine says; else none. */
export function CellAskSymbol(props: {
  readonly thread: EnvironmentThreadShell;
  readonly size: number;
}) {
  const { thread } = props;
  const reading = useReadings().get(thread.environmentId);
  const list = reading === undefined || reading.state === "none" ? null : reading.list;
  const standing = list?.cells?.find((cell) => cell.threadId === thread.id);
  if (standing?.stage !== "needs-you") return null;
  return (
    <StatusSymbol status={thread.hasPendingApprovals ? "approval" : "input"} size={props.size} />
  );
}
