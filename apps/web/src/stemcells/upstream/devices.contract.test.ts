import { expect, it } from "vite-plus/test";

import { pairingUrlFor, readPairingUrl } from "./devices";

// Contract: the code a phone scans opens this machine's own `/pair` with
// the token in the URL, the shape upstream's pairing parser (shared by the
// web and the phone) reads back; never T3's hosted app, which upstream's
// own QR prefers for an HTTPS address and Stemcells never sends a phone to.

it("a phone's code opens this machine's own pairing page, with the token the phone reads back", () => {
  const read = readPairingUrl(pairingUrlFor("https://mac.example.ts.net", "one-time-token"));
  expect(read).toEqual({
    hosted: false,
    origin: "https://mac.example.ts.net",
    path: "/pair",
    token: "one-time-token",
  });
});
