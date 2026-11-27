// Scores Aski's compiler on a corpus with a real model answering (aski-orchestrator.md,
// decision 14). It spends the person's plan: run it by hand, never in a gate.
//   node stemcells/scripts/aski-eval.ts --model haiku [--strong sonnet] [--effort low]
//        [--cases <file>] [--only <words in a case's name>] [--jobs 4] [--out report.json]

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { floorPlan, planOf } from "../orchestrator/check.ts";
import { said } from "../orchestrator/names.ts";
import { piecesOf } from "../orchestrator/pieces.ts";
import type { CompileContext, Plan, StartAct } from "../orchestrator/plan.ts";
import { compilerPrompt } from "../orchestrator/prompt.ts";

interface WantCell {
  /** Words its message must hold; this is how a Cell of the plan is matched to it. */
  readonly says: string;
  /** A project's name, "new:Name" for one to make, or "*" for any or none. */
  readonly place: string;
  readonly model: string | null;
  readonly effort: string | null;
  /** "*" for either. */
  readonly tier: "start" | "check" | "*";
  /** Words that must not reach this Cell: another project's task. */
  readonly not?: string;
  /** Words that must reach it too: an instruction for all. */
  readonly also?: string;
}
interface Case {
  readonly name: string;
  readonly text: string;
  readonly dictated: boolean;
  readonly cells: readonly WantCell[];
  readonly holds?: ReadonlyArray<{
    readonly target: "project" | "cells";
    readonly place?: string;
    readonly cells?: readonly string[];
  }>;
  /** Words that must be left as talk. */
  readonly talk?: string;
}

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const model = args.get("model") ?? "haiku";
const strong = args.get("strong") ?? model;
const effort = args.get("effort") ?? "low";
const jobs = Number(args.get("jobs") ?? "4");
const corpus = JSON.parse(
  NodeFS.readFileSync(args.get("cases") ?? "stemcells/evals/compiler/corpus.json", "utf8"),
) as { context: Pick<CompileContext, "places" | "models" | "cells">; cases: Case[] };
const only = args.get("only");
const cases = corpus.cases.filter((c) => only === undefined || c.name.includes(only));

// The compiler's answer, as `apps/server/src/stemcells/aski/answer.ts` asks for it.
const SCHEMA = JSON.stringify({
  type: "object",
  additionalProperties: false,
  required: ["acts", "setup", "talk"],
  properties: {
    acts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "pieces"],
        properties: {
          kind: { enum: ["start", "new", "destroy"] },
          pieces: { type: "array", items: { type: "number" } },
          place: { type: "string" },
          placeHeard: { type: "string" },
          model: { type: "string" },
          modelHeard: { type: "string" },
          effort: { type: "string" },
          count: { type: "number" },
          title: { type: "string" },
          target: { enum: ["project", "cells"] },
          cells: { type: "array", items: { type: "string" } },
        },
      },
    },
    setup: { type: "array", items: { type: "number" } },
    talk: { type: "array", items: { type: "number" } },
  },
});

/** One lean call, as the server's `runLean` makes it: no tools, no settings, no saved session. */
function ask(prompt: string, on: string): Promise<{ answer: unknown; ms: number }> {
  const cwd = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aski-eval-"));
  const started = Date.now();
  return new Promise((resolve) => {
    const child = NodeChildProcess.spawn(
      "claude",
      [
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        SCHEMA,
        "--model",
        on,
        "--effort",
        effort,
        "--tools",
        "",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--permission-mode",
        "dontAsk",
        "--setting-sources",
        "",
        "--no-session-persistence",
      ],
      { cwd, stdio: ["pipe", "pipe", "ignore"] },
    );
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.on("close", () => {
      NodeFS.rmSync(cwd, { recursive: true, force: true });
      let answer: unknown = null;
      try {
        const reply = JSON.parse(out) as { structured_output?: unknown; result?: string };
        answer = reply.structured_output ?? JSON.parse(reply.result ?? "null");
      } catch {
        answer = null;
      }
      resolve({ answer, ms: Date.now() - started });
    });
    child.stdin.end(prompt);
  });
}

async function compile(one: Case): Promise<{ plan: Plan; ms: number; tries: number }> {
  const context: CompileContext = { ...corpus.context, cap: 6, always: false, dictated: one.dictated };
  const pieces = piecesOf(
    one.text,
    context.places.flatMap((place) => [place.name, ...(place.aliases ?? [])]),
  );
  let failed: readonly string[] = [];
  let ms = 0;
  let minted = 0;
  for (const [attempt, on] of [model, strong].entries()) {
    const reply = await ask(compilerPrompt(pieces, context, failed), on);
    ms += reply.ms;
    const result = planOf({
      id: "eval",
      text: one.text,
      pieces,
      answer: reply.answer,
      context,
      mint: () => `thread-${++minted}`,
      final: attempt === 1,
    });
    if (result.ok) return { plan: result.plan, ms, tries: attempt + 1 };
    failed = result.failed;
  }
  return { plan: floorPlan("eval", pieces, one.dictated), ms, tries: 2 };
}

interface Score {
  readonly name: string;
  readonly ms: number;
  readonly tries: number;
  readonly count: boolean;
  readonly fields: number;
  readonly fieldsRight: number;
  /** A Cell that would have started at once in the wrong place, with the wrong words, or unasked. */
  readonly wrongStarts: string[];
  readonly holdsMissed: string[];
  readonly misses: string[];
}

const has = (text: string, words: string) => text.toLowerCase().includes(words.toLowerCase());
const placeOf = (act: StartAct) =>
  act.place === null ? null : act.place.how === "new" ? `new:${act.place.name}` : act.place.name;

