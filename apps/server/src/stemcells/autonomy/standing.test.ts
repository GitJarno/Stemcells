import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import * as S from "./standing.ts";

describe("autonomy's standing, as kept on disk", () => {
  it("reads a file written before grants had times, counting its grants from the read", () => {
    const decode = Schema.decodeUnknownSync(Schema.fromJsonString(S.Standing));
    const older = decode(
      '{"streaks":{"retry":2,"goAhead":0,"implement":0},"granted":["retry"],"declined":["goAhead"],"kept":["thread-1:failed:run-1"]}',
    );
    const standing = S.loaded(older, 1_000);
    expect(standing.grantedAt).toEqual({ retry: 1_000 });
    expect(standing.declined).toEqual(["goAhead"]);
    expect(standing.kept).toEqual(["thread-1:failed:run-1"]);
    expect(S.offers({ ...standing, streaks: { ...standing.streaks, goAhead: 5 } })).toEqual([]);
  });
});
