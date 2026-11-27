import type { ChatWork } from "./kit";

/**
 * What the chats do on each instance as one line each, so a view reading it draws again only when
 * that changes, not on every chat's every update: the last written-to instance, then a count and
 * an instance per line.
 */
export function workKey(work: ChatWork): string {
  return [
    work.lastWritten ?? "",
    ...[...work.working].map(([instance, count]) => `${count} ${instance}`),
  ].join("\n");
}

export function workOfKey(key: string): ChatWork {
  const [lastWritten = "", ...lines] = key.split("\n");
  return {
    lastWritten: lastWritten === "" ? null : lastWritten,
    working: new Map(
      lines.map((line) => {
        const space = line.indexOf(" ");
        return [line.slice(space + 1), Number(line.slice(0, space))] as const;
      }),
    ),
  };
}

// The app's words are English, so its weekdays are too; the time is the phone's own way.
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** A moment as the phone writes times, with its weekday once it isn't today: "15.40", "Tue 10.00". */
export function clockOf(now: number): (at: number) => string {
  const today = new Date(now).toDateString();
  return (at) =>
    new Date(at).toDateString() === today
      ? time.format(at)
      : `${weekday.format(at)} ${time.format(at)}`;
}
