# Lab rig: writes a heavy Replay transcript: HISTORY quick long turns, then one long slow turn.
import json, sys, random
random.seed(7)
out = sys.argv[1]; HISTORY = int(sys.argv[2]); SEGMENTS = int(sys.argv[3])
S = "dev-replay-session"
WORDS = "the strip follows page layout render commit frame scroll pane chat tab cell worker layer paint style token stream effect state store route focus view list row width height cache queue batch event order test check build".split()
def words(n): return " ".join(random.choice(WORDS) for _ in range(n))
def note(update, after=None):
    e = {"type":"emit_inbound","frame":{"kind":"notification","method":"session/update","params":{"sessionId":S,"update":update}}}
    if after is not None: e["afterMs"] = after
    return e
def msg(text): return note({"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":text}})
def thought(text): return note({"sessionUpdate":"agent_thought_chunk","content":{"type":"text","text":text}})
def code(lines):
    body = "\n".join(f"export function step{i}(value: number, floor = {i}) {{\n  return Math.max(floor, value * {i + 1}) + offsets[{i}];\n}}" for i in range(lines // 3))
    return f"```ts\nconst offsets = [1, 2, 3, 5, 8, 13, 21, 34];\n{body}\n```\n\n"
def table(rows):
    return "| Step | Tool | Result |\n| --- | --- | --- |\n" + "".join(f"| {words(2)} | `read` | {i * 3} files |\n" for i in range(rows)) + "\n"
def answer(i, n):
    return (f"## Part {i}\n\n{words(n)}.\n\n" + "".join(f"- {words(9)}\n" for _ in range(4)) + "\n" + code(18)
            + f"{words(n // 2)} `{words(1)}` {words(12)}.\n\n" + table(4) + f"{words(n // 2)}.\n\n")
def tool(key, kind, title, text):
    return [note({"sessionUpdate":"tool_call","toolCallId":key,"kind":kind,"title":title,"status":"in_progress","rawInput":{"command":title} if kind=="execute" else {"path":"<workspace>/src/" + title}}),
            note({"sessionUpdate":"tool_call_update","toolCallId":key,"status":"completed","content":[{"type":"content","content":{"type":"text","text":text}}]}, 120)]
def edit(key, path):
    return [note({"sessionUpdate":"tool_call","toolCallId":key,"kind":"edit","title":"Edit " + path,"rawInput":{"path":"<workspace>/" + path},"status":"pending","content":[{"type":"diff","path":"<workspace>/" + path,"oldText":"".join(f"const a{i} = {i};\n" for i in range(12)),"newText":"".join(f"const a{i} = {i * 2};\nconst b{i} = a{i} + 1;\n" for i in range(12))}]}),
            note({"sessionUpdate":"tool_call_update","toolCallId":key,"status":"completed"}, 120)]
prompt = {"type":"expect_outbound","frame":{"kind":"request","method":"session/prompt","params":"<any>"}}
end = {"type":"emit_inbound","frame":{"kind":"response","method":"session/prompt","result":{"stopReason":"end_turn"}}}
L = [{"type":"transcript_start","provider":"acpRegistry","protocol":"acp.ndjson-jsonrpc","version":"1","scenario":"dev_replay_showcase","metadata":{"generatedBy":"lab rig"}}]
for t in range(HISTORY):
    L += [prompt, thought(words(30))]
    L += tool(f"h{t}-read", "read", f"file{t}.ts", "\n".join(words(8) for _ in range(12)))
    L += [msg(answer(t, 60))]
    L += edit(f"h{t}-edit", f"src/file{t}.ts")
    L += tool(f"h{t}-run", "execute", "vp test run", " ✓ src/math.test.ts (12 tests) 14ms\n\n Test Files  1 passed (1)")
    L += [msg(answer(t, 50)), end]
L += [prompt]
for s in range(SEGMENTS):
    L += [thought(words(25))]
    L += tool(f"s{s}-read", "read", f"long{s}.ts", "\n".join(words(8) for _ in range(10)))
    L += [msg(answer(s, 70))]
    if s % 3 == 0: L += edit(f"s{s}-edit", f"src/long{s}.ts")
L += [end]
open(out, "w").write("\n".join(json.dumps(e) for e in L) + "\n")
print(len(L), "lines")
