// A desktop lab runs fake provider CLIs only: a real `claude` or `codex` would spend the
// person's plan and could work on their files. Each provider in the lab's home names a fake
// inside it by its driver's own setting and reaches no server by address. Three checks: the
// launcher runs this on the home, `homeRefusal` in Electron's main, `guardSpawns` everywhere.
"use strict";

const NodeFS = require("node:fs");
const NodePath = require("node:path");

/**
 * What a lab's fake CLI carries in its first 4 KB; a path inside the home isn't enough, as the
 * app downloads some CLIs there. The lab trusts the mark, so a fake must never run a real CLI.
 */
const FAKE_MARK = "stemcells-lab-fake";

/**
 * Upstream's built-in drivers (apps/server/src/provider/builtInDrivers.ts):
 * the setting that names each one's CLI, and whether the app makes it an
 * instance of its own, under the driver's name, when the settings have none.
 */
const DRIVERS = {
  codex: { binary: "binaryPath", byDefault: true },
  claudeAgent: { binary: "binaryPath", byDefault: true },
  cursor: { binary: "binaryPath", byDefault: true },
  grok: { binary: "binaryPath", byDefault: true },
  opencode: { binary: "binaryPath", byDefault: true },
  antigravity: { binary: "binaryPath", byDefault: true },
  pi: { binary: "binaryPath", byDefault: true },
  muse: { binary: "binaryPath", byDefault: true },
  acpRegistry: { binary: "commandPath", byDefault: false },
};

/** A driver setting that points it at a server by address (OpenCode's `serverUrl`, Cursor's `apiEndpoint`). */
const ADDRESS = /(?:url|endpoint)$/i;

/**
 * The names provider CLIs run by, Antigravity's downloaded server among
 * them: one of these starts in a lab only if it is a fake.
 */
const PROVIDER_CLIS = new Set([
  "claude",
  "codex",
  "cursor-agent",
  "agent",
  "grok",
  "opencode",
  "pi",
  "muse",
  "gemini",
  "agy_acp_server.par",
  "localharness_external",
]);

/** Programs that run the command line they are given: a provider CLI may hide in its words. */
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);

/** Programs that start the program they are given, after their own options. */
const WRAPPERS = new Set(["env", "nice", "nohup", "arch", "time", "caffeinate", "timeout"]);

/** Programs that run the script they are given: a provider CLI may be one. */
const RUNTIMES = new Set(["node", "nodejs", "bun", "deno"]);

/** Packages that are a provider CLI, whose scripts run under a runtime. */
const PROVIDER_PACKAGES = [
  "@anthropic-ai/claude-code",
  "@anthropic-ai/claude-agent-sdk",
  "@openai/codex",
  "@google/gemini-cli",
  "opencode-ai",
];

/** Where provider CLIs install themselves under the person's home, besides the PATH. */
const INSTALLS = [".local/share/claude", ".local/share/cursor-agent", ".claude/local", ".opencode"];

