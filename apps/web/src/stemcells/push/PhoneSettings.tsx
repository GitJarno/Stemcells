import { useRef, useState } from "react";

import {
  Button,
  formatRelativeTimeLabel,
  Input,
  SettingsRow,
  SettingsSection,
  toastManager,
  useNowMinuteMs,
} from "../upstream/disk";
import { forgetKey, forgetPhone, sendTest, setKey, usePushStatus } from "./push";

// Settings › Aski › Your phone (stemcells/tasks/phone-push.md): the person's
// APNs key, the phones that asked for pushes, and a test push. The key goes
// to this Mac's secret store and never comes back to a screen.

const APPLE_ID = /^[A-Z0-9]{10}$/;

const failed = (title: string, why: string) =>
  toastManager.add({ type: "error", title, description: why });

function KeyForm({ onDone }: { readonly onDone: () => void }) {
  const [keyId, setKeyId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [file, setFile] = useState<{ readonly name: string; readonly text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const ready = APPLE_ID.test(keyId) && APPLE_ID.test(teamId) && file !== null;

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    const outcome = await setKey({ keyId, teamId, p8: file.text });
    setSaving(false);
    if (!outcome.ok) return failed("Couldn't keep the key", outcome.why);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 pt-1 pb-3">
      <div className="flex gap-2">
        <Input
          size="sm"
          font="mono"
          aria-label="Key ID"
          placeholder="Key ID"
          value={keyId}
          onValueChange={(value) => setKeyId(value.trim().toUpperCase())}
        />
        <Input
          size="sm"
          font="mono"
          aria-label="Team ID"
          placeholder="Team ID"
          value={teamId}
          onValueChange={(value) => setTeamId(value.trim().toUpperCase())}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={picker}
          type="file"
          accept=".p8"
          hidden
          onChange={async (event) => {
            const chosen = event.target.files?.[0];
            if (chosen) setFile({ name: chosen.name, text: await chosen.text() });
          }}
        />
        <Button size="xs" variant="outline" onClick={() => picker.current?.click()}>
          Choose .p8 file
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {file?.name ?? "The file Apple let you download once"}
        </span>
        <Button size="xs" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="xs" disabled={!ready || saving} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function PhoneSettings() {
  const status = usePushStatus();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const nowMs = useNowMinuteMs();
  if (status === null) return null;
  const { key, devices, last } = status;

  const removeKey = async () => {
    setBusy(true);
    const outcome = await forgetKey();
    setBusy(false);
    if (!outcome.ok) failed("Couldn't remove the key", outcome.why);
  };

  const test = async () => {
    setBusy(true);
    const outcome = await sendTest();
    setBusy(false);
    if (!outcome.ok) return failed("Couldn't send a test", outcome.why);
    const missed = outcome.value.results.filter((result) => result.sent.status !== 200);
    if (missed.length === 0)
      toastManager.add({ type: "success", title: "Sent. Check your phone." });
    else
      failed(
        "Apple didn't take it",
        missed
          .map((result) => `${result.label}: ${result.sent.reason ?? result.sent.status}`)
          .join("\n"),
      );
  };

  const remove = async (token: string) => {
    setRemoving(token);
    const outcome = await forgetPhone(token);
    setRemoving(null);
    if (!outcome.ok) failed("Couldn't remove the phone", outcome.why);
  };

  return (
    <SettingsSection id="aski-phone" title="Your phone">
      <SettingsRow
        id="aski-push-key"
        title="Apple push key"
        description="When a Cell has waited on you for two minutes and nobody is at this Mac, your phone hears of it. The push goes from this Mac straight to Apple with your own APNs key, from the Keys page of your Apple Developer account. The key stays on this Mac."
        status={key === null ? "No key yet." : `Key ${key.keyId}, team ${key.teamId}`}
        control={
          key === null ? (
            adding ? null : (
              <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
                Add key
              </Button>
            )
          ) : (
            <Button
              size="xs"
              variant="destructive-outline"
              disabled={busy}
              onClick={() => void removeKey()}
            >
              Remove
            </Button>
          )
        }
      >
        {key === null && adding ? <KeyForm onDone={() => setAdding(false)} /> : null}
      </SettingsRow>
      <SettingsRow
        id="aski-push-phones"
        title="Phones"
        description="A phone asks for pushes once Stemcells on it may notify you."
        status={
          last === null
            ? devices.length === 0
              ? "No phone yet."
              : null
            : last.ok
              ? `Last push ${formatRelativeTimeLabel(last.at, nowMs)} reached Apple.`
              : `Last push ${formatRelativeTimeLabel(last.at, nowMs)} didn't: ${last.why ?? "no reason given"}.`
        }
        control={
          <Button
            size="xs"
            variant="outline"
            disabled={busy || key === null || devices.length === 0}
            onClick={() => void test()}
          >
            Send a test
          </Button>
        }
      >
        {devices.length > 0 ? (
          <ul className="flex flex-col gap-1 pt-1 pb-3">
            {devices.map((device) => (
              <li key={device.token} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-foreground">{device.label}</span>
                <span className="text-muted-foreground">
                  {device.environment === "development" ? "development build" : "release build"},
                  added {formatRelativeTimeLabel(device.addedAt, nowMs)}
                </span>
                <Button
                  size="xs"
                  variant="destructive-outline"
                  disabled={removing !== null}
                  onClick={() => void remove(device.token)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingsRow>
    </SettingsSection>
  );
}
