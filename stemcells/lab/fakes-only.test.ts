// @effect-diagnostics nodeBuiltinImport:off - writes lab homes on disk and runs the lab's processes.
/**
 * A desktop lab runs fake provider CLIs only (fakes-only.cjs). A lab once
 * started a real `claude` on the person's plan: its settings named the
 * Claude instance `claude`, which is no driver, so the app made its default
 * `claudeAgent` instance, which runs the `claude` on the PATH.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

interface FakesOnly {
  DRIVERS: Record<string, { binary: string; byDefault: boolean }>;
  FAKE_MARK: string;
  SETTINGS: string[];
  strays(home: string): string[];
  homeRefusal(env: Record<string, string | undefined>): string | null;
}

const require_ = NodeModule.createRequire(import.meta.url);
const fakesOnly = require_("./fakes-only.cjs") as FakesOnly;
const repo = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) NodeFS.rmSync(folder, { recursive: true, force: true });
});

function folder(prefix: string): string {
  const made = NodeFS.realpathSync(NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), prefix)));
  folders.push(made);
  return made;
}

/** An executable at `path` that says what it is, and carries the lab's mark if `fake`. */
function program(path: string, fake: boolean): string {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  const mark = fake ? `# ${fakesOnly.FAKE_MARK}\n` : "";
  NodeFS.writeFileSync(path, `#!/bin/sh\n${mark}echo ran ${NodePath.basename(path)}\n`, {
    mode: 0o755,
  });
  return path;
}

/** A lab home with the fake `bin/fake` in it, and `settings` in the files named (`<home>` stands for it). */
function home(settings: Record<string, unknown>, files = fakesOnly.SETTINGS): string {
  const lab = folder("fakes-only-");
  program(NodePath.join(lab, "bin/fake"), true);
  for (const file of files) {
    NodeFS.mkdirSync(NodePath.dirname(NodePath.join(lab, file)), { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(lab, file),
      JSON.stringify(settings).replaceAll("<home>", lab),
    );
  }
  return lab;
}

/** Every driver at the lab's fake, by its own name and setting. */
const allFake = (): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fakesOnly.DRIVERS)
      .filter(([, { byDefault }]) => byDefault)
      .map(([driver, { binary }]) => [
        driver,
        { driver, enabled: false, config: { [binary]: "<home>/bin/fake" } },
      ]),
  );

/** The instances `strays` names in `file`, and why. */
const refused = (lab: string, file = "userdata/settings.json") =>
  fakesOnly
    .strays(lab)
    .filter((stray) => stray.startsWith(`${file}: `))
    .map((stray) => stray.slice(file.length + 2));

