import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as Upstream from "../upstream/linked.ts";
import { type Answer, type Call, makeCall } from "./call.ts";
import { type Elsewhere, fileElsewhere } from "./elsewhere.ts";
import { titleOf } from "./frame.ts";
import * as Wire from "./link.ts";
import { isAski, isAtWork } from "./roster.ts";

// Linked environments (stemcells/tasks/peers.md, "Across environments"): the links kept
// here, the routes a linked one calls, who's at work on each (asked every minute), and a
// Cell's message to a Cell there. A link is the person's: made and ended from Settings ›
// Devices, or ended by the other side, whose token then stops working here.

/** How often each linked environment is asked who's at work there. */
const POLL_EVERY = Duration.seconds(60);
/** A linked environment that stops answering drops out of who's here after this long. */
const STALE_AFTER_MS = 3 * 60_000;
const HOUR_MS = 60 * 60_000;
/** Messages one linked environment may deliver here an hour: each can start a turn the person pays for. */
export const DELIVERIES_PER_HOUR = 60;
/** The most environments this one links to. */
const LINKS_MOST = 32;
/** The least time between two roster asks from one linked machine. */
const ROSTER_EVERY_MS = 10_000;
/** Senders' titles held for the frame, newest kept. */
const SENDERS_KEPT = 500;

const StoredLink = Schema.Struct({
  environmentId: Schema.String,
  label: Schema.String,
  /** Its address, once linked; null while only invited, or once it ended the link. */
  baseUrl: Schema.NullOr(Schema.String),
  /** The hash of the token it calls this environment with. */
  inboundHash: Schema.String,
  /** The token this environment calls it with; null as `baseUrl` is. */
  outboundToken: Schema.NullOr(Schema.String),
});
type StoredLink = typeof StoredLink.Type;

const Stored = Schema.fromJsonString(Schema.Struct({ links: Schema.Array(StoredLink) }));
const decodeStored = Schema.decodeUnknownOption(Stored);
const encodeStored = Schema.encodeSync(Stored);
const decodeRosterAsk = Schema.decodeUnknownOption(Wire.RosterAsk);
const decodeRosterReply = Schema.decodeUnknownOption(Wire.RosterReply);
const decodeHello = Schema.decodeUnknownOption(Wire.HelloReply);
const decodeDelivery = Schema.decodeUnknownOption(Wire.Delivery);
const decodeDeliveryReply = Schema.decodeUnknownOption(Wire.DeliveryReply);
const encodeDelivery = Schema.encodeSync(Schema.fromJsonString(Wire.Delivery));
const isRemoteCell = Schema.is(Wire.RemoteCell);

export class PeerRefusal extends Schema.TaggedError<PeerRefusal>()("PeerRefusal", {
  status: Schema.Number,
  reason: Schema.String,
}) {}

/** A link as Settings › Devices shows it. */
export interface LinkView {
  readonly environmentId: string;
  readonly label: string;
  readonly baseUrl: string | null;
  /** Both ways: this environment holds a token for it, and it one for this. */
  readonly linked: boolean;
  /** When it last answered. */
  readonly seenAt: number | null;
  /** Why it didn't, in a few words. */
  readonly problem: string | null;
  /** Its Cells at work in this environment's repositories, when it last answered. */
  readonly cells: number;
}

export interface Sent {
  readonly environment: string;
  readonly threadId: string;
  readonly delivery: Upstream.Delivered;
}

export class StemcellsPeers extends Context.Service<
  StemcellsPeers,
  {
    readonly environmentId: string;
    readonly links: Effect.Effect<ReadonlyArray<LinkView>>;
    /** Mints the token `environmentId` will call this environment with. */
    readonly invite: (
      input: typeof Wire.Invite.Type,
    ) => Effect.Effect<{ readonly environmentId: string; readonly token: string }, PeerRefusal>;
    /** Keeps the token an invited environment minted for this one, once it answers with it. */
    readonly link: (input: typeof Wire.Link.Type) => Effect.Effect<void, PeerRefusal>;
    /** Ends a link both ways: forgets it here, and tells the other side. */
    readonly unlink: (environmentId: string) => Effect.Effect<void, PeerRefusal>;
    /** A linked environment's call to a peer route. */
    readonly answer: (
      route: string,
      authorization: string | undefined,
      body: unknown,
    ) => Effect.Effect<Answer>;
    /** A message from the Cell on thread `from` to one at work on a linked environment. */
    readonly send: (input: {
      readonly from: string;
      readonly to: string;
      readonly text: string;
    }) => Effect.Effect<Sent, PeerRefusal>;
  }
