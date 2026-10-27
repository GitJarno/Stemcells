// Linking this machine with another the person is connected to (stemcells/tasks/peers.md,
// "Across environments", decision 2): each side mints a token for the other, keeps the other's
// token and address and says hello. The client, connected to both, carries the tokens; if
// either way fails, both sides are undone.

import {
  callMachine,
  type EnvironmentId,
  isLoopbackAddress,
  type MachineAnswer,
  machineAddressOf,
} from "../upstream/machines";

const PEERS = "/api/stemcells/peers";

/** A link as a machine's server tells it (`apps/server/src/stemcells/peers/Links.ts`). */
export interface MachineLink {
  readonly environmentId: string;
  readonly label: string;
  readonly baseUrl: string | null;
  readonly linked: boolean;
  readonly seenAt: number | null;
  readonly problem: string | null;
  readonly cells: number;
}

const isLinkList = (body: unknown): body is { readonly links: ReadonlyArray<MachineLink> } =>
  typeof body === "object" &&
  body !== null &&
  Array.isArray((body as { readonly links?: unknown }).links);

/**
 * A machine's links; "not-stemcells" when its server answers without them
 * (T3 Code's own, an older one), null when it couldn't be asked.
 */
export async function linksOf(
  environmentId: EnvironmentId,
): Promise<ReadonlyArray<MachineLink> | "not-stemcells" | null> {
  const answer = await callMachine(environmentId, `${PEERS}/links`);
  if (!answer.ok || answer.status === 401 || answer.status === 403) return null;
  return answer.status === 200 && isLinkList(answer.body) ? answer.body.links : "not-stemcells";
}

const reasonOf = (answer: MachineAnswer): string => {
  if (!answer.ok) return answer.reason;
  const error = (answer.body as { readonly error?: unknown } | null)?.error;
  return typeof error === "string" ? error.replace(/\.$/, "") : `it answered ${answer.status}`;
};

/** The token an invite minted, when the machine that minted it is the one expected. */
const tokenOf = (answer: MachineAnswer, environmentId: string): string | null => {
  if (!answer.ok || answer.status !== 200) return null;
  const body = answer.body as { readonly environmentId?: unknown; readonly token?: unknown } | null;
  return body?.environmentId === environmentId && typeof body.token === "string"
    ? body.token
    : null;
};

export interface Machine {
  readonly environmentId: EnvironmentId;
  readonly label: string;
}

/**
 * Links `here` (this app's own machine) and `there` both ways. `hereOnNetwork`
 * is where another machine reaches this one. Null once linked, else why not,
 * in a sentence.
 */
export async function linkMachines(
  here: Machine,
  there: Machine,
  hereOnNetwork: string | null,
): Promise<string | null> {
  const thereAt = machineAddressOf(there.environmentId);
  if (!("url" in thereAt)) return `${there.label} can't be linked: ${thereAt.reason}.`;
  // A machine this device reaches on its own loopback is this one: it reaches us there too.
  const hereLocal = machineAddressOf(here.environmentId);
  const hereAt =
    isLoopbackAddress(thereAt.url) && "url" in hereLocal ? hereLocal.url : hereOnNetwork;
  if (hereAt === null)
    return `${there.label} has no way to reach this machine: turn on network access in Settings › Sharing & access.`;

  const undo = () =>
    Promise.all([
      callMachine(here.environmentId, `${PEERS}/unlink`, { environmentId: there.environmentId }),
      callMachine(there.environmentId, `${PEERS}/unlink`, { environmentId: here.environmentId }),
    ]);

  const intoHere = await callMachine(here.environmentId, `${PEERS}/invite`, {
    environmentId: there.environmentId,
    label: there.label,
  });
  const hereToken = tokenOf(intoHere, here.environmentId);
  if (hereToken === null)
    return `This machine couldn't let ${there.label} in: ${reasonOf(intoHere)}.`;
  const intoThere = await callMachine(there.environmentId, `${PEERS}/invite`, {
    environmentId: here.environmentId,
    label: here.label,
  });
  const thereToken = tokenOf(intoThere, there.environmentId);
  if (thereToken === null) {
    await undo();
    return intoThere.ok && intoThere.status === 404
      ? `${there.label} isn't a Stemcells machine.`
      : `${there.label} couldn't let this machine in: ${reasonOf(intoThere)}.`;
  }

  const hereKeeps = await callMachine(here.environmentId, `${PEERS}/link`, {
    environmentId: there.environmentId,
    label: there.label,
    baseUrl: thereAt.url,
    token: thereToken,
  });
  const thereKeeps =
    hereKeeps.ok && hereKeeps.status === 200
      ? await callMachine(there.environmentId, `${PEERS}/link`, {
          environmentId: here.environmentId,
          label: here.label,
          baseUrl: hereAt,
          token: hereToken,
        })
      : null;
  if (thereKeeps !== null && thereKeeps.ok && thereKeeps.status === 200) return null;
  await undo();
  return `${reasonOf(thereKeeps ?? hereKeeps)}.`;
}

/** Ends a link both ways: this machine forgets it and tells the other. */
export async function unlinkMachine(here: EnvironmentId, there: string): Promise<string | null> {
  const answer = await callMachine(here, `${PEERS}/unlink`, { environmentId: there });
  return answer.ok && answer.status === 200 ? null : `${reasonOf(answer)}.`;
}