describe("a lab home", () => {
  it("passes with every driver at a fake inside it, in each settings file", () => {
    const lab = home({
      providerInstances: {
        ...allFake(),
        aski: { driver: "claudeAgent", config: { binaryPath: "<home>/bin/fake" } },
        local: {
          driver: "acpRegistry",
          config: { source: "local", commandPath: "<home>/bin/fake" },
        },
      },
    });
    expect(fakesOnly.strays(lab)).toEqual([]);
  });

  it("is refused when the Claude instance goes by a name that is no driver, as the lab that ran a real claude", () => {
    const { claudeAgent: _named, ...others } = allFake();
    const lab = home({
      providerInstances: {
        ...others,
        claude: { driver: "claude", config: { binaryPath: "<home>/bin/fake" } },
      },
    });
    expect(refused(lab)).toEqual([
      'claude: its driver "claude" is not one the lab knows',
      "claudeAgent: it names no binaryPath, so the app finds the real CLI on the PATH",
    ]);
  });

  it("is refused for a driver that is off but names no fake: a lab can turn it on", () => {
    const lab = home({ providerInstances: { ...allFake(), codex: { driver: "codex" } } });
    expect(refused(lab)).toEqual([
      "codex: it names no binaryPath, so the app finds the real CLI on the PATH",
    ]);
  });

  it("is refused for a settings file it lacks: the server it starts may read that one", () => {
    const lab = home({ providerInstances: allFake() }, ["userdata/settings.json"]);
    expect(refused(lab)).toEqual([]);
    expect(refused(lab, "dev/settings.json").length).toBeGreaterThan(0);
  });

  it("is refused for a settings file the server can't read, which sends it back to its defaults", () => {
    const lab = home({ providerInstances: [] });
    expect(fakesOnly.strays(lab)).toContain(
      "userdata/settings.json: the server can't read it, and would run its defaults",
    );
  });

  it("is refused for a binary outside it, however it is named", () => {
    const outside = folder("fakes-only-outside-");
    const lab = home({
      providerInstances: {
        ...allFake(),
        claudeAgent: { driver: "claudeAgent", config: { binaryPath: "claude" } },
        codex: { driver: "codex", config: { binaryPath: `${outside}/codex` } },
        grok: { driver: "grok", config: { binaryPath: "<home>/bin/../../grok" } },
        pi: { driver: "pi", config: { binaryPath: "<home>/bin/pi" } },
      },
    });
    // A link in the lab that leads out of it, to nothing yet.
    NodeFS.symlinkSync(`${outside}/pi`, NodePath.join(lab, "bin/pi"));
    expect(
      refused(lab)
        .map((stray) => stray.split(": ")[0])
        .toSorted(),
    ).toEqual(["claudeAgent", "codex", "grok", "pi"]);
  });

  it("is refused for a binary inside it that is no fake, as one the app downloads there", () => {
    const lab = home({
      providerInstances: {
        ...allFake(),
        antigravity: {
          driver: "antigravity",
          config: { binaryPath: "<home>/tools/antigravity-acp/agy_acp_server.par" },
        },
      },
    });
    program(NodePath.join(lab, "tools/antigravity-acp/agy_acp_server.par"), false);
    expect(refused(lab)).toEqual([
      `antigravity: its binaryPath ${lab}/tools/antigravity-acp/agy_acp_server.par is no lab fake (no "stemcells-lab-fake" in its first 4 KB)`,
    ]);
  });

  it("is refused for a driver pointed at a server by address", () => {
    const lab = home({
      providerInstances: {
        ...allFake(),
        opencode: {
          driver: "opencode",
          config: { binaryPath: "<home>/bin/fake", serverUrl: "http://127.0.0.1:4096" },
        },
        cursor: {
          driver: "cursor",
          config: { binaryPath: "<home>/bin/fake", apiEndpoint: "https://api.example.com" },
        },
      },
    });
    expect(refused(lab)).toEqual([
      "cursor: its apiEndpoint points it at https://api.example.com, a server outside the lab",
      "opencode: its serverUrl points it at http://127.0.0.1:4096, a server outside the lab",
    ]);
  });

  it("is refused for a Codex the app installs, or an agent from the ACP registry", () => {
    const lab = home({
      providerInstances: {
        ...allFake(),
        codex: { driver: "codex", config: { setupMode: "managed", binaryPath: "<home>/bin/fake" } },
        registry: { driver: "acpRegistry", config: { agentId: "some-agent" } },
      },
    });
    expect(refused(lab)).toEqual([
      "codex: it runs the Codex the app installs (setupMode managed)",
      "registry: it runs an agent from the ACP registry (source is not local)",
    ]);
  });

  it("reads the legacy providers.<driver> entries the server turns into instances", () => {
    const lab = home({
      providerInstances: allFake(),
      providers: {
        // An instance of this name exists, so the server leaves the entry be.
        codex: { binaryPath: "/usr/local/bin/codex" },
        // None does, so the server makes one of it.
        acpRegistry: { agentId: "some-agent" },
      },
    });
    expect(refused(lab)).toEqual([
      "acpRegistry: it runs an agent from the ACP registry (source is not local)",
    ]);
  });

  it("knows every driver upstream builds in", () => {
    const source = NodeFS.readFileSync(
      NodePath.join(repo, "apps/server/src/provider/builtInDrivers.ts"),
      "utf8",
    );
    const list = /BUILT_IN_DRIVERS[^=]*=\s*\[([^\]]*)\]/.exec(source)![1]!;
    const named = list.match(/\w+Driver\b/g)!.map((name) => name.replace(/Driver$/, ""));
    // Upstream's names for the drivers whose kind differs from their module's.
    const kinds: Record<string, string> = { Claude: "claudeAgent", AcpRegistry: "acpRegistry" };
    const known = named.map((name) => kinds[name] ?? name.toLowerCase());
    expect(known.toSorted()).toEqual(Object.keys(fakesOnly.DRIVERS).toSorted());
  });
});

