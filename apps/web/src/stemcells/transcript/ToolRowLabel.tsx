import { splitPathLabel } from "./pathLabel";

/**
 * A tool row's label with the file's name first and its folder after,
 * quieter, so a narrow row that is cut keeps the name. A command's row reads
 * as it was typed, and so does any label that isn't one path.
 */
export function ToolRowLabel(props: { label: string; command?: string | null | undefined }) {
  const split = props.command?.trim() ? null : splitPathLabel(props.label);
  if (split === null) return props.label;
  return (
    <>
      {split.verb ? `${split.verb} ` : null}
      {split.name}
      {split.more ? ` ${split.more}` : null}
      {split.folder ? <span className="text-muted-foreground/70"> {split.folder}</span> : null}
    </>
  );
}
