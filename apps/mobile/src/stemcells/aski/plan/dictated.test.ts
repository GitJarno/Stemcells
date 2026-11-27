import { describe, expect, it } from "vite-plus/test";

import { clearDictated, dictationStep, NOT_DICTATING, wasDictated } from "./dictated";

describe("a draft speech put words into", () => {
  it("is marked once the dictation ends with the draft changed, until it is sent", () => {
    const drafts = new Map([["aski", "start two agents"]]);
    const textOf = (owner: string) => drafts.get(owner) ?? "";
    let watch = dictationStep(NOT_DICTATING, { owner: "aski", busy: true }, textOf);
    // Still transcribing: nothing is marked yet.
    watch = dictationStep(watch, { owner: "aski", busy: true }, textOf);
    expect(wasDictated("aski")).toBe(false);
    drafts.set("aski", "start two agents one for the header");
    watch = dictationStep(watch, { owner: "aski", busy: false }, textOf);
    expect(watch).toBe(NOT_DICTATING);
    expect(wasDictated("aski")).toBe(true);
    clearDictated("aski");
    expect(wasDictated("aski")).toBe(false);
  });

  it("isn't marked by a dictation cancelled before it wrote anything", () => {
    const textOf = () => "typed words";
    const watch = dictationStep(NOT_DICTATING, { owner: "other", busy: true }, textOf);
    dictationStep(watch, { owner: "other", busy: false }, textOf);
    expect(wasDictated("other")).toBe(false);
  });
});