function score(one: Case, plan: Plan, ms: number, tries: number): Score {
  const starts = plan.acts.filter((act): act is StartAct => act.kind === "start");
  const left = [...starts];
  const misses: string[] = [];
  const wrongStarts: string[] = [];
  let fields = 0;
  let right = 0;
  const mark = (ok: boolean, what: string) => {
    fields++;
    if (ok) right++;
    else misses.push(what);
  };
  for (const want of one.cells) {
    const at = left.findIndex((act) => has(act.words, want.says));
    if (at < 0) {
      mark(false, `no Cell for "${want.says}"`);
      continue;
    }
    const [act] = left.splice(at, 1);
    const place = placeOf(act!);
    const placeRight =
      want.place === "*" || (place !== null && said(place) === said(want.place));
    mark(placeRight, `"${want.says}": place ${place} for ${want.place}`);
    mark(
      (act!.model?.name ?? null) === want.model,
      `"${want.says}": model ${act!.model?.name ?? null} for ${want.model}`,
    );
    const level = act!.model?.effort?.level ?? act!.effort;
    mark((level ?? null) === want.effort, `"${want.says}": effort ${level ?? null} for ${want.effort}`);
    mark(
      want.tier === "*" || act!.tier === want.tier,
      `"${want.says}": ${act!.tier} (${act!.why.join(", ")}) for ${want.tier}`,
    );
    if (want.not !== undefined) mark(!has(act!.words, want.not), `"${want.says}" was told "${want.not}"`);
    if (want.also !== undefined) mark(has(act!.words, want.also), `"${want.says}" wasn't told "${want.also}"`);
    if (act!.tier === "start" && (!placeRight || (want.not !== undefined && has(act!.words, want.not))))
      wrongStarts.push(`"${want.says}" started in ${place}`);
  }
  for (const extra of left) {
    misses.push(`a Cell no one asked for: "${extra.title}"`);
    if (extra.tier === "start") wrongStarts.push(`unasked "${extra.title}" started`);
  }
  const holdsMissed: string[] = [];
  const destroys = plan.acts.filter((act) => act.kind === "destroy");
  for (const want of one.holds ?? []) {
    const found = destroys.some(
      (act) =>
        act.target === want.target &&
        (want.place === undefined || (act.place !== null && said(act.place.name) === said(want.place))) &&
        (want.cells === undefined ||
          want.cells.every((name) => act.cells.some((cell) => said(cell.name) === said(name)))),
    );
    if (!found) holdsMissed.push(`${want.target} ${want.place ?? want.cells?.join(", ")}`);
  }
  if (destroys.length > (one.holds ?? []).length) misses.push("a deletion no one asked for");
  if (one.talk !== undefined) {
    const talk = plan.talk.map((n) => plan.pieces.find((p) => p.n === n)?.text ?? "").join(" ");
    mark(has(talk, one.talk), `"${one.talk}" wasn't left as talk`);
  }
  return {
    name: one.name,
    ms,
    tries,
    count: starts.length === one.cells.length,
    fields,
    fieldsRight: right,
    wrongStarts,
    holdsMissed,
    misses,
  };
}

const scores: Score[] = [];
const queue = [...cases];
await Promise.all(
  Array.from({ length: Math.max(1, jobs) }, async () => {
    for (let one = queue.shift(); one !== undefined; one = queue.shift()) {
      const { plan, ms, tries } = await compile(one);
      const result = score(one, plan, ms, tries);
      scores.push(result);
      const ok = result.misses.length + result.wrongStarts.length + result.holdsMissed.length === 0;
      console.log(`${ok ? "ok  " : "MISS"} ${(result.ms / 1000).toFixed(1)}s ${result.tries > 1 ? "(2 calls) " : ""}${one.name}`);
      for (const miss of [...result.wrongStarts.map((w) => `WRONG START: ${w}`), ...result.holdsMissed.map((h) => `NOT HELD: ${h}`), ...result.misses])
        console.log(`       ${miss}`);
    }
  }),
);

const times = scores.map((s) => s.ms).sort((a, b) => a - b);
const pick = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))] ?? 0;
const sum = (f: (s: Score) => number) => scores.reduce((n, s) => n + f(s), 0);
const report = {
  model,
  strong,
  effort,
  cases: scores.length,
  wrongStarts: sum((s) => s.wrongStarts.length),
  holdsMissed: sum((s) => s.holdsMissed.length),
  countRight: sum((s) => (s.count ? 1 : 0)),
  fieldsRight: sum((s) => s.fieldsRight),
  fields: sum((s) => s.fields),
  clean: sum((s) => (s.misses.length + s.wrongStarts.length + s.holdsMissed.length === 0 ? 1 : 0)),
  secondCalls: sum((s) => (s.tries > 1 ? 1 : 0)),
  p50ms: pick(0.5),
  p90ms: pick(0.9),
};
console.log(
  `\n${model} at ${effort}: ${report.clean}/${report.cases} cases clean, ` +
    `${report.countRight}/${report.cases} with the right count, ` +
    `${report.fieldsRight}/${report.fields} fields right, ` +
    `${report.secondCalls} needed a second call; p50 ${(report.p50ms / 1000).toFixed(1)}s, p90 ${(report.p90ms / 1000).toFixed(1)}s`,
);
console.log(
  `GATES: wrong starts ${report.wrongStarts} (must be 0), deletions not held ${report.holdsMissed} (must be 0)`,
);
const out = args.get("out");
if (out !== undefined) NodeFS.writeFileSync(out, JSON.stringify({ report, scores }, null, 2));
process.exitCode = report.wrongStarts + report.holdsMissed > 0 ? 1 : 0;
