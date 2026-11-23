// Settings › Aski's rows, which upstream's search index doesn't hold: the shared catalog takes
// them too, so a reply's path reaches them (`settingsCatalog.contract.test.ts`).
import { KINDS } from "../autonomy/autonomy";
import { ASKI_SWITCHES } from "../aski/settingLinks";

const ASKI = "/settings/aski";

export const OUR_ROWS = [
  { id: "aski-tab-on", title: "Aski's tab", page: ASKI },
  { id: "aski-plans", title: ASKI_SWITCHES["aski-plans"].title, page: ASKI },
  { id: "aski-takes-retry", title: KINDS.retry.title, page: ASKI },
  { id: "aski-takes-go-ahead", title: KINDS.goAhead.title, page: ASKI },
  { id: "aski-takes-implement", title: KINDS.implement.title, page: ASKI },
] as const;
