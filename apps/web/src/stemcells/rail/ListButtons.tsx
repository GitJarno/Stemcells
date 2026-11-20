import { useLocation } from "@tanstack/react-router";

import { IssuesIcon, PullRequestsIcon, useListOpeners } from "../upstream/lists";
import { useNavigateToMainApp } from "../upstream/settings";
import { RailButton } from "./RailParts";

/** The foot's Pull requests and Issues, as upstream's sidebar's; on its own list, back to work. */
export function ListButtons() {
  const open = useListOpeners();
  const backToWork = useNavigateToMainApp();
  const pathname = useLocation({ select: (location) => location.pathname });
  const toggle = (path: string, opener: () => void) =>
    pathname === path ? () => void backToWork() : opener;
  return (
    <>
      {open.pullRequests === null ? null : (
        <RailButton
          label="Pull requests"
          on={pathname === "/pull-requests"}
          onClick={toggle("/pull-requests", open.pullRequests)}
        >
          <PullRequestsIcon />
        </RailButton>
      )}
      {open.issues === null ? null : (
        <RailButton
          label="Issues"
          on={pathname === "/issues"}
          onClick={toggle("/issues", open.issues)}
        >
          <IssuesIcon />
        </RailButton>
      )}
    </>
  );
}
