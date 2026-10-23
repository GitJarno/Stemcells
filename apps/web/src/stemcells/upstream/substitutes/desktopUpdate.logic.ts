// Replaces `components/desktopUpdate.logic.ts` (`plugin.ts`): a Stemcells
// nightly is a day's merges to main, not a release on GitHub
// (apps/desktop/src/stemcells/updates/changes.ts), so its notes link the pull
// requests merged that day, in the repository upstream's own setting names.
import * as Upstream from "../../../components/desktopUpdate.logic";

export * from "../../../components/desktopUpdate.logic";

const NIGHTLY_DAY = /-nightly\.(\d{4})(\d{2})(\d{2})\.\d+$/u;

const mergedPullRequestsUrl = (repository: string | undefined, day?: string) => {
  const releases = Upstream.getDesktopUpdateReleaseHistoryUrl(repository);
  const query = day ? `is:pr is:merged merged:${day}` : "is:pr is:merged";
  return `${releases.replace(/\/releases$/u, "")}/pulls?q=${encodeURIComponent(query)}`;
};

export const getDesktopUpdateReleaseUrl: typeof Upstream.getDesktopUpdateReleaseUrl = (
  version,
  repository = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY,
) => {
  const day = NIGHTLY_DAY.exec(version?.trim() ?? "");
  return day
    ? mergedPullRequestsUrl(repository, `${day[1]}-${day[2]}-${day[3]}`)
    : Upstream.getDesktopUpdateReleaseUrl(version, repository);
};

export const getDesktopUpdateReleaseHistoryUrl: typeof Upstream.getDesktopUpdateReleaseHistoryUrl =
  (repository = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY) =>
    mergedPullRequestsUrl(repository);
