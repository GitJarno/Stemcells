import { CheckIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import {
  AddManagedCodexAccountDialog,
  ClaudeSignInTerminal,
  type ComposerBannerStackItem,
  type EnvironmentId,
  useAddClaudeAccount,
  useRefreshProviders,
} from "../upstream/login";
import { Button, ComposerBanner, toastManager } from "../upstream/ui";
import { type AccountRow, newClaudeAccount } from "./accounts";

type Driver = "claudeAgent" | "codex";

const PROVIDER_NAME: Record<Driver, string> = { claudeAgent: "Claude", codex: "Codex" };

export interface LoginPanelInput {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly driver: Driver;
  readonly rows: ReadonlyArray<AccountRow>;
  readonly takenIds: ReadonlySet<string>;
  readonly takenHomes: ReadonlySet<string>;
  /** Moves the Cell to the account; false when it couldn't. */
  readonly onPick: (row: AccountRow) => boolean;
  readonly onDismiss: () => void;
}

/** The `/login` card above the composer: the provider's accounts, and one more. */
export function loginBannerItem(input: LoginPanelInput): ComposerBannerStackItem {
  return {
    id: `login:${input.key}`,
    variant: "info",
    icon: <KeyRoundIcon />,
    title: `Sign in · ${PROVIDER_NAME[input.driver]}`,
    description: "The Cell keeps its whole conversation.",
    dismissLabel: "Close sign-in",
    onDismiss: input.onDismiss,
    children: <LoginBody {...input} />,
  };
}

function LoginBody(input: LoginPanelInput) {
  const { environmentId, driver, rows, takenIds, takenHomes, onPick, onDismiss } = input;
  const addClaudeAccount = useAddClaudeAccount(environmentId);
  const refreshProviders = useRefreshProviders(environmentId);
  const [adding, setAdding] = useState<"codex" | { readonly instanceId: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = (row: AccountRow) => {
    // A Claude account left signed out (an add given up halfway) signs in where it is.
    if (!row.signedIn && driver === "claudeAgent") setAdding({ instanceId: row.instanceId });
    else if (row.current || onPick(row)) onDismiss();
  };

  // A Claude account is a config folder of its own, signed in by Claude Code itself; nothing
  // here sees the login.
  const addClaude = async () => {
    const account = newClaudeAccount(takenIds, takenHomes);
    setSaving(true);
    const saved = await addClaudeAccount(account);
    setSaving(false);
    if (saved) setAdding({ instanceId: account.instanceId });
    else toastManager.add({ type: "error", title: "Couldn't add a Claude account" });
  };

  const doneAdding = () => {
    setAdding(null);
    refreshProviders();
  };

  return (
    <ComposerBanner.Scroll>
      <ComposerBanner.Body className="flex flex-col gap-1 pt-1 pb-1.5 pe-2">
        {rows.map((row) => (
          <Button
            key={row.instanceId}
            size="sm-multiline"
            variant="ghost"
            className="justify-start text-start"
            disabled={!row.signedIn && !row.current && driver !== "claudeAgent"}
            onClick={() => pick(row)}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{row.name}</span>
              {row.detail ? (
                <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
              ) : null}
            </span>
            {row.current ? <CheckIcon aria-label="This Cell's account" /> : null}
          </Button>
        ))}
        {adding === null ? (
          <Button
            size="sm"
            variant="ghost-muted"
            className="justify-start"
            disabled={saving}
            onClick={() => (driver === "codex" ? setAdding("codex") : void addClaude())}
          >
            <PlusIcon />
            Add a {PROVIDER_NAME[driver]} account
          </Button>
        ) : adding === "codex" ? (
          <AddManagedCodexAccountDialog environmentId={environmentId} onClose={doneAdding} />
        ) : (
          <ClaudeSignInTerminal
            environmentId={environmentId}
            instanceId={adding.instanceId}
            onClose={doneAdding}
          />
        )}
      </ComposerBanner.Body>
    </ComposerBanner.Scroll>
  );
}