describe("the home Electron's main was given", () => {
  it("is refused when unset: the app would run on the person's own home", () => {
    expect(fakesOnly.homeRefusal({})).toMatch(/^no T3CODE_HOME/);
    expect(fakesOnly.homeRefusal({ T3CODE_HOME: "lab" })).toMatch(/not an absolute path/);
  });

  it("is refused when it isn't the home the lab checked", () => {
    const checked = home({ providerInstances: allFake() });
    const other = home({ providerInstances: allFake() });
    expect(fakesOnly.homeRefusal({ T3CODE_HOME: other, STEMCELLS_LAB_HOME: checked })).toBe(
      `the app was given home ${other}, not ${checked}, the one the lab checked`,
    );
  });

  it("passes the home checked, however it is reached, once every provider in it is a fake", () => {
    const checked = home({ providerInstances: allFake() });
    const link = NodePath.join(folder("fakes-only-link-"), "home");
    NodeFS.symlinkSync(checked, link);
    expect(fakesOnly.homeRefusal({ T3CODE_HOME: ` ${link} `, STEMCELLS_LAB_HOME: checked })).toBe(
      null,
    );
    const stray = home({ providerInstances: {} });
    expect(fakesOnly.homeRefusal({ T3CODE_HOME: stray, STEMCELLS_LAB_HOME: stray })).toMatch(
      /could start a real CLI/,
    );
  });

  it("stops Electron's main before the app's code runs, and tells the launcher", () => {
    const profile = folder("stemcells-lab-test-");
    const helper = require_.resolve("./never-shown.cjs");
    const { NODE_OPTIONS: _, ...env } = process.env;
    const run = NodeChildProcess.spawnSync(
      process.execPath,
      [
        "-e",
        [
          `process.versions.electron = "44.0.0";`,
          `process.type = "browser";`,
          `require(${JSON.stringify(helper)});`,
          `process.stdout.write("the app's code ran");`,
        ].join("\n"),
      ],
      { env: { ...env, STEMCELLS_LAB_PROFILE: profile, T3CODE_HOME: "" }, encoding: "utf8" },
    );
    expect(run.status).toBe(86);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("STOPPED: no T3CODE_HOME");
    expect(NodeFS.readdirSync(profile).filter((name) => name.startsWith(".refused-"))).toHaveLength(
      1,
    );
  });
});

