import { useDraftReport } from "./useDraftReport";

/**
 * Reports this screen's drafts (`useDraftReport`). `AppSidebarLayout`
 * renders it beside the sidebar, never in it: a narrow window's sidebar is a
 * sheet that isn't drawn while closed, and the legacy sidebar replaces our
 * column. Draws nothing.
 */
export function DraftReport() {
  useDraftReport();
  return null;
}
