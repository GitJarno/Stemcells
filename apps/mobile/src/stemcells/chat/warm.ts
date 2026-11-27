// The chats kept warm behind the one in front (stemcells/tasks/phone-snappy.md): a chat the
// person was just in stays mounted, hidden, so going back to it shows it in one commit instead of
// mounting its feed, measuring its rows and landing at its end again.

/** How many chats stay mounted, the one in front among them. */
export const WARM_CHATS = 4;

type Handler = (...args: never[]) => unknown;

/** One chat's handler props as functions that never change, each calling the chat's latest. */
export type WarmHandlers = Map<string, Handler>;

export interface WarmChat<Props> {
  readonly key: string;
  /** What the chat is drawn with: the latest it was given, each unchanged value its old self. */
  readonly props: Props;
  readonly handlers: WarmHandlers;
  /** When it was last in front, as a count of turns. */
  readonly seen: number;
  /** The turn it mounted in: with its key, the mount's own name. */
  readonly born: number;
  /** Not worth keeping once left: a draft, which has no feed to come back to. */
  readonly passing: boolean;
}

export interface WarmFront<Props> {
  readonly key: string;
  readonly props: Props;
  readonly passing: boolean;
  /** The props `key`'s chat was last drawn with, read as one of its handlers is called. */
  readonly latest: (key: string) => object | undefined;
  /** Arrived at with a show of its own (Aski's turn), which plays over a chat mounting. */
  readonly fresh?: boolean;
  /**
   * True while `props` have less to show than `held`: the chat's messages are being read again.
   * The chat keeps what it showed until they are back.
   */
  readonly behind: (props: Props, held: Props) => boolean;
}

/**
 * The warm chats with `front` in front. A chat keeps its place in the list, so React moves no
 * native view on a turn, and the one longest out of sight leaves when there are too many. The
 * same list comes back when nothing changed.
 */
export function keepWarm<Props extends object>(
  warm: ReadonlyArray<WarmChat<Props>>,
  front: WarmFront<Props>,
  limit: number = WARM_CHATS,
): ReadonlyArray<WarmChat<Props>> {
  const latest = warm.reduce((most, chat) => Math.max(most, chat.seen), 0);
  const kept = warm.find((chat) => chat.key === front.key);
  // Only as it comes to the front: in front already, it is the mount the show played over.
  const held = front.fresh === true && kept?.seen !== latest ? undefined : kept;
  const handlers: WarmHandlers = held?.handlers ?? new Map();
  const handler = (name: string) => {
    let stable = handlers.get(name);
    if (stable === undefined) {
      stable = (...args) =>
        (asRecord(front.latest(front.key) ?? {})[name] as Handler | undefined)?.(...args);
      handlers.set(name, stable);
    }
    return stable;
  };
  const props =
    held !== undefined && front.behind(front.props, held.props)
      ? held.props
      : settled(held?.props, front.props, handler);
  if (held !== undefined && held.props === props && held.seen === latest) return warm;
  const entry: WarmChat<Props> = {
    key: front.key,
    props,
    handlers,
    seen: held?.seen === latest ? latest : latest + 1,
    born: held?.born ?? latest + 1,
    passing: front.passing,
  };
  const next = (
    kept === undefined ? [...warm, entry] : warm.map((chat) => (chat === kept ? entry : chat))
  ).filter((chat) => chat.key === front.key || !chat.passing);
  if (next.length <= limit) return next;
  const oldest = next.reduce((least, chat) => (chat.seen < least.seen ? chat : least));
  return next.filter((chat) => chat !== oldest);
}

/**
 * `props` for a chat that showed `held`: a handler is the chat's own unchanging function, and a
 * value whose contents didn't change is the one it had, so what reads it draws nothing again.
 * `held` itself when nothing changed.
 */
function settled<Props extends object>(
  held: Props | undefined,
  props: Props,
  handler: (name: string) => Handler,
): Props {
  const before = held === undefined ? {} : asRecord(held);
  const entries = Object.entries(props).map(([name, value]): [string, unknown] => [
    name,
    typeof value === "function"
      ? handler(name)
      : sameContents(before[name], value)
        ? before[name]
        : value,
  ]);
  if (
    held !== undefined &&
    entries.length === Object.keys(before).length &&
    entries.every(([name, value]) => Object.hasOwn(before, name) && Object.is(before[name], value))
  )
    return held;
  return Object.fromEntries(entries) as Props;
}

const asRecord = (value: object) => value as Readonly<Record<string, unknown>>;

function sameContents(before: unknown, next: unknown): boolean {
  if (Object.is(before, next)) return true;
  if (Array.isArray(before) && Array.isArray(next))
    return before.length === next.length && before.every((item, index) => item === next[index]);
  if (!isPlainRecord(before) || !isPlainRecord(next)) return false;
  const names = Object.keys(next);
  return (
    names.length === Object.keys(before).length &&
    names.every((name) => Object.hasOwn(before, name) && Object.is(before[name], next[name]))
  );
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
