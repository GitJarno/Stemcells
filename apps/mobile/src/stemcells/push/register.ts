/**
 * The phone asks each Mac it keeps a connection to for pushes (stemcells/tasks/phone-push.md):
 * it posts its APNs token, which of Apple's services the token is on, and the bundle id to the
 * Mac's `/api/stemcells/push/devices` with the connection's own credentials. The Mac sends to
 * Apple itself; nothing goes through anyone else's service.
 */

import { askMachine, type MachineConnection } from "../upstream/machines";

export interface PhoneDevice {
  readonly token: string;
  readonly environment: "development" | "production";
  readonly topic: string;
  readonly label: string;
}

/** What one Mac said: it will push here, it isn't a Stemcells Mac, it refused, or it wasn't reached. */
export type Registered = "registered" | "not-stemcells" | "refused" | "unreachable";

const PATH = "/api/stemcells/push/devices";

export async function registerWith(
  connection: MachineConnection,
  device: PhoneDevice,
  ask: typeof askMachine = askMachine,
): Promise<Registered> {
  try {
    const answer = await ask(connection.environmentId, PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(device),
    });
    if (answer === null) return "unreachable";
    if (answer.ok) return "registered";
    // Upstream's server, or a Stemcells one from before pushes.
    if (answer.status === 404) return "not-stemcells";
    return "refused";
  } catch {
    return "unreachable";
  }
}
