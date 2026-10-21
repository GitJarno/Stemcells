// @effect-diagnostics nodeBuiltinImport:off -- The test writes the windows' file as the app would find it.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { WindowBook } from "./book.ts";
import { readStoredFile } from "./storedFile.ts";

let dir: string;
let path: string;
const read = () => readStoredFile(path, WindowBook.understands, 1234);

beforeEach(() => {
  dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stored-file-"));
  path = NodePath.join(dir, "windows.json");
});

afterEach(() => {
  NodeFS.rmSync(dir, { recursive: true, force: true });
});

describe("readStoredFile", () => {
  it("starts empty when there is no file yet", () => {
    expect(read()).toEqual({ stored: null, unreadable: null });
  });

  it("reads a book the app wrote, and leaves the file where it is", () => {
    const book = new WindowBook().stored();
    NodeFS.writeFileSync(path, JSON.stringify(book));
    expect(read()).toEqual({ stored: book, unreadable: null });
    expect(NodeFS.existsSync(path)).toBe(true);
  });

  it("moves a corrupt file aside instead of letting the next save write over it", () => {
    NodeFS.writeFileSync(path, '{"version":1,"windows":[');
    expect(read()).toEqual({ stored: null, unreadable: { movedTo: `${path}.corrupt-1234` } });
    expect(NodeFS.existsSync(path)).toBe(false);
    expect(NodeFS.readFileSync(`${path}.corrupt-1234`, "utf8")).toBe('{"version":1,"windows":[');
  });

  it("moves aside a book of a version this app doesn't know", () => {
    NodeFS.writeFileSync(path, JSON.stringify({ version: 2, windows: [] }));
    expect(read().unreadable).toEqual({ movedTo: `${path}.corrupt-1234` });
    expect(NodeFS.existsSync(path)).toBe(false);
  });
});