describe("a provider CLI in a lab's processes", () => {
  /**
   * Runs `body` in a lab process (Electron run as Node, under the helper),
   * with `bin` first on a PATH of the system's own folders, for a person
   * whose home is `person` (a fresh one if not given).
   */
  const inLab = (
    bin: string,
    body: string,
    module = false,
    person = folder("fakes-only-person-"),
    extra: Record<string, string> = {},
  ) => {
    const profile = folder("stemcells-lab-test-");
    const helper = require_.resolve("./never-shown.cjs");
    const { NODE_OPTIONS: _, ...env } = process.env;
    const preload = NodePath.join(profile, "electron.cjs");
    NodeFS.writeFileSync(
      preload,
      `process.versions.electron = "44.0.0";\nrequire(${JSON.stringify(helper)});\n`,
    );
    const script = NodePath.join(profile, module ? "body.mjs" : "body.cjs");
    NodeFS.writeFileSync(script, body);
    return NodeChildProcess.spawnSync(process.execPath, ["--require", preload, script], {
      env: {
        ...env,
        HOME: person,
        STEMCELLS_LAB_PROFILE: profile,
        PATH: `${bin}:/usr/bin:/bin`,
        ...extra,
      },
      encoding: "utf8",
    });
  };
  const bin = () => {
    const made = folder("fakes-only-bin-");
    program(NodePath.join(made, "claude"), false);
    program(NodePath.join(made, "codex"), true);
    return made;
  };
  /** The exit status of each spawnSync in a lab process: `[program, args]` pairs. */
  const statuses = (path: string, runs: [string, string[]][], person?: string) => {
    const run = inLab(
      path,
      `const { spawnSync } = require("node:child_process");
      const runs = ${JSON.stringify(runs)};
      process.stdout.write(JSON.stringify(runs.map(([file, args]) => {
        const result = spawnSync(file, args, { encoding: "utf8" });
        return result.status === 0 ? result.stdout.trim() : result.status;
      })));`,
      false,
      person,
    );
    return JSON.parse(run.stdout) as (number | string)[];
  };

  it("never starts one that isn't a fake, however it is asked for, and starts a fake", () => {
    const run = inLab(
      bin(),
      `
      const ChildProcess = require("node:child_process");
      const { promisify } = require("node:util");
      const status = (result) => result.status;
      const out = [];
      out.push(["spawnSync", status(ChildProcess.spawnSync("claude", ["--version"]))]);
      out.push(["through a shell", status(ChildProcess.spawnSync("sh", ["-c", "FOO=1 claude -p hi"]))]);
      out.push(["shell: true", status(ChildProcess.spawnSync("claude --version", { shell: true }))]);
      try { ChildProcess.execSync("cd / && claude", { stdio: "pipe" }); out.push(["execSync", 0]); }
      catch (error) { out.push(["execSync", error.status]); }
      out.push(["a fake", ChildProcess.execFileSync("codex", { encoding: "utf8" }).trim()]);
      out.push(["a word in arguments", ChildProcess.execFileSync("echo", ["claude"], { encoding: "utf8" }).trim()]);
      promisify(ChildProcess.execFile)("claude").then(
        () => out.push(["promisify", 0]),
        (error) => out.push(["promisify", error.code, error.stderr.trim()]),
      ).then(() => process.stdout.write(JSON.stringify(out)));
      `,
    );
    const out = JSON.parse(run.stdout) as unknown[][];
    expect(out.slice(0, 4)).toEqual([
      ["spawnSync", 127],
      ["through a shell", 127],
      ["shell: true", 127],
      ["execSync", 127],
    ]);
    expect(out[4]).toEqual(["a fake", "ran codex"]);
    expect(out[5]).toEqual(["a word in arguments", "claude"]);
    expect(out[6]![0]).toBe("promisify");
    expect(out[6]![1]).toBe(127);
    expect(String(out[6]![2])).toMatch(/^stemcells lab: refused to start .*\/claude$/);
    expect(run.stderr).toContain("refused to start");
  });

  it("the same for a module that imports child_process by name, as the app's server does", () => {
    const run = inLab(
      bin(),
      `import { spawnSync } from "node:child_process";
      process.stdout.write(String(spawnSync("claude").status));`,
      true,
    );
    expect(run.stdout).toBe("127");
  });

  it("never starts a real one under another file name, as the version a link leads to", () => {
    // ~/.local/bin/claude -> ~/.local/share/claude/versions/2.1.306, off the PATH.
    const person = folder("fakes-only-person-");
    const version = program(NodePath.join(person, ".local/share/claude/versions/2.1.306"), false);
    NodeFS.mkdirSync(NodePath.join(person, ".local/bin"), { recursive: true });
    NodeFS.symlinkSync(version, NodePath.join(person, ".local/bin/claude"));
    // An npm codex on a PATH folder, its script under node.
    const npm = folder("fakes-only-npm-");
    const script = program(
      NodePath.join(npm, "lib/node_modules/@openai/codex/bin/codex.js"),
      false,
    );
    NodeFS.mkdirSync(NodePath.join(npm, "bin"));
    NodeFS.symlinkSync(script, NodePath.join(npm, "bin/codex"));
    const claudeCode = program(
      NodePath.join(npm, "lib/node_modules/@anthropic-ai/claude-code/cli.js"),
      false,
    );
    expect(
      statuses(
        `${NodePath.join(npm, "bin")}`,
        [
          [version, ["--version"]],
          [program(NodePath.join(person, ".local/share/claude/versions/2.1.305"), false), []],
          [script, []],
          [process.execPath, [claudeCode]],
          ["node", [claudeCode]],
        ],
        person,
      ),
    ).toEqual([127, 127, 127, 127, 127]);
  });

  it("knows one by its name in any case, and through wrappers", () => {
    const made = bin();
    // Off the PATH, so known by its name alone.
    const capital = program(NodePath.join(folder("fakes-only-elsewhere-"), "Claude"), false);
    expect(
      statuses(made, [
        [capital, []],
        ["nice", ["-n", "5", "claude"]],
        ["env", ["FOO=1", "claude", "-p", "hi"]],
        ["/usr/bin/time", ["claude"]],
        ["arch", ["-arm64", "claude"]],
        ["env", ["nice", "claude"]],
        ["env", ["codex"]],
      ]),
    ).toEqual([127, 127, 127, 127, 127, 127, "ran codex"]);
  });

  it("never forks a provider's script", () => {
    const npm = folder("fakes-only-npm-");
    const cli = program(NodePath.join(npm, "node_modules/@anthropic-ai/claude-code/cli.js"), false);
    const run = inLab(
      bin(),
      `require("node:child_process").fork(${JSON.stringify(cli)}, [], { stdio: "pipe" })
        .on("exit", (code) => process.stdout.write(String(code)));`,
    );
    expect(run.stdout).toBe("127");
  });

  it("finds the lab's fakes first on the PATH, as the in-app terminal does", () => {
    const lab = home({ providerInstances: allFake() });
    const run = inLab(
      bin(),
      `process.stdout.write(process.env.PATH.split(":")[0]);`,
      false,
      undefined,
      { STEMCELLS_LAB_HOME: lab },
    );
    expect(run.stdout).toBe(NodePath.join(lab, "bin"));
  });
});

