import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { carryClaudeTranscript } from "./carry.ts";

const SESSION = "11111111-2222-4333-8444-555555555555";
const PROJECT = "-Users-example-projects-app";

const setUp = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-carry-" });
  const work = path.join(root, "claude-work");
  const personal = path.join(root, "claude-personal");
  const transcript = (folder: string) => path.join(folder, "projects", PROJECT, `${SESSION}.jsonl`);
  const write = Effect.fn(function* (folder: string, text: string, modified: number) {
    yield* fs.makeDirectory(path.dirname(transcript(folder)), { recursive: true });
    yield* fs.writeFileString(transcript(folder), text);
    yield* fs.utimes(transcript(folder), modified, modified);
  });
  const read = (folder: string) => fs.readFileString(transcript(folder));
  return { fs, path, work, personal, transcript, write, read };
});

describe("a Claude transcript carried to the account that resumes it", () => {
  it.effect("copies the transcript and its subagents into the target's same project folder", () =>
    Effect.gen(function* () {
      const { fs, path, work, personal, write, read } = yield* setUp;
      yield* write(work, "turn 1\nturn 2\n", 1_000);
      const subagent = path.join(work, "projects", PROJECT, SESSION, "subagents", "agent-a.jsonl");
      yield* fs.makeDirectory(path.dirname(subagent), { recursive: true });
      yield* fs.writeFileString(subagent, "subagent turn\n");

      const carried = yield* carryClaudeTranscript({
        sessionId: SESSION,
        target: personal,
        folders: [work, personal],
      });

      assert.isTrue(carried);
      assert.equal(yield* read(personal), "turn 1\nturn 2\n");
      assert.equal(
        yield* fs.readFileString(
          path.join(personal, "projects", PROJECT, SESSION, "subagents", "agent-a.jsonl"),
        ),
        "subagent turn\n",
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("going back to an account brings the turns the other one added", () =>
    Effect.gen(function* () {
      const { work, personal, write, read } = yield* setUp;
      yield* write(work, "turn 1\n", 1_000);
      yield* write(personal, "turn 1\nturn 2 on personal\n", 2_000);

      assert.isTrue(
        yield* carryClaudeTranscript({
          sessionId: SESSION,
          target: work,
          folders: [work, personal],
        }),
      );
      assert.equal(yield* read(work), "turn 1\nturn 2 on personal\n");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("leaves a target that already has the newest transcript alone", () =>
    Effect.gen(function* () {
      const { work, personal, write, read } = yield* setUp;
      yield* write(work, "turn 1\n", 1_000);
      yield* write(personal, "turn 1\nturn 2\n", 2_000);

      assert.isFalse(
        yield* carryClaudeTranscript({
          sessionId: SESSION,
          target: personal,
          folders: [work, personal],
        }),
      );
      assert.equal(yield* read(personal), "turn 1\nturn 2\n");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("does nothing when no other account has the session", () =>
    Effect.gen(function* () {
      const { fs, work, personal, transcript } = yield* setUp;
      assert.isFalse(
        yield* carryClaudeTranscript({
          sessionId: SESSION,
          target: personal,
          folders: [work, personal],
        }),
      );
      assert.isFalse(yield* fs.exists(transcript(personal)));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
