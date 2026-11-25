// words.mjs: how many words a person reads in each "shown, not told" reply, as the Cell said
// it in world.mjs. A word is a run of characters between spaces ("10%", "120" count).
//   node words.mjs
import { SHOWN, TURNS } from "./world.mjs";

for (const { message, shots } of SHOWN) {
  const said = TURNS.find((turn) => message.includes(turn.match))
    .steps.map((step) => step.say ?? "")
    .join(" ");
  console.log(`${shots[0].name}: ${(said.match(/\S+/g) ?? []).length}`);
}
