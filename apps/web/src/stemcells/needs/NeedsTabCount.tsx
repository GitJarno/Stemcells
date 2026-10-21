import { useNeeds } from "./stream";

import "../tokens/stemcells.css";
import "./needs.css";

/** How many Cells need the person, on Aski's tab: one glance from any tab. */
export function NeedsTabCount() {
  const count = useNeeds().needs?.length ?? 0;
  if (count === 0) return null;
  return (
    <span
      data-stemcells-needs-tab-count=""
      aria-label={count === 1 ? "1 needs you" : `${count} need you`}
    >
      {count}
    </span>
  );
}
