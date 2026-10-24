// Copies the tokens the original app's usage ledger kept, per transcript, hour and
// model, into Stemcells' usage history, where the Usage page counts the
// transcripts its own scan no longer finds (apps/server/src/stemcells/usageHistory).
// Prices come from the page's own rates, as for every other row. Run again
// whenever: the newest ledger replaces each transcript it names, and the rest
// stay. Reads the ledger only; writes only the history file.
//
//   node stemcells/scripts/import-usage-ledger.ts [--home-dir <folder>] [--ledger <file>]
//
// The home defaults to ~/.stemcells, the ledger to <ledger file>.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  fromLedger,
  HISTORY_FILE_NAME,
  mergeStores,
  parseStore,
} from "../../apps/server/src/stemcells/usageHistory/history.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const home = option("--home-dir") ?? NodePath.join(NodeOS.homedir(), ".stemcells");
const ledgerPath =
  option("--ledger") ?? NodePath.join(NodeOS.homedir(), "<ledger file>");
const target = NodePath.join(home, "userdata", "stemcells", HISTORY_FILE_NAME);

const incoming = fromLedger(JSON.parse(NodeFS.readFileSync(ledgerPath, "utf8")));
const existing = NodeFS.existsSync(target) ? parseStore(NodeFS.readFileSync(target, "utf8")) : null;
const store = mergeStores(existing, incoming);

NodeFS.mkdirSync(NodePath.dirname(target), { recursive: true });
const temporary = `${target}.${process.pid}.tmp`;
NodeFS.writeFileSync(temporary, JSON.stringify(store), { mode: 0o600 });
NodeFS.renameSync(temporary, target);

const tokens = Object.values(incoming.files).reduce(
  (sum, file) =>
    sum + file.rows.reduce((rowSum, row) => rowSum + row[2] + row[3] + row[4] + row[5], 0),
  0,
);
console.log(
  `${Object.keys(incoming.files).length} transcripts, ${(tokens / 1e9).toFixed(1)}B tokens from ${ledgerPath}` +
    ` -> ${target} (${Object.keys(store.files).length} transcripts kept)`,
);
