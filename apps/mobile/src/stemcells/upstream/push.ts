// What the phone's push registration takes from upstream
// (stemcells/tasks/phone-push.md): the saved connections and their
// credentials, whether this build can take pushes at all, upstream's
// permission prompt, and which of Apple's services a build's token is on.

export { supportsAgentAwarenessPush } from "../../features/agent-awareness/capabilities";
export { requestAgentNotificationPermission } from "../../features/agent-awareness/notificationPermissions";
export { resolveApsEnvironment } from "../../features/agent-awareness/registrationPayload";
import type { EnvironmentId } from "@t3tools/contracts";

import type { SavedRemoteConnection } from "../../lib/connection";
import { useSavedRemoteConnection } from "../../state/use-remote-environment-registry";

export type { SavedRemoteConnection };
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";

/** One machine's saved connection, a new one each time its route or token changes. */
export function useSavedConnection(environmentId: string): SavedRemoteConnection | null {
  return useSavedRemoteConnection(environmentId as EnvironmentId);
}

/** A connection T3's relay manages: marked so, or signed with DPoP, which only the relay issues. */
export function isRelayManagedConnection(
  connection: Pick<SavedRemoteConnection, "authenticationMethod" | "relayManaged">,
): boolean {
  return connection.relayManaged === true || connection.authenticationMethod === "dpop";
}
