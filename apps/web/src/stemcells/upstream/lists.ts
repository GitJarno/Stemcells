/**
 * Upstream's Issues and Pull requests lists, which its sidebar's foot opens
 * (`SidebarChrome.tsx`) and the column's foot opens in its place, each only
 * where some environment supports it. `rail.contract.test.ts` pins the routes.
 */
import { useNavigate } from "@tanstack/react-router";

import { readIssueListPreferences } from "../../components/issue/issueListPreferences";
import { IssueGlyph } from "../../components/issue/issuePresentation";
import { readPullRequestListPreferences } from "../../components/pullRequest/pullRequestListPreferences";
import { PullRequestGlyph } from "../../components/pullRequest/pullRequestIcons";
import { useIssuesSupported, usePullRequestsSupported } from "../../state/environments";

export const IssuesIcon = IssueGlyph.issue;
export const PullRequestsIcon = PullRequestGlyph.pullRequest;

/** Opens each list with the filters it was last left on, or null where none can show. */
export function useListOpeners() {
  const navigate = useNavigate();
  const issues = useIssuesSupported();
  const pullRequests = usePullRequestsSupported();
  return {
    issues: issues
      ? () => void navigate({ to: "/issues", search: readIssueListPreferences() })
      : null,
    pullRequests: pullRequests
      ? () => void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() })
      : null,
  };
}