describe("the check as a program", () => {
  it("refuses a stray home when the lab's helper is loaded first, as in a lab's own shell", () => {
    const stray = home({ providerInstances: {} });
    const profile = folder("stemcells-lab-test-");
    const { NODE_OPTIONS: _, ...env } = process.env;
    const run = NodeChildProcess.spawnSync(
      process.execPath,
      [
        "--require",
        require_.resolve("./never-shown.cjs"),
        require_.resolve("./fakes-only.cjs"),
        stray,
      ],
      { env: { ...env, STEMCELLS_LAB_PROFILE: profile }, encoding: "utf8" },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("refused");
  });
});

describe("the lab launcher", () => {
  const launch = (args: string[], env: Record<string, string> = {}) =>
    NodeChildProcess.spawnSync(NodePath.join(repo, "stemcells/lab/electron"), args, {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, T3CODE_HOME: "", ...env },
    });

  it("refuses a dev lab without a home of its own, with two, or with one after --", () => {
    const lab = home({ providerInstances: allFake() });
    const runs = [
      launch(["dev"]),
      launch(["dev", "--home-dir", lab, `--home-dir=${lab}`]),
      launch(["dev", "--home-dir", lab, "--", "--home-dir", lab]),
    ];
    expect(runs.map((run) => run.status)).toEqual([1, 1, 1]);
    expect(runs[0]!.stderr).toContain("dev --home-dir <folder>");
    expect(runs[1]!.stderr).toContain("give --home-dir once");
    expect(runs[2]!.stderr).toContain("--home-dir after --");
  });

  it("refuses a scratch app without a home of its own", () => {
    const run = launch(["main.cjs"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("T3CODE_HOME=<folder>");
  });

  it("refuses a home whose providers could start a real CLI, before anything starts", () => {
    const lab = home({ providerInstances: { claudeAgent: { driver: "claudeAgent" } } });
    for (const run of [
      launch(["dev", "--home-dir", lab]),
      launch(["main.cjs"], { T3CODE_HOME: lab }),
    ]) {
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("claudeAgent: it names no binaryPath");
    }
    expect(NodeFS.readdirSync(lab).toSorted()).toEqual(["bin", "dev", "userdata"]);
  });
});
