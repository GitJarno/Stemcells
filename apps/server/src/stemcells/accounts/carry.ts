import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

/**
 * Claude Code keeps a session at `<config>/projects/<cwd as a name>/<id>.jsonl`, its subagents in
 * `<id>/` beside it, and `--resume` reads only its own config folder. So before a session resumes
 * on another account, the newest copy of its transcript is brought into that account's folder.
 */

interface Found {
  readonly file: string;
  readonly modified: number;
}

const findTranscript = Effect.fn("Stemcells.findClaudeTranscript")(function* (
  folder: string,
  sessionId: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const projects = path.join(folder, "projects");
  const names = yield* fs.readDirectory(projects).pipe(Effect.orElseSucceed(() => []));
  let newest: Found | undefined;
  for (const name of names) {
    const file = path.join(projects, name, `${sessionId}.jsonl`);
    const info = yield* fs.stat(file).pipe(Effect.option);
    if (Option.isNone(info) || info.value.type !== "File") continue;
    const modified = Option.match(info.value.mtime, {
      onNone: () => 0,
      onSome: (date) => date.getTime(),
    });
    if (newest === undefined || modified > newest.modified) newest = { file, modified };
  }
  return newest;
});

/**
 * Copies the session's transcript into `target` when another folder holds a newer one, which
 * is also how a thread that went A, B and back to A gets B's turns.
 */
export const carryClaudeTranscript = Effect.fn("Stemcells.carryClaudeTranscript")(
  function* (input: {
    readonly sessionId: string;
    readonly target: string;
    readonly folders: ReadonlyArray<string>;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = path.resolve(input.target);
    const others = [...new Set(input.folders.map((folder) => path.resolve(folder)))].filter(
      (folder) => folder !== target,
    );
    if (others.length === 0) return false;

    let newest: Found | undefined;
    for (const folder of others) {
      const found = yield* findTranscript(folder, input.sessionId);
      if (found !== undefined && (newest === undefined || found.modified > newest.modified)) {
        newest = found;
      }
    }
    if (newest === undefined) return false;
    const here = yield* findTranscript(target, input.sessionId);
    if (here !== undefined && here.modified >= newest.modified) return false;

    const project =
      here === undefined
        ? path.join(target, "projects", path.basename(path.dirname(newest.file)))
        : path.dirname(here.file);
    yield* fs.makeDirectory(project, { recursive: true });
    const destination = path.join(project, `${input.sessionId}.jsonl`);
    // Claude Code may read the folder at any moment; it sees the old transcript or the whole new one.
    const partial = `${destination}.stemcells-carry`;
    yield* fs.copyFile(newest.file, partial);
    yield* fs.rename(partial, destination);
    const subagents = path.join(path.dirname(newest.file), input.sessionId);
    if (yield* fs.exists(subagents)) {
      yield* fs.copy(subagents, path.join(project, input.sessionId), { overwrite: true });
    }
    return true;
  },
);
