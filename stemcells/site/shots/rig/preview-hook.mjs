// Lab only, loaded with `node --import`: lets an ACP question carry an option's `preview`.
// The app draws previews (question-previews.md) and its Claude adapter carries them, but the
// ACP form the Replay provider speaks has no field for one. This reads it from the option's
// `_meta.preview` as the server loads its form parser; no file in the repository changes.
import * as NodeModule from "node:module";

const TARGET = "/packages/provider-acp/src/server/elicitationForm.ts";
const FROM = "? { label, description: text(option.description) ?? label, value: option.const }";
const TO =
  '? { label, description: text(option.description) ?? label, value: option.const, ...(typeof unknownRecord(option._meta)?.preview === "string" ? { preview: unknownRecord(option._meta).preview } : {}) }';

NodeModule.registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.endsWith(TARGET) || loaded.source == null) return loaded;
    const source = loaded.source.toString();
    if (!source.includes(FROM)) {
      process.stderr.write("preview-hook: the form parser changed; previews will not show\n");
      return loaded;
    }
    process.stderr.write("preview-hook: previews on\n");
    return { ...loaded, source: source.replace(FROM, TO) };
  },
});
