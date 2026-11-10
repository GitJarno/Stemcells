import { PlusIcon } from "lucide-react";
import { useState } from "react";

import type { PlanReading } from "../limits/plans";
import { newClaudeAccount } from "../login/accounts";
import { useNeeds } from "../needs/stream";
import { useChatWork } from "../upstream/limits";
import {
  AddManagedCodexAccountDialog,
  ClaudeSignInTerminal,
  type EnvironmentId,
  useAccounts,
  useAddClaudeAccount,
  useRefreshProviders,
} from "../upstream/login";
import { Button, toastManager } from "../upstream/ui";
import { ACCOUNT_PROVIDER, accountLines, cellsOf, usageWords, type AccountLine } from "./lines";
import { moveHeld } from "./move";

import "./accounts.css";

/**
 * Every Claude and Codex account on this Mac's server, under the plans on the Usage page: who is
 * signed in, what flies and what a limit holds on each, signing in, adding one, and moving held
 * Cells to one. A list in the server's own order; nothing here says which account to pick.
 */
export function Accounts(props: { planOf: (instance: string) => PlanReading | null }) {
  const { environmentId, sources, takenIds, takenHomes } = useAccounts();
  const { conditions } = useNeeds();
  const work = useChatWork();
  if (environmentId === null || sources.length === 0) return null;
  const working = new Map(
    sources.map((source) => [
      source.instanceId,
      work.working.get(`${environmentId}:${source.instanceId}`) ?? 0,
    ]),
  );
  return (
    <List
      environmentId={environmentId}
      lines={accountLines(sources, conditions ?? [], working)}
      usageOf={(instanceId) => usageWords(props.planOf(`${environmentId}:${instanceId}`))}
      takenIds={takenIds}
      takenHomes={takenHomes}
    />
  );
}

function List(props: {
  environmentId: EnvironmentId;
  lines: ReadonlyArray<AccountLine>;
  usageOf: (instanceId: string) => string;
  takenIds: ReadonlySet<string>;
  takenHomes: ReadonlySet<string>;
}) {
  const { environmentId, lines } = props;
  const addClaudeAccount = useAddClaudeAccount(environmentId);
  const refreshProviders = useRefreshProviders(environmentId);
  // The Claude account signing in, by its instance, or Codex's own dialog adding one.
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A Claude account is a config folder of its own, signed in by Claude Code itself; nothing
  // here sees the login.
  const addClaude = async () => {
    const account = newClaudeAccount(props.takenIds, props.takenHomes);
    setBusy(true);
    const saved = await addClaudeAccount(account).finally(() => setBusy(false));
    if (saved) setSigningIn(account.instanceId);
    else toastManager.add({ type: "error", title: "Couldn't add a Claude account" });
  };

  const move = async (line: AccountLine) => {
    setBusy(true);
    const { moved, why } = await moveHeld(line.movable, line.instanceId).finally(() =>
      setBusy(false),
    );
    if (moved > 0) {
      toastManager.add({
        type: "success",
        title: `${cellsOf(moved)} ${moved === 1 ? "carries" : "carry"} on with ${line.name}`,
      });
    }
    if (why !== null) {
      toastManager.add({ type: "error", title: "Couldn't move every Cell", description: why });
    }
  };

  const done = () => {
    setSigningIn(null);
    refreshProviders();
  };
  const drivers = new Set(lines.map((line) => line.driver));
  const signing = lines.find((line) => line.instanceId === signingIn);

  return (
    <section data-stemcells-accounts="" aria-label="Accounts">
      <h2>Accounts</h2>
      <table>
        <tbody>
          {lines.map((line) => (
            <tr key={line.instanceId} data-signed-in={line.signedIn ? "true" : "false"}>
              <td data-account-provider="">{ACCOUNT_PROVIDER[line.driver]}</td>
              <td data-account-who="">
                {line.name === ACCOUNT_PROVIDER[line.driver] ? null : <b>{line.name}</b>}
                {line.detail ? <span>{line.detail}</span> : null}
              </td>
              <td data-account-cells="">
                {[
                  line.working > 0 ? `${line.working} flying` : null,
                  line.holding > 0 ? `${line.holding} holding` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </td>
              <td data-account-usage="">{props.usageOf(line.instanceId)}</td>
              <td data-account-acts="">
                {line.movable.length > 0 ? (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void move(line)}
                  >
                    Move {line.movable.length} holding{" "}
                    {line.movable.length === 1 ? "Cell" : "Cells"} here
                  </Button>
                ) : null}
                {line.driver === "claudeAgent" ? (
                  <Button
                    size="xs"
                    variant="ghost-muted"
                    onClick={() => setSigningIn(line.instanceId)}
                  >
                    {line.signedIn ? "Sign in again" : "Sign in"}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div data-account-add="">
        {drivers.has("claudeAgent") ? (
          <Button size="xs" variant="ghost-muted" disabled={busy} onClick={() => void addClaude()}>
            <PlusIcon />
            Add a Claude account
          </Button>
        ) : null}
        {drivers.has("codex") ? (
          <Button size="xs" variant="ghost-muted" onClick={() => setSigningIn("codex")}>
            <PlusIcon />
            Add a Codex account
          </Button>
        ) : null}
      </div>
      {signingIn === "codex" ? (
        <AddManagedCodexAccountDialog environmentId={environmentId} onClose={done} />
      ) : signingIn !== null ? (
        <div data-account-signing="">
          <p>Signing in{signing ? ` · ${signing.name}` : ""}</p>
          <ClaudeSignInTerminal
            environmentId={environmentId}
            instanceId={signingIn}
            onClose={done}
          />
        </div>
      ) : null}
    </section>
  );
}
