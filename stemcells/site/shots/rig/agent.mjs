#!/usr/bin/env node
// A scripted ACP agent for the site's screenshots: the lab's Replay provider, playing the
// turns in world.mjs instead of a recorded transcript. It streams words, tool rows, plans and
// questions through the real adapter, and can hold a turn open so a Cell stays in the air
// while a picture is taken. It runs no model and no CLI. (Shape: apps/server/scripts/dev-replay-agent.ts.)
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";

const LAB = process.env.SC_SITE_LAB ?? "/tmp/stemcells-shots/lab";
const { TURNS, MODEL } = await import(new URL("./world.mjs", import.meta.url).href);

const CHUNK_MS = 30;
const WORDS_PER_CHUNK = 3;
const log = (line) => {
  try {
    NodeFS.appendFileSync(
      `${LAB}/out/agent.log`,
      `${new Date().toISOString()} ${process.pid} ${line}\n`,
    );
  } catch {
    // The log is a convenience.
  }
};

const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
const sessions = new Map();
const pending = new Map();
let nextRequestId = 1;

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/** Waits until `$LAB/go/<name>` exists: the rig's way to say "carry on". */
async function hold(name, signal) {
  while (!signal.aborted && !NodeFS.existsSync(`${LAB}/go/${name}`)) await sleep(150, signal);
}

function chunks(text) {
  const words = text.match(/\S+\s*|\s+/g) ?? [];
  const out = [];
  for (let at = 0; at < words.length; at += WORDS_PER_CHUNK)
    out.push(words.slice(at, at + WORDS_PER_CHUNK).join(""));
  return out.length === 0 ? [text] : out;
}

async function play(sessionId, steps, signal) {
  const session = sessions.get(sessionId);
  const turnKey = NodeCrypto.randomUUID().slice(0, 8);
  const update = (body) => send({ method: "session/update", params: { sessionId, update: body } });
  const inWorkspace = (value) => String(value).replaceAll("<workspace>", session.cwd);
  let tools = 0;
  for (const step of steps) {
    if (signal.aborted) return "cancelled";
    if (step.wait !== undefined) await sleep(step.wait, signal);
    else if (step.hold !== undefined) await hold(step.hold, signal);
    else if (step.say !== undefined || step.think !== undefined) {
      const kind = step.say !== undefined ? "agent_message_chunk" : "agent_thought_chunk";
      for (const chunk of chunks(step.say ?? step.think)) {
        await sleep(step.pace ?? CHUNK_MS, signal);
        if (signal.aborted) return "cancelled";
        update({ sessionUpdate: kind, content: { type: "text", text: chunk } });
      }
    } else if (step.plan !== undefined) {
      await sleep(200, signal);
      update({
        sessionUpdate: "plan",
        entries: step.plan.map(([content, status]) => ({ content, priority: "medium", status })),
      });
    } else if (step.write !== undefined) {
      // A real edit in the lab's project, so the run's checkpoint has a diff to count.
      const file = NodePath.join(session.cwd, step.write.path);
      if (!NodePath.resolve(file).startsWith(NodePath.resolve(LAB) + NodePath.sep)) continue;
      NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
      NodeFS.writeFileSync(file, step.write.content);
    } else if (step.tool !== undefined) {
      const tool = step.tool;
      const toolCallId = `${turnKey}-${tools++}`;
      await sleep(250, signal);
      if (signal.aborted) return "cancelled";
      const rawInput = Object.fromEntries(
        Object.entries(tool.input ?? {}).map(([key, value]) => [key, inWorkspace(value)]),
      );
      const diff =
        tool.kind === "edit"
          ? [
              {
                type: "diff",
                path: inWorkspace(tool.input.path),
                oldText: tool.oldText ?? "",
                newText: tool.newText ?? "",
              },
            ]
          : undefined;
      update({
        sessionUpdate: "tool_call",
        toolCallId,
        kind: tool.kind,
        title: tool.title,
        status: tool.kind === "execute" ? "in_progress" : "pending",
        rawInput,
        ...(diff ? { content: diff } : {}),
      });
      if (tool.hold !== undefined) await hold(tool.hold, signal);
      await sleep(tool.ms ?? 500, signal);
      if (signal.aborted) return "cancelled";
      update({
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "completed",
        content: diff ?? [{ type: "content", content: { type: "text", text: tool.output ?? "" } }],
      });
    } else if (step.ask !== undefined) {
      const ask = step.ask;
      await sleep(250, signal);
      if (signal.aborted) return "cancelled";
      const id = nextRequestId++;
      const answered = new Promise((resolve) => pending.set(String(id), resolve));
      send({
        id,
        method: "elicitation/create",
        params: {
          sessionId,
          mode: "form",
          message: ask.question,
          requestedSchema: {
            type: "object",
            title: ask.header,
            properties: {
              [ask.id]: {
                type: "string",
                title: ask.header,
                description: ask.question,
                oneOf: ask.options.map((option) => ({
                  const: option.label,
                  title: option.label,
                  description: option.description,
                  ...(option.preview ? { _meta: { preview: option.preview } } : {}),
                })),
              },
            },
            required: [ask.id],
          },
        },
      });
      const answer = await Promise.race([
        answered,
        new Promise((resolve) =>
          signal.addEventListener("abort", () => resolve(undefined), { once: true }),
        ),
      ]);
      pending.delete(String(id));
      log(`answer ${JSON.stringify(answer)}`);
      if (signal.aborted || answer?.action !== "accept") return "cancelled";
    }
  }
  return undefined;
}