>()("t3/stemcells/peers/Links/StemcellsPeers") {}

const refuse = (status: number, reason: string) => new PeerRefusal({ status, reason });

/** What a sending Cell is told when the other machine turns its message away. */
const refusalOf = (status: number, machine: string, threadId: string) => {
  switch (status) {
    case 403:
      return "That Cell works with broader permissions than yours, so a message from you can't reach it.";
    case 404:
      return `No Cell on ${machine} is at work in this repository under thread ${threadId} any more.`;
    case 409:
      return "That Cell couldn't take the message.";
    case 429:
      return `${machine} takes at most ${DELIVERIES_PER_HOUR} messages an hour from this machine. Send again later.`;
    default:
      return `${machine} turned the message away (${status}).`;
  }
};
const said = (status: number, error: string): Answer => ({ status, body: { error } });

export const make = Effect.fn("StemcellsPeers.make")(function* (
  source: Upstream.LinkedSource,
  call: Call,
) {
  const lock = yield* Semaphore.make(1);
  const kept = yield* source.vault.read;
  let links: ReadonlyArray<StoredLink> =
    kept === null
      ? []
      : Option.match(decodeStored(kept), {
          onNone: () => [],
          onSome: (stored) => stored.links,
        });
  const seen = new Map<string, { readonly at: number | null; readonly problem: string | null }>();
  const remote = new Map<
    string,
    { readonly at: number; readonly cells: ReadonlyArray<Wire.RemoteCell> }
  >();
  const delivered = new Map<string, ReadonlyArray<number>>();
  const senders = new Map<string, string>();
  /** When each linked machine last asked who's at work here. */
  const asked = new Map<string, number>();

  const find = (environmentId: string) => links.find((one) => one.environmentId === environmentId);
  const nameOf = (one: StoredLink) => titleOf(one.label);
  const isLinked = (
    one: StoredLink,
  ): one is StoredLink & { baseUrl: string; outboundToken: string } =>
    one.baseUrl !== null && one.outboundToken !== null;

  /** Applies `next` to the links and keeps them; nothing changes here unless they were kept. */
  const change = (next: (current: ReadonlyArray<StoredLink>) => ReadonlyArray<StoredLink>) =>
    lock.withPermits(1)(
      Effect.suspend(() => {
        const after = next(links);
        return source.vault.write(encodeStored({ links: after })).pipe(
          Effect.flatMap((ok) =>
            ok
              ? Effect.sync(() => {
                  links = after;
                })
              : Effect.fail(refuse(500, "This machine couldn't keep its links.")),
          ),
        );
      }),
    );

  const forget = (environmentId: string) =>
    change((current) => current.filter((one) => one.environmentId !== environmentId)).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          seen.delete(environmentId);
          remote.delete(environmentId);
          delivered.delete(environmentId);
          asked.delete(environmentId);
        }),
      ),
    );

  /**
   * The other side no longer takes `token`: it ended the link. This side
   * keeps its own way in until the person ends or makes the link again.
   */
  const ended = (environmentId: string, token: string) =>
    change((current) =>
      current.map((one) =>
        one.environmentId === environmentId && one.outboundToken === token
          ? { ...one, baseUrl: null, outboundToken: null }
          : one,
      ),
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          remote.delete(environmentId);
          seen.set(environmentId, { at: null, problem: "it ended the link" });
        }),
      ),
      Effect.ignore,
    );

  /** This environment's Cells at work, each with its repository. */
  const atWork = Effect.gen(function* () {
    const [repos, threads, now] = yield* Effect.all([
      source.repos,
      source.threads,
      Clock.currentTimeMillis,
    ]);
    return threads.flatMap((thread) => {
      const repo = repos.get(thread.projectId);
      return repo !== undefined && isAtWork(thread, now) ? [{ thread, repo }] : [];
    });
  });

  const invite = Effect.fn("StemcellsPeers.invite")(function* (input: typeof Wire.Invite.Type) {
    if (input.environmentId === source.environmentId)
      return yield* refuse(400, "A machine can't link to itself.");
    if (find(input.environmentId) === undefined && links.length >= LINKS_MOST)
      return yield* refuse(409, `This machine links to ${LINKS_MOST} already.`);
    const token = Wire.newToken();
    yield* change((current) => {
      const prior = current.find((one) => one.environmentId === input.environmentId);
      return [
        ...current.filter((one) => one !== prior),
        {
          environmentId: input.environmentId,
          label: input.label,
          baseUrl: prior?.baseUrl ?? null,
          inboundHash: Wire.hashOf(token),
          outboundToken: prior?.outboundToken ?? null,
        },
      ];
    });
    return { environmentId: source.environmentId, token };
  });

  const link = Effect.fn("StemcellsPeers.link")(function* (input: typeof Wire.Link.Type) {
    const baseUrl = Wire.baseUrlOf(input.baseUrl);
    const name = titleOf(input.label);
    if (baseUrl === null)
      return yield* refuse(400, `${name}'s address isn't one a server can call.`);
    if (find(input.environmentId) === undefined)
      return yield* refuse(409, `${name} isn't invited here yet.`);
    const hello = yield* call(baseUrl, input.token, "hello", {}).pipe(
      Effect.mapError((error) =>
        refuse(502, `This machine couldn't reach ${name} at ${baseUrl}: ${error.reason}.`),
      ),
    );
    if (hello.status === 401)
      return yield* refuse(502, `${name} at ${baseUrl} didn't take the link's token.`);
    const reply = decodeHello(hello.body);
    if (hello.status !== 200 || Option.isNone(reply))
      return yield* refuse(502, `${baseUrl} didn't answer as a Stemcells machine.`);
    if (reply.value.environmentId !== input.environmentId)
      return yield* refuse(502, `${baseUrl} is another machine than ${name}.`);
    yield* change((current) =>
      current.map((one) =>
        one.environmentId === input.environmentId
          ? { ...one, label: input.label, baseUrl, outboundToken: input.token }
          : one,
      ),
    );
    seen.set(input.environmentId, { at: yield* Clock.currentTimeMillis, problem: null });
  });

  const unlink = Effect.fn("StemcellsPeers.unlink")(function* (environmentId: string) {
    const one = find(environmentId);
    if (one === undefined) return;
    yield* forget(environmentId);
    // Its token for this environment is already dead; this only tidies its side.
    if (isLinked(one))
      yield* call(one.baseUrl, one.outboundToken, "goodbye", {}).pipe(Effect.ignore);
  });

  const deliver = Effect.fnUntraced(function* (from: StoredLink, body: unknown) {
    const decoded = decodeDelivery(body);
    if (Option.isNone(decoded))
      return said(400, "A message takes who sent it, the thread it's for, and its words.");
    const delivery = decoded.value;
    if (Upstream.isCommand(delivery.text))
      return said(400, "A message from another machine can't be a command.");
    const now = yield* Clock.currentTimeMillis;
    const recent = (delivered.get(from.environmentId) ?? []).filter((at) => now - at < HOUR_MS);
    if (recent.length >= DELIVERIES_PER_HOUR)
      return said(
        429,
        `This machine took ${DELIVERIES_PER_HOUR} messages from yours in the last hour. Send again later.`,
      );
    // The slot is taken before anything is awaited, so messages sent at once
    // can't all slip under the cap, and given back when one is turned away.
    delivered.set(from.environmentId, [...recent, now]);
    const refused = (status: number, error: string) => {
      const taken = delivered.get(from.environmentId);
      const at = taken?.lastIndexOf(now) ?? -1;
      if (taken !== undefined && at >= 0) delivered.set(from.environmentId, taken.toSpliced(at, 1));
      return said(status, error);
    };
    const recipient = (yield* atWork).find(({ thread }) => thread.id === delivery.to);
    // A Cell in another repository is told apart from none at all to no one.
    if (recipient === undefined || recipient.repo !== delivery.from.repo)
      return refused(
        404,
        `No Cell here is at work in this repository under thread ${delivery.to}.`,
      );
    if (!(yield* source.modesAllow(delivery.from, recipient.thread)))
      return refused(
        403,
        "That Cell works with broader permissions than yours, so a message from you can't reach it.",
      );
    const messageId = Wire.mailId(from.environmentId, delivery.from.threadId, delivery.requestId);
    senders.delete(messageId);
    senders.set(messageId, delivery.from.title);
    if (senders.size > SENDERS_KEPT) senders.delete(senders.keys().next().value!);
    const sent = yield* source.deliver({
      threadId: recipient.thread.id,
      projectId: recipient.thread.projectId,
      messageId,
      text: delivery.text,
    });
    if (sent === null) return refused(409, "That Cell couldn't take the message.");
    return { status: 200, body: { delivery: sent } } satisfies Answer;
  });

  const answer = Effect.fn("StemcellsPeers.answer")(function* (
    route: string,
    authorization: string | undefined,
    body: unknown,
  ) {
    const token = Wire.bearerOf(authorization);
    const from =
      token === null ? undefined : links.find((one) => Wire.matches(token, one.inboundHash));
    if (from === undefined) return said(401, "This machine gave no such credential.");
    switch (route) {
      case "hello":
        return { status: 200, body: { environmentId: source.environmentId } } satisfies Answer;
      case "goodbye":
        yield* forget(from.environmentId).pipe(Effect.ignore);
        return { status: 200, body: {} } satisfies Answer;
      case "roster": {
        const ask = decodeRosterAsk(body);
        if (Option.isNone(ask)) return said(400, "A roster request names repositories.");
        // Each ask reads every thread here: a linked machine asks once a minute.
        const now = yield* Clock.currentTimeMillis;
        if (now - (asked.get(from.environmentId) ?? -Infinity) < ROSTER_EVERY_MS)
          return said(429, "Ask again in a few seconds.");
        asked.set(from.environmentId, now);
        const repos = new Set(ask.value.repos);
        const cells = (yield* atWork)
          .filter(({ repo }) => repos.has(repo))
          .toSorted((a, b) => b.thread.at - a.thread.at)
          .map(({ thread, repo }) => ({
            threadId: thread.id,
            title: thread.title.slice(0, 512),
            branch: thread.branch ? thread.branch.slice(0, 512) : null,
            status: thread.status,
            repo,
            aski: isAski(thread),
            at: thread.at,
          }))
          .filter(isRemoteCell)
          .slice(0, Wire.CELLS_MOST);
        return { status: 200, body: { cells } } satisfies Answer;
      }
      case "deliver":
        return yield* deliver(from, body);
      default:
        return said(404, "No such peer route.");
    }
  });

  const send = Effect.fn("StemcellsPeers.send")(function* (input: {
    readonly from: string;
    readonly to: string;
    readonly text: string;
  }) {
    if (input.text.length > Wire.MESSAGE_MOST)
      return yield* refuse(
        413,
        `A message to another machine is at most ${Wire.MESSAGE_MOST} characters.`,
      );
    if (Upstream.isCommand(input.text))
      return yield* refuse(400, "A message to another machine can't be a command like /compact.");
    const from = yield* source.thread(input.from);
    if (from === null) return yield* refuse(404, "The calling thread was not found.");
    const repo = (yield* source.repos).get(from.projectId);
    if (repo === undefined)
      return yield* refuse(
        400,
        "This Cell's project has no remote repository, so no Cell on another machine shares it.",
      );
    const holders = links
      .filter(isLinked)
      .filter((one) =>
        remote
          .get(one.environmentId)
          ?.cells.some((cell) => cell.threadId === input.to && cell.repo === repo),
      );
    const target = holders.length === 1 ? holders[0]! : null;
    if (target === null)
      return yield* refuse(
        404,
        `No Cell on a linked machine is at work in this repository under thread ${input.to}. Who's here names the ones that are.`,
      );
    const name = nameOf(target);
    const delivery: Wire.Delivery = {
      from: {
        threadId: from.id,
        title: from.title.slice(0, 512),
        repo,
        runtimeMode: from.runtimeMode,
        interactionMode: from.interactionMode,
      },
      to: input.to,
      text: input.text,
      requestId: Wire.newToken().slice(0, 22),
    };
    // Characters aren't bytes: a message under MESSAGE_MOST can still be more than a peer route reads.
    if (new TextEncoder().encode(encodeDelivery(delivery)).byteLength > Wire.PEER_BODY_MOST)
      return yield* refuse(413, "The message is too large to send to another machine.");
    const answered = yield* call(target.baseUrl, target.outboundToken, "deliver", delivery).pipe(
      Effect.mapError((error) => refuse(502, `${name} couldn't be reached: ${error.reason}.`)),
    );
    if (answered.status === 401) {
      yield* ended(target.environmentId, target.outboundToken);
      return yield* refuse(403, `${name} ended the link.`);
    }
    const reply = decodeDeliveryReply(answered.body);
    if (answered.status === 200 && Option.isSome(reply))
      return {
        environment: name,
        threadId: input.to,
        delivery: reply.value.delivery,
      } satisfies Sent;
    // The other machine's own words never reach this Cell's model: each refusal has ours.
    return yield* refuse(answered.status, refusalOf(answered.status, name, input.to));
  });

  // Untraced: the poll's own span covers it, once per link a minute.
  const pollOne = Effect.fnUntraced(function* (one: StoredLink, repos: ReadonlyArray<string>) {
    if (!isLinked(one)) return;
    const env = one.environmentId;
    const now = yield* Clock.currentTimeMillis;
    const missed = (problem: string) =>
      Effect.sync(() => {
        seen.set(env, { at: seen.get(env)?.at ?? null, problem });
        const cache = remote.get(env);
        if (cache !== undefined && now - cache.at > STALE_AFTER_MS) remote.delete(env);
      });
    yield* call(one.baseUrl, one.outboundToken, "roster", { repos }).pipe(
      Effect.matchEffect({
        onFailure: (error) => missed(error.reason),
        onSuccess: (answered) => {
          if (answered.status === 401) return ended(env, one.outboundToken);
          const reply = decodeRosterReply(answered.body);
          if (answered.status !== 200 || Option.isNone(reply))
            return missed("it answered, but not with who's at work");
          return Effect.sync(() => {
            remote.set(env, { at: now, cells: reply.value.cells });
            seen.set(env, { at: now, problem: null });
          });
        },
      }),
    );
  });

  /** Asks every linked environment who's at work there, in this environment's repositories. */
  const poll = Effect.fn("StemcellsPeers.poll")(function* () {
    // Those at work first, then the rest: a Cell starting in a quiet repository
    // finds who's there already at its first turn.
    const working = (yield* atWork).map(({ repo }) => repo);
    const repos = [...new Set([...working, ...(yield* source.repos).values()])].slice(
      0,
      Wire.REPOS_MOST,
    );
    yield* Effect.forEach(links, (one) => pollOne(one, repos), { concurrency: 4, discard: true });
  });

  const elsewhere: Elsewhere = {
    cellsIn: (repo) =>
      links.filter(isLinked).flatMap((one) =>
        (remote.get(one.environmentId)?.cells ?? [])
          .filter((cell) => cell.repo === repo)
          .map((cell) => ({
            environment: one.label,
            id: cell.threadId,
            title: cell.title,
            branch: cell.branch,
            status: cell.status,
            aski: cell.aski,
            at: cell.at,
          })),
      ),
    senderOf: (messageId) => {
      const mail = Wire.mailOf(messageId);
      const one = mail === null ? undefined : find(mail.environmentId);
      const title =
        senders.get(messageId) ??
        (mail === null
          ? undefined
          : remote.get(mail.environmentId)?.cells.find((cell) => cell.threadId === mail.threadId)
              ?.title);
      return { environment: one?.label ?? null, title: title ?? null };
    },
  };

  const service = StemcellsPeers.of({
    environmentId: source.environmentId,
    links: Effect.sync(() =>
      links.map((one) => ({
        environmentId: one.environmentId,
        label: one.label,
        baseUrl: one.baseUrl,
        linked: isLinked(one),
        seenAt: seen.get(one.environmentId)?.at ?? null,
        problem: seen.get(one.environmentId)?.problem ?? null,
        cells: remote.get(one.environmentId)?.cells.length ?? 0,
      })),
    ),
    invite,
    link,
    unlink,
    answer,
    send,
  });
  return { service, poll, elsewhere };
});

export const layer = Layer.effect(
  StemcellsPeers,
  Effect.gen(function* () {
    const source = yield* Upstream.makeLinkedSource;
    const { service, poll, elsewhere } = yield* make(source, yield* makeCall);
    yield* fileElsewhere(elsewhere);
    yield* source.ready.pipe(
      Effect.andThen(
        poll().pipe(
          Effect.catchCauseIf(
            (cause) => !Cause.hasInterruptsOnly(cause),
            (cause) => Effect.logWarning("Stemcells couldn't ask its links who's at work", cause),
          ),
          Effect.andThen(Effect.sleep(POLL_EVERY)),
          Effect.forever,
        ),
      ),
      Effect.forkScoped,
    );
    return service;
  }),
);
