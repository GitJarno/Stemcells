/**
 * The phone asks each Mac it keeps a connection to for pushes (stemcells/tasks/phone-push.md):
 * it posts its APNs token, which of Apple's services the token is on, and the bundle id to the
 * Mac's `/api/stemcells/push/devices` with the connection's own credentials. The Mac sends to
 * Apple itself; nothing goes through anyone else's service.
 */

export interface PhoneDevice {
  readonly token: string;
  readonly environment: "development" | "production";
  readonly topic: string;
  readonly label: string;
}

/** What one Mac said: it will push here, it isn't a Stemcells Mac, it refused, or it wasn't reached. */
export type Registered = "registered" | "not-stemcells" | "refused" | "unreachable";

/** A connection as registration reads it: where the Mac answers, and the bearer token it paired with. */
export interface MacConnection {
  readonly httpBaseUrl: string;
  readonly bearerToken: string | null;
}

const PATH = "/api/stemcells/push/devices";

export async function registerWith(
  connection: MacConnection,
  device: PhoneDevice,
  request: typeof fetch = fetch,
): Promise<Registered> {
  if (connection.bearerToken === null) return "refused";
  let url: string;
  try {
    url = new URL(PATH, connection.httpBaseUrl).toString();
  } catch {
    return "unreachable";
  }
  try {
    const answer = await request(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(device),
    });
    if (answer.ok) return "registered";
    // Upstream's server, or a Stemcells one from before pushes.
    if (answer.status === 404) return "not-stemcells";
    return "refused";
  } catch {
    return "unreachable";
  }
}
