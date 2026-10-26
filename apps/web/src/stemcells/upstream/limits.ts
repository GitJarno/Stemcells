/**
 * What the plan board reads from upstream: every signed-in plan's limits,
 * merged across instances and environments as upstream's Usage page merges
 * them, the plan each provider instance signs in with, and what the chats
 * are doing on each. `limits.contract.test.ts` pins what this relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  collectLimitAccounts,
  type LimitAccount,
  type LimitPresentations,
} from "@t3tools/shared/usageLimits";

import { useThreadShells } from "../../state/entities";
import { environmentPresentations } from "../../state/presentation";
import { usePrimarySettings } from "../../hooks/useSettings";
import { formatShortTimestamp } from "../../timestampFormat";
import { statusOfShell } from "./status";

export { formatDuration } from "@t3tools/shared/usageLimits";
export { ResetCredits } from "../../components/usage/UsageLimits";
export type { LimitAccount, LimitPresentations };
export type LimitWindow = LimitAccount["limits"]["windows"][number];

/** A provider instance on an environment, as `environmentId:instanceId`. */
export type InstanceKey = string;

/** What the chats are doing on each instance. */
export interface ChatWork {
  /** Chats working now, per instance. */
  readonly working: ReadonlyMap<InstanceKey, number>;
  /** The instance of the chat the person wrote to last; null before any. */
  readonly lastWritten: InstanceKey | null;
}

interface Login {
  readonly driver: string;
  readonly email?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly usageLimits?: { readonly credentialFingerprint?: string | undefined } | undefined;
}

/**
 * A login as upstream's private `accountKeyResolver` keys the accounts it merges: driver and
 * email, else the credential's fingerprint, then its workspace; one seen in several workspaces
 * with none named has no key. `limits.contract.test.ts` holds this to `collectLimitAccounts`.
 */
function loginResolver(logins: Iterable<Login>): (login: Login) => string | null {
  const keyOf = (login: Login) => {
    const email = login.email?.trim().toLowerCase();
    if (email) return `${login.driver}:${email}`;
    const fingerprint = login.usageLimits?.credentialFingerprint;
    return fingerprint ? `${login.driver}:credential:${fingerprint}` : null;
  };
  const workspaces = new Map<string, Set<string>>();
  for (const login of logins) {
    const key = keyOf(login);
    if (key && login.workspaceId) {
      workspaces.set(key, (workspaces.get(key) ?? new Set()).add(login.workspaceId));
    }
  }
  return (login) => {
    const key = keyOf(login);
    if (!key) return null;
    if (login.workspaceId) return `${key}:${login.workspaceId}`;
    const known = workspaces.get(key);
    if (!known) return key;
    return known.size === 1 ? `${key}:${[...known][0]}` : null;
  };
}

/** The accounts upstream's Usage page shows, and the account each instance signs in with. */
export function limitAccountsOf(presentations: LimitPresentations): {
  readonly accounts: ReadonlyArray<LimitAccount>;
  readonly accountOf: (instance: InstanceKey) => LimitAccount | null;
} {
  const accounts = collectLimitAccounts(presentations);
  // Every login by the key upstream gives the account it is merged into: an
  // instance's `environmentId:instanceId`, a hub account's source and id.
  const logins = [...presentations].flatMap(([environmentId, presentation]) => [
    ...(presentation.serverConfig?.providers ?? [])
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        key: `${environmentId}:${provider.instanceId}`,
        login: {
          driver: provider.driver,
          email: provider.auth.email,
          workspaceId: provider.auth.workspaceId,
          usageLimits: provider.usageLimits,
        } satisfies Login,
      })),
    ...(presentation.serverConfig?.usageLimitSources ?? []).flatMap((source) =>
      source.accounts.map((account) => ({
        key: `${source.id}:${account.id}${account.workspaceId ? `:${account.workspaceId}` : ""}`,
        login: account satisfies Login,
      })),
    ),
  ]);
  const resolve = loginResolver(logins.map(({ login }) => login));
  const loginOf = new Map(logins.map(({ key, login }) => [key, resolve(login) ?? key]));
  const byLogin = new Map(
    accounts.flatMap((account) => {
      const login = loginOf.get(account.key);
      return login === undefined ? [] : [[login, account] as const];
    }),
  );
  return {
    accounts,
    accountOf: (instance) => {
      const login = loginOf.get(instance);
      return login === undefined ? null : (byLogin.get(login) ?? null);
    },
  };
}

export function chatWorkOf(shells: ReadonlyArray<EnvironmentThreadShell>): ChatWork {
  const working = new Map<InstanceKey, number>();
  let lastWritten: { instance: InstanceKey; at: string } | null = null;
  for (const shell of shells) {
    if (shell.archivedAt !== null) continue;
    const instance = `${shell.environmentId}:${shell.runtime?.providerInstanceId ?? shell.providerInstanceId}`;
    if (statusOfShell(shell, undefined) === "Working") {
      working.set(instance, (working.get(instance) ?? 0) + 1);
    }
    const at = shell.latestUserMessageAt;
    if (at !== null && (lastWritten === null || at > lastWritten.at)) {
      lastWritten = { instance, at };
    }
  }
  return { working, lastWritten: lastWritten?.instance ?? null };
}

/** Every environment's providers, as upstream's Usage page reads them. */
export function useLimitPresentations(): LimitPresentations {
  return useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
}

export function useChatWork(): ChatWork {
  return chatWorkOf(useThreadShells());
}

// The app's words are English, so its weekdays are too.
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });

/**
 * A moment as the app writes times (the person's 12- or 24-hour choice),
 * with its weekday once it isn't today: "15.40", "Tue 10.00".
 */
export function useClockFormat(now: number): (at: number) => string {
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const today = new Date(now).toDateString();
  return (at) => {
    const time = formatShortTimestamp(new Date(at).toISOString(), timestampFormat);
    return new Date(at).toDateString() === today ? time : `${weekday.format(at)} ${time}`;
  };
}
