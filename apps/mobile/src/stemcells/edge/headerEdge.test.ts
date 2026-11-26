import { expect, it } from "vite-plus/test";

import { headerEdges, NO_HEADER_BAND } from "./headerEdge";

const automatic = { top: "automatic", bottom: "soft", left: "hidden", right: "hidden" } as const;

it.each([
  [
    "the home, whatever its list asks",
    { home: true, duoPage: false, asked: automatic },
    NO_HEADER_BAND,
  ],
  [
    "a page in the Duo's columns",
    { home: false, duoPage: true, asked: automatic },
    { ...automatic, top: "hidden" },
  ],
  [
    "a Duo page that asked nothing",
    { home: false, duoPage: true, asked: undefined },
    NO_HEADER_BAND,
  ],
  [
    "a phone's page, or a sheet on the Duo",
    { home: false, duoPage: false, asked: automatic },
    automatic,
  ],
] as const)("%s", (_, input, expected) => {
  expect(headerEdges(input)).toEqual(expected);
});
