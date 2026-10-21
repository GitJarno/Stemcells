// @effect-diagnostics nodeBuiltinImport:off - reads Tiptap's build to pin how its editor is found.
/**
 * What the composer's ink relies on in upstream: how it finds the editor
 * and joins it, and how it reads the providers' models. A failure here
 * after a sync names the contract that moved; the composer likely inks
 * nothing, or reads the wrong model names.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";

import { REASONING_EFFORT_OPTION_IDS } from "@t3tools/client-runtime/state/thread-execution";
import type { ServerProvider } from "@t3tools/contracts";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vite-plus/test";

import composerEditor from "../../components/ComposerPromptEditorTiptap.tsx?raw";
import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import chatView from "../../components/ChatView.tsx?raw";
import { wordsCatalogOf } from "./words";

describe("the composer ink's contracts with upstream", () => {
  it("the editor's prompt is its document serialized, as the Cells beside it are sent", () => {
    expect(composerEditor).toMatch(
      /const handleEditorChange = \(updated: TiptapEditor\) => \{\s*const map = serializeEditorDoc\(updated\.state\.doc\);[\s\S]{0,400}const nextValue = map\.value;/,
    );
  });

  it("upstream's editor wears the class its composer is given", () => {
    // The substitute gives the editor a class of its own, and finds it by it.
    expect(composerEditor).toMatch(
      /const editorAttributes = \{\s*class: cn\(\s*"composer-tiptap[^"]*",\s*className,\s*\),/,
    );
  });

  it("Tiptap's editor element names its editor, which takes plugins after it starts", () => {
    const tiptap = NodeFS.readFileSync(
      NodeModule.createRequire(import.meta.url).resolve("@tiptap/core"),
      "utf8",
    );
    expect(tiptap).toContain("dom.editor = this");
    expect(typeof Editor.prototype.registerPlugin).toBe("function");
    expect(typeof Editor.prototype.unregisterPlugin).toBe("function");
  });

  it("names a model's effort levels by the option ids the ink reads", () => {
    expect(REASONING_EFFORT_OPTION_IDS).toEqual(
      expect.arrayContaining(["effort", "reasoningEffort"]),
    );
  });
});

// The words are read from the projects and the providers' models that
// upstream's composer reads too, in the same render. Upstream opens a new
// chat's composer only once its project is known, and sends only once a
// provider is, so Enter never sends words that weren't read: not on a cold
// start, a cached one, or with the projects in and the models still coming.
// If either gate moves, the words need a wait of their own before a send.
describe("Enter can't send before the words are read", () => {
  it("a new chat's composer takes no typing until its project is known", () => {
    expect(chatView).toMatch(
      /projectSelectionRequired=\{\s*isLocalDraftThread && activeProject === null\s*\}/,
    );
    expect(chatComposer).toMatch(
      /<ComposerPromptEditor\b[\s\S]{0,4000}?\bdisabled=\{\s*isConnecting \|\|\s*projectSelectionRequired \|\|/,
    );
  });

  it("a send waits for a provider to be known", () => {
    expect(chatComposer).toMatch(
      /const noProviderAvailable =\s*selectedProviderEntry === undefined && multipleModelSelections === null;/,
    );
    expect(chatComposer).toMatch(
      /const submitComposer = \([\s\S]{0,200}?\) => \{\s*if \(\s*noProviderAvailable \|\|/,
    );
  });
});

describe("the providers' models, as words", () => {
  const snapshot = (over: Partial<ServerProvider>): ServerProvider =>
    ({
      instanceId: "claudeAgent",
      driver: "claudeAgent",
      enabled: true,
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "authenticated" },
      checkedAt: "2026-10-21T00:00:00.000Z",
      models: [],
      slashCommands: [],
      skills: [],
      ...over,
    }) as unknown as ServerProvider;

  const effort = {
    id: "effort",
    label: "Effort",
    type: "select",
    options: [
      { id: "low", label: "Low" },
      { id: "high", label: "High" },
      { id: "max", label: "Max" },
    ],
  };

  it("reads each model's concise name and its effort levels", () => {
    const { catalog } = wordsCatalogOf([
      snapshot({
        models: [
          {
            slug: "claude-opus-5-5",
            name: "Claude Opus 5.5",
            isCustom: false,
            capabilities: { optionDescriptors: [effort] },
          },
        ] as never,
      }),
    ]);
    expect(catalog.providers[0]?.words).toEqual(["claude"]);
    expect(catalog.providers[0]?.models).toEqual([
      {
        id: "claude-opus-5-5",
        name: "Opus 5.5",
        efforts: ["low", "high", "max"],
        effortOption: "effort",
      },
    ]);
    expect(catalog.providers[0]?.defaultModel).toBe("claude-opus-5-5");
  });

  it("gives a provider's word to its first account only, and knows which can start a Cell", () => {
    const { catalog, ready } = wordsCatalogOf([
      snapshot({}),
      snapshot({ instanceId: "claude-work" as never, auth: { status: "unauthenticated" } }),
      snapshot({ instanceId: "codex" as never, driver: "codex" as never, enabled: false }),
    ]);
    expect(catalog.providers.map((p) => [p.id, p.words])).toEqual([
      ["claudeAgent", ["claude"]],
      ["claude-work", []],
    ]);
    expect([...ready]).toEqual(["claudeAgent"]);
  });
});
