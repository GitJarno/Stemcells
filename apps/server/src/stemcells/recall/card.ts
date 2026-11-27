/**
 * A Cell's card, written from T3's records with no model (stemcells/tasks/aski-orchestrator.md,
 * decision 8): what the person asked is the opening of each of their messages, and what came of
 * it is the Cell's own close-out, with the verdict the room's cards stand on (`needs/verdict.ts`).
 * Pure.
 */
import * as DateTime from "effect/DateTime";

import { stopOf } from "../../../../../stemcells/closeOut/closeOut.ts";
import type { RecallCard } from "../../../../../stemcells/recall/card.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import { ACTIVE_RUN } from "../needs/derive.ts";
import { briefOf, capped, factsOf, type RunRecords } from "../needs/evidence.ts";
import { landingOf } from "../needs/verdict.ts";
import { isSnoozed, pullRequestOf, type Shell } from "../upstream/needs.ts";
import { isListed } from "../upstream/recall.ts";

/** A card as the store keeps it: its link and its machine are added as it is read. */
export type KeptCard = Omit<RecallCard, "link" | "environmentId">;

/** Whether two cards say the same: a card is plain data, written in one order of keys. */
export const sameCard = (a: KeptCard, b: KeptCard): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** A card as a row holds it, and back; null for a row that isn't one. */
export const cardText = (card: KeptCard): string => JSON.stringify(card);
export function cardFrom(text: string): KeptCard | null {
  try {
    return JSON.parse(text) as KeptCard;
  } catch {
    return null;
  }
}

/** A message in the person's seat, as `upstream/recall.ts` reads it. */
export interface SeatMessage {
  readonly text: string;
  readonly at: number;
  /** A wake or a notification: news for the Cell, never an ask. */
  readonly news: boolean;
  /** Another Cell sent it. */
  readonly fromCell: boolean;
}

/** What a card takes beyond its shell: read once per run, since none of it changes after. */
export interface RunRead {
  readonly messages: ReadonlyArray<SeatMessage>;
  /** The latest run's last reply with words in it; null while it has written none. */
  readonly reply: string | null;
  readonly records: RunRecords | null;
}

/** The most asks a card keeps: a long chat's first two, which set it up, and its latest. */
export const ASKED_MOST = 12;
/** The most times a card is found by: a long chat's latest. */
const TOUCHES_MOST = 400;

/**
 * Whether the chat is a Cell's: not a Subcell's, a side chat, a workflow's step or a chat on
 * Aski's own instance, and one that has run. A deleted chat has no card.
 */
export function hasCard(shell: Shell): boolean {
  return (
    shell.deletedAt === null &&
    isListed(shell) &&
    shell.providerInstanceId !== ASKI_INSTANCE_ID &&
    shell.latestRunId !== null
  );
}

/** What a card's run reads stand on: they are read again only when this changes. */
export function runKeyOf(shell: Shell): string {
  const landed = shell.latestRunCompletedAt;
  return `${shell.latestRunId ?? ""}:${landed == null ? "" : DateTime.toEpochMillis(landed)}`;
}

const flying = (shell: Shell) => shell.activeRunId !== null || ACTIVE_RUN.has(shell.status);

/** What the person asked: their own messages, and the first whoever sent it (Aski's brief). */
function askedOf(messages: ReadonlyArray<SeatMessage>): ReadonlyArray<string> {
  const asks = messages
    .filter((message, index) => !message.news && (index === 0 || !message.fromCell))
    .map((message) => capped(message.text))
    .filter((text) => text !== "");
  return asks.length <= ASKED_MOST ? asks : [...asks.slice(0, 2), ...asks.slice(2 - ASKED_MOST)];
}

/** What a shell alone says of its Cell: a rename, a sleep or a pull request's state costs no read. */
function shellPart(shell: Shell, project: string, now: number) {
  const pullRequest = pullRequestOf(shell);
  return {
    threadId: shell.id as string,
    projectId: shell.projectId as string,
    project,
    title: shell.title,
    pullRequest:
      pullRequest === null
        ? null
        : {
            number: pullRequest.number,
            url: pullRequest.url,
            state: pullRequest.state,
            draft: pullRequest.draft,
            checks: pullRequest.checks,
          },
    model: shell.modelSelection.model,
    bornAt: DateTime.formatIso(shell.createdAt),
    landedAt:
      shell.latestRunCompletedAt == null ? null : DateTime.formatIso(shell.latestRunCompletedAt),
    awake: shell.settledAt === null && shell.archivedAt === null && !isSnoozed(shell, now),
    flying: flying(shell),
  } satisfies Partial<KeptCard>;
}

/**
 * The card after a change that left its run as it was: the shell's part again, the rest kept.
 * A pull request that merged or whose checks turned can change how the Cell landed.
 */
export function restamped(card: KeptCard, shell: Shell, project: string, now: number): KeptCard {
  const part = shellPart(shell, project, now);
  if (card.verdict === null || part.flying) return { ...card, ...part };
  const landing = landingOf(
    shell.status,
    { goal: null, changed: card.changed, checks: card.checks, pullRequest: pullRequestOf(shell) },
    card.proof === "left",
  );
  return { ...card, ...part, verdict: landing.verdict, proof: landing.proof };
}

/**
 * The card of a Cell from its shell and its latest run's reads, with the times it is found by.
 * While it flies, what came of it is what its last landing left (`before`).
 */
export function cardOf(
  shell: Shell,
  run: RunRead,
  project: string,
  now: number,
  before: KeptCard | null = null,
): { readonly card: KeptCard; readonly touches: ReadonlyArray<number> } {
  const part = shellPart(shell, project, now);
  const asked = askedOf(run.messages);
  const said = run.messages.filter((message) => !message.news).map((message) => message.at);
  const touches = [
    DateTime.toEpochMillis(shell.createdAt),
    ...said.slice(-TOUCHES_MOST),
    ...(shell.latestRunCompletedAt == null
      ? []
      : [DateTime.toEpochMillis(shell.latestRunCompletedAt)]),
  ];
  if (part.flying || part.landedAt === null) {
    return {
      card: {
        ...part,
        asked,
        line: before?.line ?? null,
        verdict: before?.verdict ?? null,
        proof: before?.proof ?? null,
        changed: before?.changed ?? null,
        checks: before?.checks ?? [],
      },
      touches,
    };
  }
  const stop = run.reply === null ? null : stopOf(run.reply);
  const facts = run.records === null ? null : factsOf(run.records);
  const landing = landingOf(
    shell.status,
    briefOf(facts, pullRequestOf(shell)),
    stop?.waits === true,
  );
  return {
    card: {
      ...part,
      asked,
      line: stop?.line ?? null,
      verdict: landing.verdict,
      proof: landing.proof,
      changed: facts?.changed ?? null,
      checks: facts?.checks ?? [],
    },
    touches,
  };
}