async function handle(message) {
  const params = message.params ?? {};
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: true,
          promptCapabilities: { image: false, audio: false, embeddedContext: true },
        },
        authMethods: [],
        agentInfo: { name: "site-lab-agent", version: "1" },
      };
    case "session/new":
    case "session/load": {
      const sessionId =
        message.method === "session/load" ? String(params.sessionId) : NodeCrypto.randomUUID();
      const cwd = typeof params.cwd === "string" ? params.cwd : process.cwd();
      sessions.set(sessionId, { cwd, cancel: undefined });
      return {
        ...(message.method === "session/new" ? { sessionId } : {}),
        models: {
          currentModelId: MODEL.id,
          availableModels: [{ modelId: MODEL.id, name: MODEL.name }],
        },
      };
    }
    case "session/set_model":
    case "session/set_mode":
    case "authenticate":
      return {};
    case "session/prompt": {
      const sessionId = String(params.sessionId);
      const session = sessions.get(sessionId);
      if (session === undefined) throw new Error(`Unknown session ${sessionId}`);
      const text = (Array.isArray(params.prompt) ? params.prompt : [])
        .map((block) => (typeof block?.text === "string" ? block.text : ""))
        .join("\n");
      const turn = TURNS.find((each) => text.includes(each.match));
      log(`prompt ${JSON.stringify(text.slice(-400))} -> ${turn?.match ?? "(none)"}`);
      const controller = new AbortController();
      session.cancel = () => controller.abort();
      let ended;
      try {
        ended = await play(sessionId, turn?.steps ?? [{ say: "On it." }], controller.signal);
      } finally {
        session.cancel = undefined;
      }
      return {
        stopReason: controller.signal.aborted || ended === "cancelled" ? "cancelled" : "end_turn",
      };
    }
    case "session/close":
      sessions.get(String(params.sessionId))?.cancel?.();
      sessions.delete(String(params.sessionId));
      return {};
    default:
      throw Object.assign(new Error(`Method not found: ${message.method}`), { code: -32601 });
  }
}

NodeReadline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  if (line.trim() === "") return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === undefined) {
    pending.get(String(message.id))?.(message.result);
    return;
  }
  if (message.id === undefined || message.id === null) {
    if (message.method === "session/cancel")
      sessions.get(String(message.params?.sessionId))?.cancel?.();
    return;
  }
  const id = message.id;
  handle(message).then(
    (result) => send({ id, result }),
    (error) => send({ id, error: { code: error.code ?? -32603, message: error.message } }),
  );
});
