/**
 * Upstream's pieces `/login` is built from (`stemcells/login/`): the providers' statuses, the
 * composer's draft, the model picker's own select, the instance mutation, Codex's ChatGPT
 * sign-in and the welcome wizard's sign-in terminal. Aski's chat has no `/login`: its instance
 * carries its persona, and no Cell moves onto it.
 */
import { useAtomValue } from "@effect/atom-react";
import {
  type EnvironmentId,
  type ModelSelection,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import type { UnifiedSettings } from "@t3tools/contracts/settings";

import { AgentInstallTerminal } from "../../components/onboarding/WelcomeWizard";
import { useComposerDraftStore, type ComposerThreadTarget } from "../../composerDraftStore";
import { usePersistEnvironmentProviderInstanceMutation } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { useState } from "react";

import { toastManager } from "../../components/ui/toast";
import { isAskisInstance } from "../aski/setup";
import { accountRows, isLoginPrompt, LOGIN_COMMAND, type AccountFacts } from "../login/accounts";
import { loginBannerItem } from "../login/LoginPanel";

export { AddManagedCodexAccountDialog } from "../../components/settings/CodexSetupSection";
export type { ComposerBannerStackItem } from "../../components/chat/ComposerBannerStack";
export type { ComposerThreadTarget, EnvironmentId };

/** The providers whose accounts `/login` lists: those a thread can move between losslessly. */
const LOGIN_DRIVERS = ["claudeAgent", "codex"] as const;
type LoginDriver = (typeof LOGIN_DRIVERS)[number];

const isLoginDriver = (driver: string | undefined): driver is LoginDriver =>
  (LOGIN_DRIVERS as ReadonlyArray<string>).includes(driver ?? "");

const LOGIN_SLASH_COMMAND = {
  name: LOGIN_COMMAND,
  description: "Move this chat to another account, or add one",
};

/** The statuses with `/login` among Claude's and Codex's commands, so the menu offers it. */
export function withLoginCommand(providers: ServerProvider[]): ServerProvider[] {
  let changed = false;
  const next = providers.map((provider) => {
    if (!isLoginDriver(provider.driver) || isAskisInstance(provider.instanceId)) return provider;
    if (provider.slashCommands.some((command) => command.name === LOGIN_COMMAND)) return provider;
    changed = true;
    return { ...provider, slashCommands: [...provider.slashCommands, LOGIN_SLASH_COMMAND] };
  });
  return changed ? next : providers;
}

/**
 * The instances a Cell on `current` can move to with its whole conversation: its driver's
 * enabled ones on the same continuation (the server gives every plain Claude login one).
 */
export function loginAccountsOf(
  providers: ReadonlyArray<ServerProvider>,
  current: ProviderInstanceId,
): AccountFacts[] {
  const here = providers.find((provider) => provider.instanceId === current);
  if (here === undefined) return [];
  const continuation = here.continuation?.groupKey;
  return providers
    .filter(
      (provider) =>
        provider.driver === here.driver &&
        (provider.enabled || provider === here) &&
        provider.continuation?.groupKey === continuation,
    )
    .map((provider) => ({
      instanceId: provider.instanceId,
      displayName: provider.displayName ?? null,
      email: provider.auth.email ?? null,
      plan: provider.auth.label ?? null,
      signedIn: provider.auth.status === "authenticated",
    }));
}

/** What the composer would send with: the draft's own choice, else the thread's. */
function composerSelectionOf(
  target: ComposerThreadTarget,
  threadSelection: { readonly instanceId: ProviderInstanceId; readonly model: string } | null,
): { readonly instanceId: ProviderInstanceId; readonly model: string | null } | null {
  const draft = useComposerDraftStore.getState().getComposerDraft(target);
  const chosen = draft?.activeProvider ?? null;
  if (chosen !== null) {
    return { instanceId: chosen, model: draft?.modelSelectionByProvider[chosen]?.model ?? null };
  }
  return threadSelection;
}

const composerPromptOf = (target: ComposerThreadTarget): string =>
  useComposerDraftStore.getState().getComposerDraft(target)?.prompt ?? "";

const clearComposerPrompt = (target: ComposerThreadTarget): void =>
  useComposerDraftStore.getState().setPrompt(target, "");

/** Adds a Claude instance on its own config folder; true once the server saved it. */
export function useAddClaudeAccount(environmentId: EnvironmentId) {
  const persist = usePersistEnvironmentProviderInstanceMutation(environmentId);
  return async (account: {
    readonly instanceId: string;
    readonly displayName: string;
    readonly homePath: string;
  }) => {
    const result = await persist({
      operation: "create",
      instanceId: ProviderInstanceId.make(account.instanceId),
      instance: {
        driver: ProviderDriverKind.make("claudeAgent"),
        enabled: true,
        displayName: account.displayName,
        config: { homePath: account.homePath },
      },
    });
    return result._tag === "Success";
  };
}

/** Asks the server to read its providers again, so a new sign-in shows. */
export function useRefreshProviders(environmentId: EnvironmentId) {
  const refresh = useAtomCommand(serverEnvironment.refreshProviders, { reportFailure: false });
  return () => void refresh({ environmentId, input: {} });
}

/**
 * Claude Code's own `claude auth login`, typed into the welcome wizard's terminal, which runs
 * with the instance's environment, so the login lands in its config folder.
 */
export function ClaudeSignInTerminal(props: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: string;
  readonly onClose: () => void;
}) {
  const serverConfig = useAtomValue(serverEnvironment.configValueAtom(props.environmentId));
  if (serverConfig === null) return null;
  return (
    <AgentInstallTerminal
      session={{
        environmentId: props.environmentId,
        driver: "claudeAgent",
        providerInstanceId: ProviderInstanceId.make(props.instanceId),
        cwd: serverConfig.cwd,
        command: "claude auth login",
        keybindings: serverConfig.keybindings,
      }}
      onClose={props.onClose}
    />
  );
}