/** Folders provider CLIs are put in, besides the PATH (`~` is the person's home). */
const BIN_FOLDERS = [
  "~/.local/bin",
  "~/.bun/bin",
  "~/.npm-global/bin",
  "~/.volta/bin",
  "~/.opencode/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

/** The settings files the server reads in a home: `dev/` when it runs with a dev server and no home of its own, else `userdata/`. */
const SETTINGS = ["dev/settings.json", "userdata/settings.json"];

const inside = (folder, path) => path === folder || path.startsWith(folder + NodePath.sep);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Where `path` leads once every link is followed, a link to nothing included, in the file system's own case. */
function resolved(path, links = 0) {
  try {
    return NodeFS.realpathSync.native(path);
  } catch {
    // Not there, or a link to something not there: where it leads still counts.
    if (links < 40 && NodeFS.lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
      const target = NodePath.resolve(NodePath.dirname(path), NodeFS.readlinkSync(path));
      return resolved(target, links + 1);
    }
    const parent = NodePath.dirname(path);
    return parent === path ? path : NodePath.join(resolved(parent, links), NodePath.basename(path));
  }
}

/** Whether `path` is a lab's fake: a file with FAKE_MARK in its first 4 KB. */
function isFake(path) {
  let handle;
  try {
    handle = NodeFS.openSync(path, "r");
    const head = Buffer.alloc(4096);
    const read = NodeFS.readSync(handle, head, 0, head.length, 0);
    return head.subarray(0, read).includes(FAKE_MARK);
  } catch {
    return false;
  } finally {
    if (handle !== undefined) NodeFS.closeSync(handle);
  }
}

/** Why `instance` could start a real CLI or reach a server, or null. */
function stray(instance, folder) {
  if (!isRecord(instance)) return "it is not an object, so the server can't read the settings";
  const driver = DRIVERS[instance.driver];
  if (driver === undefined) {
    return `its driver ${JSON.stringify(instance.driver)} is not one the lab knows`;
  }
  const config = instance.config ?? {};
  if (!isRecord(config))
    return "its config is not an object, so the server can't read the settings";
  for (const [key, value] of Object.entries(config)) {
    if (ADDRESS.test(key) && typeof value === "string" && value.trim() !== "") {
      return `its ${key} points it at ${value}, a server outside the lab`;
    }
  }
  if (instance.driver === "codex" && config.setupMode === "managed") {
    return "it runs the Codex the app installs (setupMode managed)";
  }
  if (instance.driver === "acpRegistry" && config.source !== "local") {
    return "it runs an agent from the ACP registry (source is not local)";
  }
  const binary = config[driver.binary];
  if (typeof binary !== "string" || binary.trim() === "") {
    return `it names no ${driver.binary}, so the app finds the real CLI on the PATH`;
  }
  if (!NodePath.isAbsolute(binary)) return `its ${driver.binary} ${binary} is found on the PATH`;
  const real = resolved(binary);
  if (!inside(folder, real))
    return `its ${driver.binary} ${binary} leads to ${real}, outside the lab`;
  if (!isFake(real)) {
    return `its ${driver.binary} ${binary} is no lab fake (no "${FAKE_MARK}" in its first 4 KB)`;
  }
  return null;
}

/**
 * The provider instances the server makes from `settings`: its instances;
 * then one for each legacy `providers.<driver>` entry under a name no
 * instance has (apps/server/src/serverSettings.ts,
 * migrateLegacyProviderSettings); then each driver's default instance.
 */
function instancesOf(settings) {
  const instances = { ...settings.providerInstances };
  for (const [driver, blob] of Object.entries(
    isRecord(settings.providers) ? settings.providers : {},
  )) {
    if (!isRecord(blob) || Object.hasOwn(instances, driver)) continue;
    const { enabled: _enabled, ...config } = blob;
    instances[driver] = { driver, config };
  }
  for (const [driver, { byDefault }] of Object.entries(DRIVERS)) {
    if (byDefault && !Object.hasOwn(instances, driver)) instances[driver] = { driver };
  }
  return instances;
}

/**
 * Each provider instance in `home` that could start a real CLI or reach a
 * server, and why. `home` is read as the dev runner reads `--home-dir`:
 * trimmed, from the working folder.
 */
function strays(home) {
  const folder = resolved(NodePath.resolve(home.trim()));
  const found = [];
  for (const file of SETTINGS) {
    const path = NodePath.join(folder, file);
    let settings = {};
    if (NodeFS.existsSync(path)) {
      try {
        settings = JSON.parse(NodeFS.readFileSync(path, "utf8"));
      } catch (error) {
        found.push(`${file}: can't be read (${error.message})`);
        continue;
      }
    }
    if (!isRecord(settings) || !isRecord(settings.providerInstances ?? {})) {
      found.push(`${file}: the server can't read it, and would run its defaults`);
      continue;
    }
    for (const [id, instance] of Object.entries(instancesOf(settings))) {
      const why = stray(instance, folder);
      if (why !== null) found.push(`${file}: ${id}: ${why}`);
    }
  }
  return found;
}

/**
 * Why Electron's main, with `env`, mustn't run, or null: the home it was
 * given (`T3CODE_HOME`, which the app uses and hands its server) is unset,
 * so the app would run on the person's own; it isn't the home the launcher
 * checked (`STEMCELLS_LAB_HOME`); or a provider in it could start a real CLI.
 */
function homeRefusal(env) {
  const home = env.T3CODE_HOME?.trim() ?? "";
  if (home === "") return "no T3CODE_HOME: the app would run on the person's own home";
  if (!NodePath.isAbsolute(home)) return `T3CODE_HOME ${home} is not an absolute path`;
  const checked = env.STEMCELLS_LAB_HOME?.trim() ?? "";
  if (checked !== "" && resolved(home) !== resolved(checked)) {
    return `the app was given home ${home}, not ${checked}, the one the lab checked`;
  }
  const found = strays(home);
  return found.length === 0
    ? null
    : `a provider in ${home} could start a real CLI:\n${found.map((line) => `  ${line}`).join("\n")}`;
}

/** The words of a command line, unquoted (quoting tricks are out of reach). */
const words = (line) => line.split(/[\s;|&()`'"<>]+/).filter(Boolean);

/** Where the program `command` runs from, or null if it isn't there. */
function locate(command, options) {
  const env = options?.env ?? process.env;
  if (command.includes("/")) {
    const path = NodePath.resolve(String(options?.cwd ?? process.cwd()), command);
    return NodeFS.existsSync(path) ? path : null;
  }
  for (const folder of String(env.PATH ?? "").split(NodePath.delimiter)) {
    const path = NodePath.join(folder, command);
    if (folder !== "" && NodeFS.statSync(path, { throwIfNoEntry: false })?.isFile()) return path;
  }
  return null;
}

/**
 * The real provider CLIs on this Mac, as their files: each provider name on
 * the PATH and in the usual bin folders, followed to the file it leads to,
 * and the folders they install into (one holding a `versions` folder, a
 * package's). Read once, as the guard goes in.
 */
function installedClis(env) {
  const home = require("node:os").homedir();
  const files = new Set();
  const roots = INSTALLS.map((folder) => resolved(NodePath.join(home, folder)));
  const folders = [
    ...String(env.PATH ?? "").split(NodePath.delimiter),
    ...BIN_FOLDERS.map((folder) => folder.replace(/^~(?=\/)/, home)),
  ];
  for (const folder of folders.filter(Boolean)) {
    for (const name of PROVIDER_CLIS) {
      const path = NodePath.join(folder, name);
      if (!NodeFS.existsSync(path)) continue;
      const real = resolved(path);
      if (isFake(real)) continue;
      files.add(real);
      if (NodePath.basename(NodePath.dirname(real)) === "versions")
        roots.push(NodePath.dirname(real));
    }
  }
  return { files, roots };
}

/** Whether `path` is a real provider CLI: its name or its file's is one's, or its file is one of `installed`, or lies in one of their installs. */
function isRealCli(path, installed) {
  const real = resolved(path);
  const named =
    PROVIDER_CLIS.has(NodePath.basename(path).toLowerCase()) ||
    PROVIDER_CLIS.has(NodePath.basename(real).toLowerCase()) ||
    installed.files.has(real) ||
    installed.roots.some((root) => inside(root, real)) ||
    PROVIDER_PACKAGES.some((name) =>
      real.includes(`${NodePath.sep}node_modules${NodePath.sep}${name}${NodePath.sep}`),
    );
  return named && !isFake(real);
}

/**
 * The real provider CLI that `program` with `args` would start, or null.
 * Looked through: a shell's words, or a command line run through one
 * (`shell`); a wrapper's program (`env`, `nice`, `time`, ...); a runtime's
 * script (`node`, or Electron run as Node).
 */
function realCli(program, args, options, shell, installed) {
  if (shell) {
    for (const word of [program, ...args].flatMap((part) => words(String(part)))) {
      const path = locate(word, options);
      if (path !== null && isRealCli(path, installed)) return path;
    }
    return null;
  }
  const path = locate(program, options);
  if (path !== null && isRealCli(path, installed)) return path;
  const name = NodePath.basename(program).toLowerCase();
  if (SHELLS.has(name)) return realCli(program, args, options, true, installed);
  const rest = args.map(String);
  if (WRAPPERS.has(name)) {
    for (const [i, arg] of rest.entries()) {
      if (arg.startsWith("-")) continue;
      const found = realCli(arg, rest.slice(i + 1), options, false, installed);
      if (found !== null) return found;
    }
    return null;
  }
  const runtime =
    RUNTIMES.has(name) || (path !== null && resolved(path) === resolved(process.execPath));
  if (runtime) {
    const cwd = String(options?.cwd ?? process.cwd());
    for (const arg of rest.filter((arg) => !arg.startsWith("-"))) {
      const script = NodePath.resolve(cwd, arg);
      if (NodeFS.existsSync(script) && isRealCli(script, installed)) return script;
    }
  }
  return null;
}

/**
 * From here on, `child_process` starts no real provider CLI (ES module imports included): it
 * runs one that says so and exits 127, as a missing program would, and `log` is told. It can't
 * see a CLI hidden in a quoted `sh -c` script, or what's typed in the in-app terminal.
 */
function guardSpawns(log) {
  const ChildProcess = require("node:child_process");
  const { promisify } = require("node:util");
  const guarded = Symbol.for("stemcells.lab.spawns");
  if (ChildProcess[guarded]) return;
  ChildProcess[guarded] = true;
  const installed = installedClis(process.env);
  const refusal = (path) => {
    log(`[stemcells lab] refused to start ${path}: a provider CLI that is no lab fake`);
    return `echo 'stemcells lab: refused to start ${path.replaceAll("'", "")}' >&2; exit 127`;
  };
  // spawn, spawnSync, execFile, execFileSync: (file, args?, options?, ...).
  for (const name of ["spawn", "spawnSync", "execFile", "execFileSync"]) {
    const original = ChildProcess[name];
    ChildProcess[name] = function (file, ...rest) {
      const args = Array.isArray(rest[0]) ? rest[0] : [];
      const options = Array.isArray(rest[0]) ? rest[1] : rest[0];
      const options_ = isRecord(options) ? options : undefined;
      const path =
        typeof file === "string"
          ? realCli(file, args, options_, Boolean(options_?.shell), installed)
          : null;
      if (path === null) return original.call(this, file, ...rest);
      const tail = Array.isArray(rest[0]) ? rest.slice(1) : rest;
      const kept = isRecord(tail[0]) ? [{ ...tail[0], shell: false }, ...tail.slice(1)] : tail;
      return original.call(this, "/bin/sh", ["-c", refusal(path)], ...kept);
    };
  }
  // exec, execSync: (command line, options?, ...), run by a shell.
  for (const name of ["exec", "execSync"]) {
    const original = ChildProcess[name];
    ChildProcess[name] = function (line, ...rest) {
      const options = isRecord(rest[0]) ? rest[0] : undefined;
      const path = typeof line === "string" ? realCli(line, [], options, true, installed) : null;
      return path === null
        ? original.call(this, line, ...rest)
        : original.call(this, refusal(path), ...rest);
    };
  }
  // fork: (module, args?, options?), a script under this runtime.
  const fork = ChildProcess.fork;
  ChildProcess.fork = function (module, ...rest) {
    const options = Array.isArray(rest[0]) ? rest[1] : rest[0];
    const cwd = String((isRecord(options) && options.cwd) || process.cwd());
    const script = typeof module === "string" ? NodePath.resolve(cwd, module) : null;
    if (script === null || !NodeFS.existsSync(script) || !isRealCli(script, installed)) {
      return fork.call(this, module, ...rest);
    }
    refusal(script);
    return fork.call(this, __filename, ["--refused", script], isRecord(options) ? options : {});
  };
  // `promisify(exec)` and `promisify(execFile)` resolve to { stdout, stderr }, through the guard.
  for (const name of ["exec", "execFile"]) {
    const run = ChildProcess[name];
    run[promisify.custom] = function (...args) {
      let child;
      const done = new Promise((resolve, reject) => {
        child = run.call(this, ...args, (error, stdout, stderr) =>
          error ? reject(Object.assign(error, { stdout, stderr })) : resolve({ stdout, stderr }),
        );
      });
      done.child = child;
      return done;
    };
  }
  require("node:module").syncBuiltinESMExports();
}

/**
 * Puts the lab's fakes (`<home>/bin`) first on `env.PATH`, so a CLI asked
 * for by name, the in-app terminal's among them, finds the fake first.
 */
function fakesFirst(env) {
  const home = env.STEMCELLS_LAB_HOME?.trim();
  if (!home) return;
  const bin = NodePath.join(home, "bin");
  if (!NodeFS.statSync(bin, { throwIfNoEntry: false })?.isDirectory()) return;
  const rest = String(env.PATH ?? "")
    .split(NodePath.delimiter)
    .filter((folder) => folder !== "" && folder !== bin);
  env.PATH = [bin, ...rest].join(NodePath.delimiter);
}

module.exports = {
  DRIVERS,
  FAKE_MARK,
  PROVIDER_CLIS,
  SETTINGS,
  fakesFirst,
  guardSpawns,
  homeRefusal,
  isFake,
  strays,
};

// Run as a program. Checked by the script named, not `require.main`: in a
// lab's own processes the helper has loaded this file before the program
// starts, so it never runs as the main module.
if (process.argv[1] !== undefined && resolved(process.argv[1]) === resolved(__filename)) {
  if (process.argv[2] === "--refused") {
    // What a refused `fork` runs instead.
    process.stderr.write(`stemcells lab: refused to start ${process.argv[3]}\n`);
    process.exit(127);
  }
  const home = process.argv[2];
  if (!home) {
    process.stderr.write("usage: node stemcells/lab/fakes-only.cjs <home>\n");
    process.exit(2);
  }
  const found = strays(home);
  if (found.length > 0) {
    process.stderr.write(
      `stemcells/lab: refused: a provider could start a real CLI or reach a server. Point every driver at a fake inside ${home}:\n` +
        found.map((line) => `  ${line}\n`).join(""),
    );
    process.exit(1);
  }
}
