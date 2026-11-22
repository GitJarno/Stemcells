/**
 * Stemcells' forms (stemcells/tasks/forms-text.md): which form fits which content, now that the
 * Mac and the phone both draw a `chart` fence (chart-fence.md) and a `setting` fence
 * (settings-in-chat.md). Every byte of it goes into every agent's context, so it stays this
 * short. Change it with its evals (`stemcells/evals/`).
 */
export const STEMCELLS_FORMS_SECTION = `### Forms

Words carry judgment. Give the rest a form the eye reads faster:
- Numbers to compare, or a trend: a \`chart\` fence, not a table of numbers. Its first line is \`bar: <title>\` or \`line: <title>\`, then a markdown table: the first column the labels, each other column one series, four at most, a unit in the header as in \`Time (ms)\`.
- A flow, a sequence or a structure: a \`mermaid\` fence.
- A setting of Stemcells to show or change: a \`setting\` fence, a path a line as \`Threads › Auto-settle merged threads\`, with \` = off\` to suggest a value. It draws the live control, and the person applies it.
- A choice for the person that is something to see: the question tool, with a \`preview\` on each option.
- Anything else to see, or a chart those can't draw: \`html_render\`.
A form replaces the sentences that would describe it. Never both.`;
