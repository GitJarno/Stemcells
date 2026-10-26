/**
 * A phone build under the person's own Apple team (stemcells/tasks/phone-push.md). Upstream
 * pins builds to T3's team, which nobody else can sign with, and its Personal Team build drops
 * push; a paid team and an App ID of their own keep push, so their Mac's sender reaches it.
 * `app.config.ts` reads this; nothing at run time does.
 */
export interface OwnTeam {
  readonly teamId: string;
  readonly bundleIdentifier: string;
}

const TEAM_ID = /^[A-Z0-9]{10}$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

/** The team from `STEMCELLS_IOS_TEAM_ID` and `STEMCELLS_IOS_BUNDLE_ID`; null when neither is set. */
export function ownTeam(env: Readonly<Record<string, string | undefined>>): OwnTeam | null {
  const teamId = env.STEMCELLS_IOS_TEAM_ID?.trim() ?? "";
  const bundleIdentifier = env.STEMCELLS_IOS_BUNDLE_ID?.trim() ?? "";
  if (teamId === "" && bundleIdentifier === "") return null;
  if (!TEAM_ID.test(teamId) || !BUNDLE_ID.test(bundleIdentifier)) {
    throw new Error(
      "Set both STEMCELLS_IOS_TEAM_ID, your ten-character Apple Team ID, and STEMCELLS_IOS_BUNDLE_ID, your App ID's bundle id (such as com.example.cells).",
    );
  }
  return { teamId, bundleIdentifier };
}