const PROVIDER_NAME: Record<LoginDriver, string> = { claudeAgent: "Claude", codex: "Codex" };

const targetKeyOf = (target: ComposerThreadTarget): string =>
  typeof target === "string" ? target : `${target.environmentId}:${target.threadId}`;

/** The config folders Claude instances already use, as settings spell them. */
function claudeHomesOf(settings: UnifiedSettings): Set<string> {
  const homes = new Set<string>();
  for (const instance of Object.values(settings.providerInstances ?? {})) {
    const homePath = (instance?.config as { readonly homePath?: unknown } | undefined)?.homePath;
    if (typeof homePath === "string") homes.add(homePath.trim());
  }
  return homes;
}

/**
 * `/login` sent from a Claude or Codex Cell opens the sign-in card instead of reaching the
 * agent; `tryOpen` says whether it took the send. Picking an account is the model picker's own
 * select, with its guards and each model's remembered options.
 */
export function useLoginPanel(input: {
  readonly environmentId: EnvironmentId;
  readonly target: ComposerThreadTarget;
  readonly threadSelection: ModelSelection | null | undefined;
  readonly providers: ServerProvider[];
  readonly settings: UnifiedSettings;
  readonly selectModel: (
    instanceId: ProviderInstanceId,
    model: string,
    options?: { focusComposer?: boolean },
  ) => void;
}) {
  const { environmentId, target, threadSelection, providers, settings, selectModel } = input;
  const [open, setOpen] = useState<{
    readonly key: string;
    readonly targetKey: string;
    readonly driver: LoginDriver;
    readonly instanceId: ProviderInstanceId;
    readonly model: string | null;
  } | null>(null);

  const tryOpen = (): boolean => {
    if (!isLoginPrompt(composerPromptOf(target))) return false;
    const selection = composerSelectionOf(target, threadSelection ?? null);
    const driver = providers.find(
      (provider) => provider.instanceId === selection?.instanceId,
    )?.driver;
    if (selection === null || !isLoginDriver(driver) || isAskisInstance(selection.instanceId)) {
      return false;
    }
    clearComposerPrompt(target);
    // A fresh id per opening: the stack keeps the last dismissed id as "exiting".
    setOpen({ key: String(Date.now()), targetKey: targetKeyOf(target), driver, ...selection });
    return true;
  };

  // The card belongs to the chat `/login` was sent in, not to the next one on screen.
  const banner =
    open === null || open.targetKey !== targetKeyOf(target)
      ? null
      : loginBannerItem({
          key: open.key,
          environmentId,
          driver: open.driver,
          rows: accountRows(
            loginAccountsOf(providers, open.instanceId),
            open.instanceId,
            PROVIDER_NAME[open.driver],
          ),
          takenIds: new Set([
            ...LOGIN_DRIVERS,
            ...providers.map((provider) => provider.instanceId),
            ...Object.keys(settings.providerInstances ?? {}),
          ]),
          takenHomes: claudeHomesOf(settings),
          onPick: (row) => {
            // The picker says no with a toast of its own when the account can't take the Cell.
            selectModel(ProviderInstanceId.make(row.instanceId), open.model ?? "", {
              focusComposer: false,
            });
            const moved = composerSelectionOf(target, null)?.instanceId === row.instanceId;
            if (moved) {
              toastManager.add({ type: "success", title: `This Cell carries on with ${row.name}` });
            }
            return moved;
          },
          onDismiss: () => setOpen(null),
        });

  return { tryOpen, banner };
}
