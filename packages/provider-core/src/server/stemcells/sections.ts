/**
 * Stemcells' own sections, after upstream's in `orchestrationInstructions.ts` (`seams.md`, The
 * close-out): the forms a reply takes, then the close-out, which stays last as the reader of a
 * Cell's stops and upstream's numbering of entries both expect.
 */
import { STEMCELLS_CLOSE_OUT_SECTION } from "./closeOut.ts";
import { STEMCELLS_FORMS_SECTION } from "./forms.ts";

export const STEMCELLS_SECTIONS: ReadonlyArray<string> = [
  STEMCELLS_FORMS_SECTION,
  STEMCELLS_CLOSE_OUT_SECTION,
];
